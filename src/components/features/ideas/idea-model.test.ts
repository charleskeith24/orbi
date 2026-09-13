import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import type { ContentIdea, InsertRow } from "@/lib/types"
import {
  ACTIVE_STATUSES,
  ALL_STATUSES,
  buildTagIndex,
  DEFAULT_SORT,
  duplicateIdeaValues,
  EMPTY_FACETS,
  facetCounts,
  filterIdeas,
  hasActiveFilters,
  hookTopicFor,
  managedKey,
  NONE,
  parseIdeaBankState,
  restoreStatus,
  sanitizeFacets,
  sortIdeas,
  titleFromText,
  writeIdeaBankState,
  type IdeaBankState,
} from "./idea-model"

const USER = "user-1"
const NOW = new Date("2026-09-10T10:00:00.000Z")

function idea(values: InsertRow<"content_ideas">, createdAt = NOW.toISOString()): ContentIdea {
  return { ...buildRow("content_ideas", values, USER, NOW), created_at: createdAt }
}

const params = (query: string) => new URLSearchParams(query)

describe("parseIdeaBankState", () => {
  it("defaults to the Active status filter, score sort and the device view", () => {
    const state = parseIdeaBankState(params(""))
    expect(state.status).toEqual(ACTIVE_STATUSES)
    expect(state.sort).toBe(DEFAULT_SORT)
    expect(state.view).toBeNull()
    expect(state.q).toBe("")
    expect(state.facets).toEqual(EMPTY_FACETS)
    expect(state.open).toBeNull()
  })

  it("reads all / explicit statuses in canonical order and ignores unknown ones", () => {
    expect(parseIdeaBankState(params("status=all")).status).toEqual(ALL_STATUSES)
    expect(parseIdeaBankState(params("status=archived&status=inbox")).status).toEqual(["inbox", "archived"])
    expect(parseIdeaBankState(params("status=bogus")).status).toEqual(ACTIVE_STATUSES)
  })

  it("drops invalid enum facet values and invalid views/sorts", () => {
    const state = parseIdeaBankState(params("platform=tiktok&platform=myspace&priority=urgent&view=grid&sort=random"))
    expect(state.facets.platform).toEqual(["tiktok"])
    expect(state.facets.priority).toEqual([])
    expect(state.view).toBeNull()
    expect(state.sort).toBe(DEFAULT_SORT)
  })

  it("prefills search and the open sheet", () => {
    const state = parseIdeaBankState(params("q=Facebook%20Ads&open=abc"))
    expect(state.q).toBe("Facebook Ads")
    expect(state.open).toBe("abc")
  })
})

describe("writeIdeaBankState", () => {
  it("round-trips and omits defaults", () => {
    const state: IdeaBankState = {
      q: "pricing",
      view: "kanban",
      sort: "priority",
      status: ["validated", "selected"],
      facets: { ...EMPTY_FACETS, pillar: ["p1", NONE], platform: ["facebook"] },
      open: "i1",
    }
    const out = params("unrelated=keep")
    writeIdeaBankState(out, state)
    expect(out.get("unrelated")).toBe("keep")
    expect(parseIdeaBankState(out)).toEqual(state)

    const defaults = params("q=old&status=all")
    writeIdeaBankState(defaults, { ...parseIdeaBankState(params("")), q: "  " })
    expect(defaults.toString()).toBe("")
  })

  it("writes the All shortcut", () => {
    const out = params("")
    writeIdeaBankState(out, { ...parseIdeaBankState(params("")), status: ALL_STATUSES })
    expect(out.toString()).toBe("status=all")
  })

  it("managedKey ignores keys the page doesn't own", () => {
    expect(managedKey(params("q=a&utm=x"))).toBe(managedKey(params("q=a")))
    expect(managedKey(params("q=a"))).not.toBe(managedKey(params("q=b")))
  })
})

