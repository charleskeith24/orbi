import { describe, expect, it } from "vitest"
import { buildRow, emptyDatabase, normalizeDatabase } from "@/lib/data/defaults"
import { planDelete } from "@/lib/data/relations"
import type { Collab, Database, InsertRow } from "@/lib/types"
import {
  collabDateOf,
  collabFollowUps,
  collabIdeaValues,
  compareCollabs,
  followedUpPatch,
  isFollowUpDue,
  isValidLink,
  linkHref,
  nextFollowUp,
  ratingPatch,
  statusPatch,
  withLinkedItems,
  withoutLinkedItem,
} from "./collab-model"

const USER = "user-test"
/** Thursday 10 Sep 2026, 12:00 local time. */
const NOW = new Date(2026, 8, 10, 12, 0, 0)
let n = 0
const collab = (values: InsertRow<"collabs"> = {}): Collab => buildRow("collabs", { id: `collab-${++n}`, ...values }, USER, NOW)

describe("status moves", () => {
  it("stamps status_changed_at and sets a follow-up three days out when reaching out", () => {
    const patch = statusPatch(collab({ status: "idea" }), "reached_out", NOW)
    expect(patch).toEqual({ status: "reached_out", status_changed_at: NOW.toISOString(), follow_up_on: "2026-09-13" })
  })

  it("keeps an existing follow-up date", () => {
    expect(statusPatch(collab({ status: "idea", follow_up_on: "2026-09-20" }), "reached_out", NOW).follow_up_on).toBeUndefined()
    expect(statusPatch(collab({ status: "reached_out" }), "agreed", NOW)).toEqual({ status: "agreed", status_changed_at: NOW.toISOString() })
  })

  it("a new row stamps status_changed_at at insert time", () => {
    const at = new Date(2026, 0, 2, 9, 30)
    expect(buildRow("collabs", {}, USER, at).status_changed_at).toBe(at.toISOString())
    expect(buildRow("collabs", { status_changed_at: "2025-01-01T00:00:00.000Z" }, USER, at).status_changed_at).toBe("2025-01-01T00:00:00.000Z")
  })

  it("rating a published collab moves it to Reviewed; other statuses keep theirs", () => {
    expect(ratingPatch(collab({ status: "published" }), 4, NOW)).toMatchObject({ rating: 4, status: "reviewed" })
    expect(ratingPatch(collab({ status: "reviewed" }), 7, NOW)).toEqual({ rating: 5 })
    expect(ratingPatch(collab({ status: "published" }), null, NOW)).toEqual({ rating: null })
  })
})

describe("follow-ups", () => {
  const rows = [
    collab({ title: "late", status: "reached_out", follow_up_on: "2026-09-07" }),
    collab({ title: "due today", status: "reached_out", follow_up_on: "2026-09-10" }),
    collab({ title: "not yet", status: "reached_out", follow_up_on: "2026-09-12" }),
    collab({ title: "no date", status: "reached_out", follow_up_on: null }),
    collab({ title: "agreed with old date", status: "agreed", follow_up_on: "2026-09-01" }),
    collab({ title: "live today", status: "scheduled", collab_date: "2026-09-10" }),
    collab({ title: "live tomorrow", status: "scheduled", collab_date: "2026-09-11" }),
  ]

  it("lists reached-out and agreed collabs due today or earlier, then scheduled collabs happening today", () => {
    const list = collabFollowUps(rows, NOW)
    expect(list.map((f) => [f.collab.title, f.reason, f.daysLate])).toEqual([
      ["agreed with old date", "follow_up", 9],
      ["late", "follow_up", 3],
      ["due today", "follow_up", 0],
      ["live today", "today", 0],
    ])
    expect(nextFollowUp(rows, NOW)).toBe("2026-09-12")
    expect(isFollowUpDue(rows[0], NOW)).toBe(true)
    expect(isFollowUpDue(rows[2], NOW)).toBe(false)
    expect(isFollowUpDue(rows[4], NOW)).toBe(true)
    expect(isFollowUpDue(rows[5], NOW)).toBe(false)
  })

  it("'Followed up' moves the next follow-up three days from today", () => {
    expect(followedUpPatch(NOW)).toEqual({ follow_up_on: "2026-09-13" })
  })

  it("cards show the follow-up while waiting for a reply, the collab date otherwise", () => {
    expect(collabDateOf(rows[0])).toEqual({ kind: "follow_up", date: "2026-09-07" })
    expect(collabDateOf(rows[5])).toEqual({ kind: "date", date: "2026-09-10" })
    expect(collabDateOf(rows[4])).toEqual({ kind: "follow_up", date: "2026-09-01" })
    expect(collabDateOf(collab({ status: "agreed", follow_up_on: "2026-09-01", collab_date: "2026-09-20" }))).toEqual({ kind: "date", date: "2026-09-20" })
    expect(collabDateOf(collab())).toBeNull()
  })
})

