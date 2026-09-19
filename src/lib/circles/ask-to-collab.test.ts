import { describe, expect, it } from "vitest"
import { FOLLOW_UP_DAYS } from "@/components/features/collabs/collab-model"
import { buildRow } from "@/lib/data/defaults"
import { ASK_FOLLOW_UP_DAYS, askTitle, collabFromAsk, handleFromContact } from "./ask-to-collab"

const NOW = new Date(2026, 8, 17, 10, 0, 0)
const LABELS = { fromCircle: 'From the circle "Manila money creators"', contact: "Contact" }

describe("collabFromAsk — Add to Collabs", () => {
  it("pre-fills a collab from the ask: partner, type, title and notes", () => {
    const row = collabFromAsk(
      { ask: { type: "joint_live", text: "Joint Live on ipon for freelancers?\nI bring templates." }, partnerName: " Ria ", contact: "@ria.creates", now: NOW },
      LABELS
    )
    expect(row).toEqual({
      title: "Joint Live on ipon for freelancers?",
      type: "joint_live",
      status: "agreed",
      status_changed_at: NOW.toISOString(),
      follow_up_on: "2026-09-20",
      partner_name: "Ria",
      partner_handle: "@ria.creates",
      notes: 'From the circle "Manila money creators":\nJoint Live on ipon for freelancers?\nI bring templates.\n\nContact: @ria.creates',
    })
  })

  it("keeps a contact that isn't a bare handle in the notes only", () => {
    const row = collabFromAsk({ ask: { type: "guesting", text: "Podcast guest?" }, partnerName: "Jun", contact: "jun@example.com or @jun on IG", now: NOW }, LABELS)
    expect(row.partner_handle).toBe("")
    expect(row.notes).toContain("Contact: jun@example.com or @jun on IG")
  })

  it("works without a contact", () => {
    const row = collabFromAsk({ ask: { type: "giveaway", text: "Giveaway" }, partnerName: "Bea", contact: null, now: NOW }, LABELS)
    expect(row.notes).toBe('From the circle "Manila money creators":\nGiveaway')
    expect(row.partner_handle).toBe("")
  })

  it("is a valid collabs row, with the Collab tracker's follow-up rhythm", () => {
    const row = buildRow("collabs", collabFromAsk({ ask: { type: "other", text: "x" }, partnerName: "Mika", contact: null, now: NOW }, LABELS), "me", NOW)
    expect(row).toMatchObject({ status: "agreed", partner_name: "Mika", content_item_ids: [], pillar_id: null })
    expect(ASK_FOLLOW_UP_DAYS).toBe(FOLLOW_UP_DAYS)
  })

  it("never copies anything but the ask, the partner's name and the revealed contact", () => {
    const row = collabFromAsk({ ask: { type: "other", text: "Ask" }, partnerName: "Mika", contact: "@mika", now: NOW }, LABELS)
    expect(Object.keys(row).sort()).toEqual(["follow_up_on", "notes", "partner_handle", "partner_name", "status", "status_changed_at", "title", "type"])
  })
})

describe("askTitle / handleFromContact", () => {
  it("shortens long asks at a word", () => {
    const title = askTitle(`${"Looking for a finance creator ".repeat(4)}for a joint Live`)
    expect(title.length).toBeLessThanOrEqual(81)
    expect(title.endsWith("…")).toBe(true)
    expect(title).not.toMatch(/\s…$/)
    expect(askTitle("  Short one  ")).toBe("Short one")
  })

  it("recognises only bare handles", () => {
    expect(handleFromContact("@mika.sample")).toBe("@mika.sample")
    expect(handleFromContact(" @mika_1 ")).toBe("@mika_1")
    expect(handleFromContact("@mika on IG")).toBe("")
    expect(handleFromContact("mika@example.com")).toBe("")
    expect(handleFromContact(null)).toBe("")
  })
})
