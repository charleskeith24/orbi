import { describe, expect, it } from "vitest"
import { RECOMMENDATION_WEIGHTS, recommendNextContent, strategicInsights } from "./recommendations"
import { add, addPublished, makeDb, NOW, settingsOf } from "./test-fixtures"

/** Education is over target, Leadership under; Thursday's slot is Leadership / Tutorial on TikTok. */
function workspace() {
  const db = makeDb({ weekly_post_target: 7, pillar_tolerance: 10 })
  const education = add(db, "content_pillars", { name: "Education", target_percentage: 50 })
  const leadership = add(db, "content_pillars", { name: "Leadership", target_percentage: 50, sort_order: 1 })
  const tutorial = add(db, "content_formats", { name: "Tutorial" })
  for (let i = 0; i < 8; i++) {
    addPublished(db, 2 + i, { pillar_id: education.id, platform: "tiktok", title: `Education post ${i}` }, { views: 100, reach: 100 })
  }
  for (let i = 0; i < 2; i++) {
    addPublished(db, 12 + i, { pillar_id: leadership.id, platform: "tiktok", title: `Leadership post ${i}` }, { views: 100, reach: 100 })
  }
  add(db, "content_calendar", {
    day_of_week: 4,
    label: "Leadership / Tutorial",
    pillar_id: leadership.id,
    format_id: tutorial.id,
    platforms: ["tiktok"],
  })
  const problem = add(db, "audience_problems", { problem: "New managers don't know how to delegate", severity: 5 })
  const strong = add(db, "content_ideas", {
    title: "How I learned to delegate as a new manager",
    pillar_id: leadership.id,
    format_id: tutorial.id,
    platforms: ["tiktok"],
    status: "validated",
    score: 85,
    problem_id: problem.id,
  })
  const weak = add(db, "content_ideas", { title: "My favourite desk setup", pillar_id: education.id, status: "inbox", score: 40, platforms: ["tiktok"] })
  const archived = add(db, "content_ideas", { title: "Archived idea", status: "archived", score: 99 })
  const converted = add(db, "content_ideas", { title: "Converted idea", status: "converted", score: 99 })
  const draft = add(db, "content_items", { title: "Undated brief", stage: "brief", pillar_id: leadership.id, platform: "linkedin" })
  const dated = add(db, "content_items", { title: "Dated brief", stage: "brief", due_date: "2026-09-20" })
  return { db, strong, weak, archived, converted, draft, dated }
}

