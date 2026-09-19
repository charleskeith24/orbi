/**
 * Collab Circles — "Add to Collabs": an accepted ask becomes a collab in the author's *own* workspace,
 * pre-filled from the ask (partner = the member's display name, type, notes). Pure; the circle view passes
 * the translated labels and `now`, and inserts the row with the Collab tracker's actions.
 */
import { addDays } from "date-fns"
import { toISODate } from "@/lib/dates"
import type { InsertRow } from "@/lib/types"
import type { CircleAsk } from "./types"

/** Same as the Collab tracker's follow-up (features/collabs/collab-model.ts FOLLOW_UP_DAYS). */
export const ASK_FOLLOW_UP_DAYS = 3

const TITLE_MAX = 80

/** A short collab title from the ask: its first line, cut at a word near 80 characters. */
export function askTitle(text: string): string {
  const line = text.trim().split(/\r?\n/, 1)[0]?.trim() ?? ""
  if (line.length <= TITLE_MAX) return line
  const cut = line.slice(0, TITLE_MAX)
  const space = cut.lastIndexOf(" ")
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`
}

/** "@mika.creates" (a bare handle) goes into partner_handle; anything else stays in the notes only. */
export function handleFromContact(contact: string | null | undefined): string {
  const value = (contact ?? "").trim()
  return /^@[\w.]{1,60}$/.test(value) ? value : ""
}

export interface AskCollabLabels {
  /** e.g. `From the circle "Manila money creators"` (already translated and filled in). */
  fromCircle: string
  /** e.g. "Contact" / "Paano i-contact". */
  contact: string
}

/**
 * The collab row: status Agreed (they said yes; now agree on the format and the date) with a follow-up in
 * three days, so it shows on Today until it's scheduled.
 */
export function collabFromAsk(
  input: { ask: Pick<CircleAsk, "type" | "text">; partnerName: string; contact: string | null; now: Date },
  labels: AskCollabLabels
): InsertRow<"collabs"> {
  const contact = (input.contact ?? "").trim()
  const notes = [`${labels.fromCircle}:\n${input.ask.text.trim()}`, contact ? `${labels.contact}: ${contact}` : ""].filter(Boolean).join("\n\n")
  return {
    title: askTitle(input.ask.text),
    type: input.ask.type,
    status: "agreed",
    status_changed_at: input.now.toISOString(),
    follow_up_on: toISODate(addDays(input.now, ASK_FOLLOW_UP_DAYS)),
    partner_name: input.partnerName.trim(),
    partner_handle: handleFromContact(contact),
    notes,
  }
}
