import { describe, expect, it } from "vitest"
import {
  buildSearchIndex,
  normalizeText,
  recentDocs,
  searchDocs,
  searchScored,
  tokenize,
  type SearchSources,
} from "@/components/app-shell/command-palette/search"
import { buildRow } from "@/lib/data/defaults"

const USER = "test-user"
const NOW = new Date("2026-09-10T09:00:00.000Z")

function sources(overrides: Partial<SearchSources> = {}): SearchSources {
  return {
    items: [],
    ideas: [],
    hooks: [],
    angles: [],
    stories: [],
    campaigns: [],
    series: [],
    pillars: [],
    personas: [],
    problems: [],
    questions: [],
    research: [],
    experiments: [],
    deals: [],
    collabs: [],
    scripts: [],
    metrics: [],
    ...overrides,
  }
}

describe("normalizeText / tokenize", () => {
  it("lowercases, strips diacritics and collapses whitespace", () => {
    expect(normalizeText("  Café   Déjà VU ")).toBe("cafe deja vu")
    expect(tokenize(" Facebook  ADS ")).toEqual(["facebook", "ads"])
  })
})

describe("searchDocs", () => {
  const pillar = buildRow("content_pillars", { name: "Educational" }, USER, NOW)
  const adsItem = buildRow(
    "content_items",
    { title: "Facebook ads that convert", platform: "facebook", stage: "scripting", pillar_id: pillar.id },
    USER,
    NOW
  )
  const reviewItem = buildRow(
    "content_items",
    { title: "Weekly review", notes: "Talk about the ads budget", platform: "linkedin" },
    USER,
    NOW
  )
  const index = buildSearchIndex(sources({ items: [adsItem, reviewItem], pillars: [pillar] }))

  it("ranks title matches above body matches", () => {
    expect(searchDocs(index.content, "ads").map((d) => d.id)).toEqual([adsItem.id, reviewItem.id])
  })

  it("requires every word to match somewhere", () => {
    expect(searchDocs(index.content, "ads budget").map((d) => d.id)).toEqual([reviewItem.id])
  })

  it("builds context text and links from the URL conventions", () => {
    const [doc] = searchDocs(index.content, "facebook ads")
    expect(doc.href).toBe(`/studio/${adsItem.id}`)
    expect(doc.secondary).toBe("Facebook · Scripting · Educational")
  })

  it("searches current script text", () => {
    const script = buildRow(
      "content_scripts",
      { content_item_id: reviewItem.id, body: "Retargeting walkthrough", is_current: true },
      USER,
      NOW
    )
    const withScript = buildSearchIndex(sources({ items: [adsItem, reviewItem], scripts: [script] }))
    expect(searchDocs(withScript.content, "retargeting").map((d) => d.id)).toEqual([reviewItem.id])
  })

  it("caps results per group and ignores empty queries", () => {
    const hooks = Array.from({ length: 10 }, (_, i) => buildRow("hooks", { text: `Hook number ${i}` }, USER, NOW))
    const hookIndex = buildSearchIndex(sources({ hooks }))
    expect(searchDocs(hookIndex.hook, "hook")).toHaveLength(6)
    expect(searchDocs(hookIndex.hook, "hook", 3)).toHaveLength(3)
    expect(searchDocs(hookIndex.hook, "   ")).toEqual([])
  })
})

describe("collab documents", () => {
  it("finds collabs by partner or title and links to the collab sheet", () => {
    const collabs = [
      buildRow("collabs", { title: "Joint Live: COD vs prepaid", partner_handle: "@tinasells.ph", partner_name: "Tina Ramos", type: "joint_live", status: "agreed", partner_platform: "facebook" }, USER, NOW),
      buildRow("collabs", { partner_handle: "@ate.budget", partner_niche: "Personal finance", type: "duet_stitch" }, USER, NOW),
    ]
    const index = buildSearchIndex(sources({ collabs }))
    expect(searchDocs(index.collab, "tina").map((d) => d.id)).toEqual([collabs[0].id])
    expect(searchDocs(index.collab, "COD prepaid").map((d) => d.id)).toEqual([collabs[0].id])
    const [budget] = searchDocs(index.collab, "ate.budget")
    expect(budget.title).toBe("Collab with @ate.budget")
    expect(budget.href).toBe(`/collabs?open=${collabs[1].id}`)
    expect(index.collab[0].secondary).toBe("Agreed · Joint Live · @tinasells.ph · Facebook")
    expect(buildSearchIndex(sources({ collabs }), "tl").collab[0].secondary).toBe("Pumayag · Joint Live · @tinasells.ph · Facebook")
  })
})