describe("recommendNextContent", () => {
  it("ranks a high-scoring idea for an under-target pillar that fits today's slot first", () => {
    const { db, strong, weak, archived, converted, draft, dated } = workspace()
    const recs = recommendNextContent(db, NOW, settingsOf(db), { limit: 10 })
    const order = recs.map((r) => r.id)

    expect(order).toEqual([strong.id, draft.id, weak.id])
    expect(order).not.toContain(archived.id)
    expect(order).not.toContain(converted.id)
    expect(order).not.toContain(dated.id)

    const [top] = recs
    expect(top).toMatchObject({ kind: "idea", platform: "tiktok", score: 78 })
    expect(top.breakdown).toEqual({ pillarGap: 20, slot: 15, ideaScore: 17, demand: 15, winnerSimilarity: 0, platform: 6, freshness: 5 })
    expect(top.reasons.topic).toBe("Leadership is 30 points under target over the last 30 days")
    expect(top.reasons.format).toBe("Thursday's slot calls for Tutorial")
    expect(top.signals).toContain("Thursday's slot is Leadership / Tutorial")
    expect(top.signals).toContain("Solves a severity 5/5 audience problem: “New managers don't know how to delegate”")
    expect(recs.find((r) => r.id === draft.id)).toMatchObject({ kind: "item", platform: "linkedin", score: 48 })
    expect(recs.find((r) => r.id === weak.id)?.score).toBe(22)

    for (const rec of recs) {
      for (const [factor, points] of Object.entries(rec.breakdown)) {
        expect(points).toBeLessThanOrEqual(RECOMMENDATION_WEIGHTS[factor as keyof typeof RECOMMENDATION_WEIGHTS])
      }
    }
  })

  it("respects the limit and the platform filter", () => {
    const { db, draft } = workspace()
    const settings = settingsOf(db)
    expect(recommendNextContent(db, NOW, settings)).toHaveLength(3)
    expect(recommendNextContent(db, NOW, settings, { limit: 1 })).toHaveLength(1)
    expect(recommendNextContent(db, NOW, settings, { platform: "linkedin" }).map((r) => r.id)).toEqual([draft.id])
  })

  it("flags near-duplicates of recent posts and drops their freshness points", () => {
    const { db } = workspace()
    const repeat = add(db, "content_ideas", { title: "Education post again", status: "validated" })
    const rec = recommendNextContent(db, NOW, settingsOf(db), { limit: 10 }).find((r) => r.id === repeat.id)
    expect(rec?.breakdown.freshness).toBe(0)
    expect(rec?.signals.some((s) => /^Close to “Education post \d”, published \d+ days ago$/.test(s))).toBe(true)
  })

  it("explains similarity to recent winners", () => {
    const db = makeDb()
    for (let i = 0; i < 3; i++) addPublished(db, 40 - i, { platform: "tiktok", hook_category: "list" }, { views: 100 })
    for (let i = 0; i < 3; i++) addPublished(db, 20 - i * 5, { platform: "tiktok", hook_category: "story", title: `Story ${i}` }, { views: 1000 })
    add(db, "content_ideas", { title: "The day I almost quit", hook_category: "story", platforms: ["tiktok"], status: "validated" })
    const settings = settingsOf(db)
    const [rec] = recommendNextContent(db, NOW, settings)
    expect(rec.signals).toContain("Your last 3 winners used story hooks on TikTok")
    expect(rec.breakdown.winnerSimilarity).toBeGreaterThan(0)
    expect(strategicInsights(db, NOW, settings).map((i) => i.text)).toContain("3 winners haven't been repurposed yet")
  })

  it("also suggests undated items parked in the Ideas and Selected columns, labelling Content Scores", () => {
    const db = makeDb()
    const parked = add(db, "content_items", { title: "Parked on the board", stage: "idea" })
    const selected = add(db, "content_items", {
      title: "Chosen for production",
      stage: "selected",
      quality_score: {
        hook: 16,
        relevance: 16,
        value: 16,
        clarity: 16,
        authenticity: 16,
        cta: 8,
        total: 80,
        rating: "high_potential",
        strengths: [],
        improvements: [],
        evaluated_at: NOW.toISOString(),
        provider: "offline",
      },
    })
    add(db, "content_items", { title: "Recording", stage: "recording" })
    const recs = recommendNextContent(db, NOW, settingsOf(db), { limit: 10 })
    expect(recs.map((r) => r.id).sort()).toEqual([parked.id, selected.id].sort())
    const rec = recs.find((r) => r.id === selected.id)
    expect(rec?.signals).toContain("Content Score 80")
    expect(rec?.breakdown.ideaScore).toBe(16)
  })

  it("recommends an open idea that is already on the board once, through its item", () => {
    const db = makeDb()
    const idea = add(db, "content_ideas", { title: "Delegation for new managers", status: "selected", score: 70 })
    const item = add(db, "content_items", { title: "Delegation for new managers", stage: "brief", idea_id: idea.id })
    const [rec, ...rest] = recommendNextContent(db, NOW, settingsOf(db))
    expect(rest).toEqual([])
    expect(rec).toMatchObject({ id: item.id, kind: "item" })
    expect(rec.signals).toContain("Idea Score 70")
  })

  it("returns nothing for an empty workspace", () => {
    const db = makeDb()
    expect(recommendNextContent(db, NOW, settingsOf(db))).toEqual([])
  })
})

describe("strategicInsights", () => {
  it("computes insights from the data, most urgent first", () => {
    const db = makeDb({ weekly_post_target: 7, buffer_healthy_days: 7 })
    const journey = add(db, "content_pillars", { name: "Journey", target_percentage: 50 })
    const education = add(db, "content_pillars", { name: "Education", target_percentage: 50, sort_order: 1 })
    for (let i = 0; i < 4; i++) addPublished(db, 10 + i, { pillar_id: journey.id }, { views: 180, reach: 180 })
    for (let i = 0; i < 4; i++) addPublished(db, 20 + i, { pillar_id: education.id }, { views: 100, reach: 100 })
    for (let i = 0; i < 3; i++) add(db, "content_items", { stage: "ready_to_post" })

    const insights = strategicInsights(db, NOW, settingsOf(db))
    const texts = insights.map((i) => i.text)
    expect(texts).toContain("Buffer is 3 days — below your 7-day target")
    expect(texts).toContain("Journey posts average 1.8× the views of Education — make more of them")
    expect(insights.length).toBeLessThanOrEqual(8)
    expect(insights.map((i) => i.priority)).toEqual([...insights.map((i) => i.priority)].sort((a, b) => b - a))
    expect(insights.find((i) => i.id === "pillar-double-down")?.href).toBe(`/pillars?open=${journey.id}`)
  })

  it("only reports what the data supports on an empty workspace", () => {
    const db = makeDb()
    const insights = strategicInsights(db, NOW, settingsOf(db))
    expect(insights.map((i) => i.id)).toEqual(["buffer", "weekly-pace", "idea-backlog"])
    expect(insights[0].text).toBe("Nothing is ready to post — your 7-day buffer is empty")
    expect(insights[1].text).toBe("0 of 10 posts out this week — 10 more needed with 4 days left")
  })
})
