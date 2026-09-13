import { describe, expect, it } from "vitest"
import { buildRow, emptyDatabase } from "@/lib/data/defaults"
import type { ContentItem, Database, InsertRow, Row, TableName } from "@/lib/types"
import { buildContentTree, flattenTree, treeHeadline, type TreeItemNode, type TreePerf } from "./tree-model"

const NOW = new Date(2026, 8, 10, 12)
type Meta = { created_at?: string; updated_at?: string }
let seq = 0

function add<T extends TableName>(db: Database, table: T, values: InsertRow<T> & Meta = {} as InsertRow<T> & Meta): Row<T> {
  const id = (values as { id?: string }).id ?? `${table}-${++seq}`
  const row = buildRow(table, { ...values, id } as InsertRow<T>, "user-test", NOW)
  ;(db[table] as unknown as Row<T>[]).push(row)
  return row
}

const perf =
  (views: Record<string, number> = {}) =>
  (item: ContentItem): TreePerf => ({
    published: item.stage === "published" || item.stage === "repurpose",
    tier: views[item.id] !== undefined ? "winner" : null,
    ratio: null,
    views: views[item.id] ?? null,
  })

function familyDb() {
  const db = emptyDatabase()
  const idea = add(db, "content_ideas", { title: "Offer beats ads" })
  const at = "2026-08-01T10:00:00.000Z"
  const tiktok = add(db, "content_items", { title: "Offer (TikTok)", idea_id: idea.id, platform: "tiktok", stage: "published", created_at: at })
  const facebook = add(db, "content_items", { title: "Offer (Facebook)", idea_id: idea.id, platform: "facebook", stage: "brief", created_at: at })
  const carousel = add(db, "content_items", { title: "Carousel", idea_id: idea.id, parent_id: tiktok.id, repurpose_type: "carousel", platform: "instagram", created_at: "2026-08-05T10:00:00.000Z" })
  const part2 = add(db, "content_items", { title: "Part 2", idea_id: idea.id, parent_id: carousel.id, repurpose_type: "part_2", platform: "youtube", created_at: "2026-08-07T10:00:00.000Z" })
  add(db, "content_repurposing", { source_item_id: tiktok.id, target_item_id: carousel.id, type: "carousel", status: "created" })
  const suggestion = add(db, "content_repurposing", { source_item_id: tiktok.id, type: "x_thread", status: "suggested", title: "Thread" })
  add(db, "content_repurposing", { source_item_id: tiktok.id, type: "newsletter", status: "dismissed" })
  return { db, idea, tiktok, facebook, carousel, part2, suggestion }
}

describe("buildContentTree", () => {
  it("draws idea → items per platform → repurposed children → pending suggestions", () => {
    const { db, idea, tiktok, facebook, carousel, part2, suggestion } = familyDb()
    const model = buildContentTree(db, { ideaId: idea.id }, perf({ [tiktok.id]: 1200 }))
    expect(model).not.toBeNull()
    if (!model) return
    expect(model.root.kind).toBe("idea")
    expect(model.root.children.map((n) => n.id)).toEqual([facebook.id, tiktok.id])
    const tiktokNode = model.root.children[1] as TreeItemNode
    expect(tiktokNode.children.map((n) => [n.kind, n.id])).toEqual([
      ["item", carousel.id],
      ["suggestion", suggestion.id],
    ])
    expect(tiktokNode.children[0].children.map((n) => n.id)).toEqual([part2.id])
    expect(model.summary).toMatchObject({ assets: 4, published: 1, views: 1200, measured: 1, pending: 1, depth: 3 })
    expect(model.summary.platforms).toEqual(["facebook", "tiktok", "instagram", "youtube"])
    expect(treeHeadline(model)).toBe("1 idea → 4 assets across 4 platforms")
    expect(model.currentId).toBeNull()
  })

  it("resolves the root idea from any descendant and marks it current", () => {
    const { db, idea, part2 } = familyDb()
    const model = buildContentTree(db, { itemId: part2.id }, perf())
    expect(model?.idea?.id).toBe(idea.id)
    expect(model?.currentId).toBe(part2.id)
    expect(flattenTree(model!.root).filter((n) => n.kind === "item")).toHaveLength(4)
  })

  it("roots a family without an idea at its top-most post and links created rows without parent_id", () => {
    const db = emptyDatabase()
    const top = add(db, "content_items", { title: "Logged post", platform: "facebook", stage: "published" })
    const child = add(db, "content_items", { title: "LinkedIn", parent_id: top.id, platform: "linkedin" })
    const detached = add(db, "content_items", { title: "Carousel", platform: "instagram" })
    add(db, "content_repurposing", { source_item_id: top.id, target_item_id: detached.id, type: "carousel", status: "created" })
    add(db, "content_repurposing", { source_item_id: top.id, target_item_id: child.id, type: "linkedin_post", status: "created" })
    const model = buildContentTree(db, { itemId: child.id }, perf())
    expect(model?.idea).toBeNull()
    expect(model?.root.id).toBe(top.id)
    expect(model?.root.children.map((n) => n.id).sort()).toEqual([child.id, detached.id].sort())
    expect(treeHeadline(model!)).toBe("1 post → 3 assets across 3 platforms")
  })

  it("survives parent cycles and missing starts", () => {
    const db = emptyDatabase()
    const a = add(db, "content_items", { id: "a", parent_id: "b" })
    add(db, "content_items", { id: "b", parent_id: "a" })
    const model = buildContentTree(db, { itemId: a.id }, perf())
    expect(model?.summary.assets).toBe(2)
    expect(buildContentTree(db, { itemId: "missing" }, perf())).toBeNull()
    expect(buildContentTree(db, {}, perf())).toBeNull()
  })

  it("shows an idea that has no content yet", () => {
    const db = emptyDatabase()
    const idea = add(db, "content_ideas", { title: "Fresh" })
    const model = buildContentTree(db, { ideaId: idea.id }, perf())
    expect(model?.root.children).toEqual([])
    expect(treeHeadline(model!)).toBe("1 idea → no content yet")
  })
})