describe("entity documents", () => {
  it("dedupes idea topics case-insensitively and links to the filtered Idea Bank", () => {
    const ideas = [
      buildRow("content_ideas", { title: "A", core_topic: "Facebook Ads" }, USER, NOW),
      buildRow("content_ideas", { title: "B", core_topic: "facebook ads " }, USER, NOW),
      buildRow("content_ideas", { title: "C", core_topic: "Pricing" }, USER, NOW),
    ]
    const index = buildSearchIndex(sources({ ideas }))
    expect(index.topic).toHaveLength(2)
    const [topic] = searchDocs(index.topic, "ads")
    expect(topic.title).toBe("Facebook Ads")
    expect(topic.secondary).toBe("2 ideas")
    expect(topic.href).toBe("/ideas?q=Facebook%20Ads")
    expect(index.idea[0].href).toBe(`/ideas?open=${ideas[0].id}`)
  })

  it("lists only published posts with metrics under Analytics, using the latest snapshot", () => {
    const live = buildRow(
      "content_items",
      { title: "Live post", stage: "published", published_at: "2026-09-01T09:00:00.000Z" },
      USER,
      NOW
    )
    const draft = buildRow("content_items", { title: "Draft post", stage: "scripting" }, USER, NOW)
    const unmeasured = buildRow(
      "content_items",
      { title: "Unmeasured post", stage: "published", published_at: "2026-09-02T09:00:00.000Z" },
      USER,
      NOW
    )
    const metrics = [
      buildRow("content_metrics", { content_item_id: live.id, recorded_at: "2026-09-02", views: 1200 }, USER, NOW),
      buildRow("content_metrics", { content_item_id: live.id, recorded_at: "2026-09-05", views: 15400 }, USER, NOW),
      buildRow("content_metrics", { content_item_id: draft.id, recorded_at: "2026-09-05", views: 10 }, USER, NOW),
    ]
    const index = buildSearchIndex(sources({ items: [live, draft, unmeasured], metrics }))
    expect(index.analytics.map((d) => d.id)).toEqual([live.id])
    expect(index.analytics[0].hint).toBe("15.4K views")
    expect(index.analytics[0].href).toBe(`/analytics/posts?open=${live.id}`)
  })

  it("links every kind to its page", () => {
    const index = buildSearchIndex(
      sources({
        hooks: [buildRow("hooks", { text: "x" }, USER, NOW)],
        stories: [buildRow("stories", { title: "x" }, USER, NOW)],
        campaigns: [buildRow("content_campaigns", { name: "x" }, USER, NOW)],
        research: [buildRow("research_items", { title: "x" }, USER, NOW)],
        problems: [buildRow("audience_problems", { problem: "x" }, USER, NOW)],
        questions: [buildRow("audience_questions", { question: "x" }, USER, NOW)],
        angles: [buildRow("angles", { name: "x" }, USER, NOW)],
        series: [buildRow("content_series", { name: "x" }, USER, NOW)],
        pillars: [buildRow("content_pillars", { name: "x" }, USER, NOW)],
        personas: [buildRow("audience_personas", { name: "x" }, USER, NOW)],
        experiments: [buildRow("content_experiments", { name: "x" }, USER, NOW)],
      })
    )
    expect(index.hook[0].href).toMatch(/^\/ideas\/hooks\?open=/)
    expect(index.story[0].href).toMatch(/^\/stories\?open=/)
    expect(index.campaign[0].href).toMatch(/^\/campaigns\/[^?]+$/)
    expect(index.research[0].href).toMatch(/^\/research\?open=/)
    expect(index.problem[0].href).toMatch(/^\/audience\/problems\?open=/)
    expect(index.question[0].href).toMatch(/^\/audience\/questions\?open=/)
    expect(index.angle[0].href).toMatch(/^\/ideas\/angles\?open=/)
    expect(index.series[0].href).toMatch(/^\/series\?open=/)
    expect(index.pillar[0].href).toMatch(/^\/pillars\?open=/)
    expect(index.persona[0].href).toMatch(/^\/audience\?open=/)
    expect(index.experiment[0].href).toMatch(/^\/experiments\?open=/)
  })

  it("finds brand deals by brand, contact and deliverables and opens them on the Brand Deals page", () => {
    const deal = buildRow(
      "brand_deals",
      {
        brand_name: "Kapihan Roasters",
        contact_name: "Paolo Lim",
        status: "negotiating",
        fee: 18000,
        platforms: ["instagram"],
        deliverables: ["2 Instagram stories"],
      },
      USER,
      NOW
    )
    const index = buildSearchIndex(sources({ deals: [deal] }))
    for (const query of ["kapihan", "paolo", "stories"]) expect(searchDocs(index.deal, query).map((d) => d.id), query).toEqual([deal.id])
    expect(index.deal[0]).toMatchObject({ href: `/money/deals?open=${deal.id}`, secondary: "Negotiating · ₱18,000 · Instagram" })
  })

  it("finds secondary kinds by their own fields", () => {
    const persona = buildRow(
      "audience_personas",
      { name: "Scaling founder", profession: "E-commerce owner", frustrations: ["Rising ad costs"] },
      USER,
      NOW
    )
    const experiment = buildRow(
      "content_experiments",
      { name: "Short vs long hooks", hypothesis: "Shorter hooks lift retention" },
      USER,
      NOW
    )
    const index = buildSearchIndex(sources({ personas: [persona], experiments: [experiment] }))
    expect(searchDocs(index.persona, "ecommerce owner")).toHaveLength(0)
    expect(searchDocs(index.persona, "e-commerce").map((d) => d.id)).toEqual([persona.id])
    expect(searchDocs(index.persona, "ad costs").map((d) => d.id)).toEqual([persona.id])
    expect(searchDocs(index.experiment, "retention").map((d) => d.id)).toEqual([experiment.id])
  })

  it("scores comparably across kinds so an exact title outranks a body mention", () => {
    const pillar = buildRow("content_pillars", { name: "Education" }, USER, NOW)
    const item = buildRow("content_items", { title: "Weekly recap", notes: "education budget" }, USER, NOW)
    const index = buildSearchIndex(sources({ pillars: [pillar], items: [item] }))
    const [pillarHit] = searchScored(index.pillar, "education")
    const [itemHit] = searchScored(index.content, "education")
    expect(pillarHit.score).toBeGreaterThan(itemHit.score)
  })
})

