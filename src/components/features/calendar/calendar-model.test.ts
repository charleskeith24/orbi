import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import type { InsertRow } from "@/lib/types"
import { dropTime, fillSlots, placementOf, visibleDays } from "./calendar-model"
import { autoFillPlan, picksFromAiPlan, type AiPlanRow, type PlanPick } from "./planner-model"
import { capacitySummary, insertionPlan, moveSlotUpdates, recommendedSlots, slotPillarMix } from "./schedule-model"

// Local wall-clock dates so the tests don't depend on the machine's time zone.
const NOW = new Date(2026, 8, 13, 10, 0) // Sunday, Sep 13 2026, 10:00
const item = (values: InsertRow<"content_items">) => buildRow("content_items", values, "u", NOW)
const slot = (values: InsertRow<"content_calendar">) => buildRow("content_calendar", values, "u", NOW)
const pillar = (values: InsertRow<"content_pillars">) => buildRow("content_pillars", values, "u", NOW)
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 8, day, hours, minutes).toISOString()

describe("visibleDays", () => {
  it("covers whole weeks around the month from the configured week start", () => {
    const days = visibleDays("month", new Date(2026, 8, 13), 1)
    expect(days[0].getDay()).toBe(1)
    expect(days[0].getDate()).toBe(31)
    expect(days.length % 7).toBe(0)
    expect(days.some((d) => d.getMonth() === 8 && d.getDate() === 30)).toBe(true)
  })

  it("starts the week on Sunday or Monday", () => {
    expect(visibleDays("week", NOW, 0)[0].getDay()).toBe(0)
    expect(visibleDays("week", NOW, 1)[0].getDay()).toBe(1)
  })
})

describe("placementOf", () => {
  it("sends ready-to-post work without a publish time to the tray", () => {
    expect(placementOf(item({ stage: "ready_to_post", due_date: "2026-09-15" }))).toBeNull()
  })

  it("places production work on its deadline and scheduled posts on their day", () => {
    expect(placementOf(item({ stage: "scripting", due_date: "2026-09-15" }))?.kind).toBe("due")
    expect(placementOf(item({ stage: "brief", scheduled_at: at(16, 18, 30) }))?.key).toBe("2026-09-16")
  })
})

describe("fillSlots", () => {
  const monday = slot({ day_of_week: 1, platforms: ["tiktok", "facebook"], time: "18:30", pillar_id: "edu" })

  it("fills one seat per platform and reports the platforms still missing", () => {
    const post = placementOf(item({ stage: "scheduled", platform: "tiktok", pillar_id: "edu", scheduled_at: at(14, 18, 30) }))
    if (!post) throw new Error("expected a placement")
    const { slots, used } = fillSlots([monday], [post], new Date(2026, 8, 14), "2026-09-13")
    expect(slots[0].status).toBe("partial")
    expect(slots[0].missing).toEqual(["facebook"])
    expect(used.has(post.item.id)).toBe(true)
  })

  it("marks an unfilled slot before today as missed", () => {
    expect(fillSlots([monday], [], new Date(2026, 8, 7), "2026-09-13").slots[0].status).toBe("missed")
  })
})

describe("dropTime", () => {
  it("keeps the time of day when a scheduled post moves", () => {
    const moved = dropTime(item({ stage: "scheduled", scheduled_at: at(14, 18, 30) }), new Date(2026, 8, 16), [], NOW)
    expect([moved.getDate(), moved.getHours(), moved.getMinutes()]).toEqual([16, 18, 30])
  })

  it("uses the day's slot time for unscheduled content and never lands in the past", () => {
    const wednesday = slot({ day_of_week: 3, platforms: ["instagram"], time: "12:00" })
    expect(dropTime(item({ stage: "ready_to_post", platform: "instagram" }), new Date(2026, 8, 16), [wednesday], NOW).getHours()).toBe(12)
    // 09:00 today has passed → the next half hour.
    expect(dropTime(item({ stage: "ready_to_post" }), new Date(2026, 8, 13), [], NOW).getTime()).toBeGreaterThan(NOW.getTime())
  })
})