describe("filterIdeas", () => {
  const ideas = [
    idea({ title: "Cart recovery DM script", status: "inbox", pillar_id: "p1", platforms: ["tiktok"], priority: "high" }),
    idea({ title: "Pricing lesson", status: "validated", pillar_id: null, platforms: [], priority: "medium" }),
    idea({ title: "Old pricing take", status: "archived", pillar_id: "p1", platforms: ["facebook"], priority: "low" }),
  ]
  const base = { q: "", status: ACTIVE_STATUSES, facets: EMPTY_FACETS }

  it("hides converted and archived ideas by default", () => {
    expect(filterIdeas(ideas, base).map((i) => i.title)).toEqual(["Cart recovery DM script", "Pricing lesson"])
    expect(filterIdeas(ideas, base, { ignore: "status" })).toHaveLength(3)
  })

  it("matches the 'none' facet value and multi-valued platforms", () => {
    expect(filterIdeas(ideas, { ...base, facets: { ...EMPTY_FACETS, pillar: [NONE] } }).map((i) => i.title)).toEqual(["Pricing lesson"])
    expect(filterIdeas(ideas, { ...base, facets: { ...EMPTY_FACETS, platform: [NONE] } }).map((i) => i.title)).toEqual(["Pricing lesson"])
  })

  it("searches titles and tags", () => {
    const tagged = idea({ title: "Untagged title" })
    const tagIndex = buildTagIndex(
      [{ ...buildRow("tags", { name: "ecommerce" }, USER, NOW), id: "t1" }],
      [{ ...buildRow("content_tags", { tag_id: "t1", entity_type: "content_ideas", entity_id: tagged.id }, USER, NOW) }]
    )
    expect(filterIdeas([...ideas, tagged], { ...base, q: "#ecommerce" }, { tagIndex })).toEqual([tagged])
    expect(filterIdeas(ideas, { ...base, q: "pricing", status: ALL_STATUSES })).toHaveLength(2)
  })

  it("counts facet options without applying that facet", () => {
    const state = { ...base, facets: { ...EMPTY_FACETS, priority: ["high"] } }
    const counts = facetCounts(ideas, state, "priority")
    expect(counts.get("high")).toBe(1)
    expect(counts.get("medium")).toBe(1)
  })

  it("flags active filters", () => {
    expect(hasActiveFilters({ ...parseIdeaBankState(params("")) })).toBe(false)
    expect(hasActiveFilters({ ...parseIdeaBankState(params("status=all")) })).toBe(true)
    expect(hasActiveFilters({ ...parseIdeaBankState(params("q=%20")) })).toBe(false)
  })
})

describe("sortIdeas", () => {
  const a = idea({ title: "A", score: 80, priority: "high" }, "2026-09-01T00:00:00.000Z")
  const b = idea({ title: "B", score: null, priority: "high" }, "2026-09-09T00:00:00.000Z")
  const c = idea({ title: "C", score: 60, priority: "low" }, "2026-09-05T00:00:00.000Z")

  it("puts unscored ideas last when sorting by score", () => {
    expect(sortIdeas([b, c, a], "score").map((i) => i.title)).toEqual(["A", "C", "B"])
  })
  it("sorts newest first", () => {
    expect(sortIdeas([a, b, c], "created").map((i) => i.title)).toEqual(["B", "C", "A"])
  })
  it("sorts by priority, then score", () => {
    expect(sortIdeas([c, b, a], "priority").map((i) => i.title)).toEqual(["A", "B", "C"])
  })
})

describe("helpers", () => {
  it("titleFromText takes the first real sentence and cuts at a word", () => {
    expect(titleFromText("Why I stopped taking equity deals. Two of them cost us a year.")).toBe("Why I stopped taking equity deals")
    const long = titleFromText("word ".repeat(40))
    expect(long.length).toBeLessThanOrEqual(90)
    expect(long.endsWith("…")).toBe(true)
    expect(titleFromText("   ")).toBe("")
  })

  it("restores archived ideas to Converted only when they have content", () => {
    expect(restoreStatus({ converted_item_id: "x" })).toBe("converted")
    expect(restoreStatus({ converted_item_id: null })).toBe("inbox")
  })

  it("duplicates without the conversion link", () => {
    const source = idea({ title: "Hook test", status: "converted", converted_item_id: "item-1", talking_points: ["a"] })
    const copy = duplicateIdeaValues(source)
    expect(copy.title).toBe("Hook test (copy)")
    expect(copy.status).toBe("inbox")
    expect(copy.converted_item_id).toBeNull()
    expect(copy.talking_points).not.toBe(source.talking_points)
  })

  it("leads the hook topic with the core topic unless the title already contains it", () => {
    expect(hookTopicFor({ title: "5 signs a client is costing you more than they pay.", core_topic: "Client fit", description: "" })).toBe(
      "Client fit — 5 signs a client is costing you more than they pay."
    )
    expect(hookTopicFor({ title: "Cart recovery DM script", core_topic: "cart recovery", description: "Three messages." })).toBe(
      "Cart recovery DM script. Three messages."
    )
    expect(hookTopicFor({ title: "", core_topic: "", description: "" })).toBe("")
  })

  it("sanitizes stale entity ids but keeps 'none'", () => {
    const known = { pillar: new Set(["p1"]), persona: new Set<string>(), format: new Set<string>(), goal: new Set<string>() }
    const out = sanitizeFacets({ ...EMPTY_FACETS, pillar: ["p1", "gone", NONE] }, known)
    expect(out.pillar).toEqual(["p1", NONE])
  })
})
