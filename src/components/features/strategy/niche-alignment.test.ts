import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import { createStarterDatabase } from "@/lib/data/starter"
import type { ContentItem, Database } from "@/lib/types"
import { keywordsMatch, keywordsOf, nicheAlignment, nicheKeywords, recentAlignmentItems, stem } from "./niche-alignment"

const NOW = new Date(2026, 8, 13, 12)
const USER = "user-1"
const NICHE = "Bookkeeping systems for online sellers"
const INTERESTS = ["Shopee", "Cash flow"]

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString()
}

function published(title: string, daysAgo: number, extra: Partial<ContentItem> = {}): ContentItem {
  return buildRow("content_items", { title, platform: "facebook", stage: "published", published_at: daysFromNow(-daysAgo), ...extra }, USER, NOW)
}

function workspace(items: ContentItem[]): Database {
  const db = createStarterDatabase(USER, NOW)
  return { ...db, content_items: items }
}

function run(db: Database, niche = NICHE, interests = INTERESTS) {
  return nicheAlignment(db, db.app_settings[0], NOW, niche, interests)
}

describe("keywords", () => {
  it("stems plurals and gerunds lightly", () => {
    expect(stem("systems")).toBe("system")
    expect(stem("marketing")).toBe("market")
    expect(stem("stories")).toBe("story")
    expect(stem("business")).toBe("business")
  })

  it("drops grammar words, numbers and short words; splits hyphenated words", () => {
    expect(keywordsOf("5 E-commerce systems for the Filipino sellers")).toEqual(["ecommerce", "commerce", "system", "filipino", "seller"])
    expect(keywordsOf("Paano mag-ipon ng pera para sa negosyo")).toEqual(["paano", "magipon", "mag", "ipon", "pera", "negosyo"])
  })

  it("keeps the first spelling as the label", () => {
    expect(nicheKeywords(NICHE, INTERESTS).map((k) => k.label)).toEqual(["bookkeeping", "systems", "online", "sellers", "shopee", "cash", "flow"])
  })

  it("matches shared stems and long prefixes only", () => {
    expect(keywordsMatch("bookkeep", "bookkeeper")).toBe(true)
    expect(keywordsMatch("sell", "seller")).toBe(false)
    expect(keywordsMatch("system", "system")).toBe(true)
  })
})

describe("nicheAlignment", () => {
  it("scores recent published and scheduled content, ignoring older posts", () => {
    const db = workspace([
      published("My bookkeeper setup for Shopee", 2),
      published("Three cash flow mistakes", 5),
      published("My morning routine", 3),
      published("Travel vlog from Siargao", 40),
      buildRow("content_items", { title: "Inventory systems that scale", platform: "tiktok", stage: "scheduled", scheduled_at: daysFromNow(3) }, USER, NOW),
      buildRow("content_items", { title: "Bookkeeping draft", platform: "tiktok", stage: "scripting" }, USER, NOW),
    ])
    expect(recentAlignmentItems(db, NOW).map((i) => i.title)).toEqual([
      "Inventory systems that scale",
      "My bookkeeper setup for Shopee",
      "My morning routine",
      "Three cash flow mistakes",
    ])
    const result = run(db)
    expect(result.recent).toMatchObject({ total: 4, aligned: 3, share: 0.75 })
    expect(result.recent.offNiche.map((i) => i.title)).toEqual(["My morning routine"])
    expect(result.status).toBe("high")
    expect(result.winners).toMatchObject({ total: 0, share: null })
  })

  it("reads the hook, the idea's core topic and the pillar name", () => {
    const base = createStarterDatabase(USER, NOW)
    const pillar = buildRow("content_pillars", { name: "Bookkeeping basics" }, USER, NOW)
    const idea = buildRow("content_ideas", { title: "Monday idea", core_topic: "Shopee payouts" }, USER, NOW)
    const db: Database = {
      ...base,
      content_pillars: [pillar],
      content_ideas: [idea],
      content_items: [
        published("Monday post", 1, { pillar_id: pillar.id }),
        published("Tuesday post", 2, { idea_id: idea.id }),
        published("Wednesday post", 3, { hook: "Your cash is leaking" }),
      ],
    }
    const result = run(db)
    expect(result.recent.aligned).toBe(3)
    expect(result.topMatches.map((m) => m.label)).toEqual(["bookkeeping", "cash", "shopee"])
  })

  it("flags low alignment and waits for enough content", () => {
    const low = workspace([
      published("Cash flow in December", 1),
      published("My gym routine", 2),
      published("Coffee review", 3),
      published("Weekend travel", 4),
    ])
    expect(run(low).status).toBe("low")
    expect(run(workspace([published("Cash flow", 1), published("Gym", 2)])).status).toBe("not-enough")
    expect(run(low, "", []).status).toBe("no-niche")
  })
})