describe("Posting Schedule helpers", () => {
  const slots = [
    slot({ id: "a", day_of_week: 1, time: "08:00", sort_order: 0, platforms: ["linkedin"] }),
    slot({ id: "b", day_of_week: 1, time: "18:30", sort_order: 1, platforms: ["tiktok", "facebook"] }),
  ]

  it("counts one post per platform against the weekly target", () => {
    expect(capacitySummary(slots, { weekly_post_target: 4 })).toMatchObject({ postsPerWeek: 3, gap: -1, status: "under" })
  })

  it("inserts a new slot in time order and reorders within a day", () => {
    expect(insertionPlan(slots, 1, "12:00")).toEqual({ sortOrder: 1, updates: [{ id: "b", patch: { sort_order: 2 } }] })
    expect(moveSlotUpdates(slots, "b", -1)).toEqual([
      { id: "b", patch: { sort_order: 0 } },
      { id: "a", patch: { sort_order: 1 } },
    ])
    expect(moveSlotUpdates(slots, "a", -1)).toBeNull()
  })

  it("maps the recommended weekly strategy onto the workspace's pillars and active platforms", () => {
    const pillars = ["Education", "Authority", "Journey", "Leadership", "Personal", "Business"].map((name, i) =>
      pillar({ id: name.toLowerCase(), name, sort_order: i })
    )
    const recommended = recommendedSlots({ pillars, formats: [], strategies: [], brand: { main_platforms: ["facebook", "tiktok"] } })
    const byDay = new Map(recommended.map((r) => [r.day_of_week, r]))
    expect(recommended).toHaveLength(7)
    expect(byDay.get(1)?.pillar_id).toBe("education")
    expect(byDay.get(2)?.pillar_id).toBe("journey")
    expect(byDay.get(4)?.pillar_id).toBe("leadership")
    expect(byDay.get(0)?.pillar_id).toBe("personal")
    expect(byDay.get(1)?.platforms).toEqual(["tiktok", "facebook"])
    // Instagram + LinkedIn aren't active here, so Wednesday falls back to the first active platform.
    expect(byDay.get(3)?.platforms).toEqual(["facebook"])
  })

  it("warns about pillars that get no slot", () => {
    const pillars = [pillar({ id: "e", name: "Education", target_percentage: 50 }), pillar({ id: "b", name: "Business", target_percentage: 50 })]
    const mix = slotPillarMix([slot({ pillar_id: "e", platforms: ["facebook"] })], pillars, 10)
    expect(mix.warnings.map((w) => w.pillarId)).toContain("b")
  })
})

describe("Weekly Planner helpers", () => {
  const weekStart = new Date(2026, 8, 14)
  const tuesday = slot({ id: "tue", day_of_week: 2, platforms: ["facebook"], time: "20:00", pillar_id: "journey" })
  const wednesday = slot({ id: "wed", day_of_week: 3, platforms: ["facebook"], time: "12:00", pillar_id: "education" })
  const pick: PlanPick = {
    key: "idea:x",
    source: { kind: "idea", ideaId: "x" },
    title: "X",
    pillarId: "education",
    entries: [{ platform: "facebook", publishAt: null, dueDate: null, slotId: null }],
    reason: "",
    origin: "recommended",
  }

  it("puts a post into its pillar's free slot with a deadline two days earlier", () => {
    const [filled] = autoFillPlan([pick], { weekStart, slots: [tuesday, wednesday], items: [], now: NOW }, () => null)
    const entry = filled.entries[0]
    expect(entry.slotId).toBe("wed")
    expect(new Date(entry.publishAt ?? "").getDate()).toBe(16)
    expect(entry.dueDate).toBe("2026-09-14")
  })

  it("keeps publish times already set unless re-planning", () => {
    const fixed: PlanPick = { ...pick, entries: [{ ...pick.entries[0], publishAt: at(18, 9) }] }
    expect(autoFillPlan([fixed], { weekStart, slots: [wednesday], items: [], now: NOW }, () => null)[0].entries[0].slotId).toBeNull()
    expect(autoFillPlan([fixed], { weekStart, slots: [wednesday], items: [], now: NOW, replan: true }, () => null)[0].entries[0].slotId).toBe("wed")
  })

  it("merges AI rows for the same idea into one pick with several platforms", () => {
    const idea = buildRow("content_ideas", { id: "i1", title: "Idea", pillar_id: "education" }, "u", NOW)
    const row = (values: Partial<AiPlanRow>): AiPlanRow => ({
      date: "2026-09-16",
      slot_label: "",
      title: "Idea",
      idea_id: "i1",
      item_id: null,
      platform: "facebook",
      format: "",
      pillar_id: "education",
      hook: "",
      reason: "",
      ...values,
    })
    const picks = picksFromAiPlan([row({}), row({ platform: "tiktok" }), row({ title: "Brand new", idea_id: null, pillar_id: null, date: "2026-09-17" })], {
      slots: [],
      ideas: [idea],
      items: [],
      formats: [],
      now: NOW,
    })
    expect(picks).toHaveLength(2)
    expect(picks[0].entries.map((e) => e.platform)).toEqual(["facebook", "tiktok"])
    expect(picks[1].source.kind).toBe("new")
  })
})