describe("recentDocs", () => {
  it("returns the most recently updated documents first", () => {
    const older = { ...buildRow("content_ideas", { title: "Older" }, USER, NOW), updated_at: "2026-09-01T00:00:00.000Z" }
    const newer = { ...buildRow("content_ideas", { title: "Newer" }, USER, NOW), updated_at: "2026-09-09T00:00:00.000Z" }
    const index = buildSearchIndex(sources({ ideas: [older, newer] }))
    expect(recentDocs(index.idea, 1).map((d) => d.title)).toEqual(["Newer"])
  })
})

describe("buildSearchIndex in Taglish", () => {
  it("translates the text it builds, not the workspace data", () => {
    const pillar = buildRow("content_pillars", { name: "Education", target_percentage: 30, is_active: false }, USER, NOW)
    const untitled = buildRow("content_ideas", { title: "", core_topic: "Pricing" }, USER, NOW)
    const index = buildSearchIndex(sources({ pillars: [pillar], ideas: [untitled] }), "tl")
    expect(index.pillar[0]).toMatchObject({ title: "Education", secondary: "30% ng mix · Hindi active" })
    expect(index.idea[0].title).toBe("Idea na walang title")
    expect(index.topic[0]).toMatchObject({ title: "Pricing", secondary: "1 idea", hint: "Topic" })
    expect(buildSearchIndex(sources({ pillars: [pillar] })).pillar[0].secondary).toBe("30% of the mix · Inactive")
  })
})