describe("content links and helpers", () => {
  it("adds without duplicates and removes one", () => {
    const c = collab({ content_item_ids: ["a"] })
    expect(withLinkedItems(c, ["a", "b", "b"])).toEqual(["a", "b"])
    expect(withLinkedItems(c, ["a"])).toBeNull()
    expect(withoutLinkedItem(c, "a")).toEqual([])
    expect(withoutLinkedItem(c, "z")).toBeNull()
  })

  it("sorts by status, then the soonest date", () => {
    const rows = [
      collab({ title: "c", status: "scheduled", collab_date: "2026-09-20" }),
      collab({ title: "a", status: "idea" }),
      collab({ title: "b", status: "scheduled", collab_date: "2026-09-12" }),
    ]
    expect([...rows].sort(compareCollabs).map((r) => r.title)).toEqual(["a", "b", "c"])
  })

  it("turns an AI idea into an Idea-status collab with the reasoning in notes", () => {
    const values = collabIdeaValues(
      {
        type: "joint_live",
        title: " Payday money Live ",
        partner_niche: "Freelance skills",
        partner_kind: "A creator who teaches freelancing skills to beginners",
        why_it_fits: "Same audience, different problem.",
        platform: "facebook",
        format: "Live Video",
        pillar_id: null,
      },
      { lookFor: "Partner to look for", why: "Why it fits", format: "Format" }
    )
    expect(values).toMatchObject({ title: "Payday money Live", type: "joint_live", status: "idea", partner_niche: "Freelance skills", partner_platform: "facebook" })
    expect(values.notes).toContain("Partner to look for: A creator who teaches freelancing skills to beginners")
    expect(values.notes).toContain("Format: Live Video")
  })

  it("validates and normalizes partner links", () => {
    expect(isValidLink("")).toBe(true)
    expect(isValidLink("tiktok.com/@ate.budget")).toBe(true)
    expect(isValidLink("https://www.youtube.com/@channel")).toBe(true)
    expect(isValidLink("not a link")).toBe(false)
    expect(linkHref("tiktok.com/@ate.budget")).toBe("https://tiktok.com/@ate.budget")
    expect(linkHref("not a link")).toBeNull()
  })
})

describe("relations: deleting what a collab points at", () => {
  function workspace(): { db: Database; c: Collab } {
    const db = emptyDatabase()
    const item = buildRow("content_items", { id: "item-1", title: "Joint Live recap" }, USER, NOW)
    const other = buildRow("content_items", { id: "item-2", title: "Stitch" }, USER, NOW)
    db.content_items = [item, other]
    db.content_campaigns = [buildRow("content_campaigns", { id: "campaign-1", name: "Sprint" }, USER, NOW)]
    db.brand_deals = [buildRow("brand_deals", { id: "deal-1", brand_name: "Sulong" }, USER, NOW)]
    db.content_pillars = [buildRow("content_pillars", { id: "pillar-1", name: "Education" }, USER, NOW)]
    db.content_goals = [buildRow("content_goals", { id: "goal-1", name: "Reach" }, USER, NOW)]
    const c = collab({
      content_item_ids: ["item-1", "item-2"],
      campaign_id: "campaign-1",
      brand_deal_id: "deal-1",
      pillar_id: "pillar-1",
      goal_id: "goal-1",
    })
    db.collabs = [c]
    return { db, c }
  }

  it("deleting a content item removes it from the collab's posts", () => {
    const { db, c } = workspace()
    const plan = planDelete(db, "content_items", ["item-1"])
    expect(plan.patches.get("collabs")?.get(c.id)).toEqual({ content_item_ids: ["item-2"] })
    expect(plan.deletes.get("collabs")).toBeUndefined()
  })

  it("deleting a campaign, deal, pillar or goal clears the link and keeps the collab", () => {
    const cases = [
      ["content_campaigns", "campaign-1", "campaign_id"],
      ["brand_deals", "deal-1", "brand_deal_id"],
      ["content_pillars", "pillar-1", "pillar_id"],
      ["content_goals", "goal-1", "goal_id"],
    ] as const
    for (const [table, id, column] of cases) {
      const { db, c } = workspace()
      const plan = planDelete(db, table, [id])
      expect(plan.patches.get("collabs")?.get(c.id), table).toEqual({ [column]: null })
      expect(plan.deletes.get("collabs"), table).toBeUndefined()
    }
  })

  it("older local workspaces without the table load with an empty collabs list", () => {
    const older: Partial<Database> = { ...workspace().db }
    delete older.collabs
    expect(normalizeDatabase(older).collabs).toEqual([])
  })
})
