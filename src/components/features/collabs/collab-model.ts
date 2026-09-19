/**
 * Collabs — pure rules shared by the board, table, sheet, Today and the integrations: status moves,
 * follow-ups, content links, sorting and the values a saved AI idea becomes. No store access.
 */
import { addDays } from "date-fns"
import { COLLAB_STATUS_IDS } from "@/lib/constants"
import { daysBetween, toISODate } from "@/lib/dates"
import type { Collab, CollabStatus, CollabType, ID, InsertRow, ISODate, PlatformId, UpdateRow } from "@/lib/types"

/** Days until the next follow-up after reaching out or following up. */
export const FOLLOW_UP_DAYS = 3

/** Statuses on the board's main columns (Declined is the collapsed side column). */
export const BOARD_STATUS_IDS: CollabStatus[] = COLLAB_STATUS_IDS.filter((s) => s !== "declined")

/** Still in motion: reached out, agreed or scheduled. */
export function isOpenCollab(collab: Pick<Collab, "status">): boolean {
  return collab.status === "reached_out" || collab.status === "agreed" || collab.status === "scheduled"
}

export function followUpDate(now: Date, days = FOLLOW_UP_DAYS): ISODate {
  return toISODate(addDays(now, days))
}

/**
 * Patch for a status change: stamps `status_changed_at`; reaching out without a follow-up date sets one
 * three days out, so the collab shows up on Today if they don't reply.
 */
export function statusPatch(collab: Pick<Collab, "status" | "follow_up_on">, status: CollabStatus, now: Date): UpdateRow<"collabs"> {
  const patch: UpdateRow<"collabs"> = { status, status_changed_at: now.toISOString() }
  if (status === "reached_out" && collab.status !== "reached_out" && !collab.follow_up_on) patch.follow_up_on = followUpDate(now)
  return patch
}

/** Statuses where a follow-up date matters: waiting for a reply, or agreed but not settled yet. */
export const FOLLOW_UP_STATUSES: readonly CollabStatus[] = ["reached_out", "agreed"]

export function awaitsFollowUp(status: CollabStatus): boolean {
  return FOLLOW_UP_STATUSES.includes(status)
}

/** "Followed up": the next follow-up is three days from today. */
export function followedUpPatch(now: Date): UpdateRow<"collabs"> {
  return { follow_up_on: followUpDate(now) }
}

/** Rating a published collab means its results were looked at → Reviewed. */
export function ratingPatch(collab: Pick<Collab, "status" | "follow_up_on">, rating: number | null, now: Date): UpdateRow<"collabs"> {
  const value = rating === null ? null : Math.min(5, Math.max(1, Math.round(rating)))
  const patch: UpdateRow<"collabs"> = { rating: value }
  return value !== null && collab.status === "published" ? { ...patch, ...statusPatch(collab, "reviewed", now) } : patch
}

export type FollowUpReason = "follow_up" | "today"

export interface CollabFollowUp {
  collab: Collab
  reason: FollowUpReason
  /** Days past the follow-up date (0 = due today). */
  daysLate: number
}

/**
 * Today's collab list: Reached out or Agreed with a follow-up date today or earlier (oldest first), then
 * Scheduled collabs happening today.
 */
export function collabFollowUps(collabs: readonly Collab[], now: Date): CollabFollowUp[] {
  const today = toISODate(now)
  const late = (date: ISODate) => Math.max(0, daysBetween(date, now) ?? 0)
  const followUps = collabs
    .filter((c) => awaitsFollowUp(c.status) && c.follow_up_on !== null && c.follow_up_on <= today)
    .sort((a, b) => a.follow_up_on!.localeCompare(b.follow_up_on!) || a.created_at.localeCompare(b.created_at))
    .map((collab): CollabFollowUp => ({ collab, reason: "follow_up", daysLate: late(collab.follow_up_on!) }))
  const happening = collabs
    .filter((c) => c.status === "scheduled" && c.collab_date === today)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((collab): CollabFollowUp => ({ collab, reason: "today", daysLate: 0 }))
  return [...followUps, ...happening]
}

/** The soonest upcoming follow-up (after today) among collabs that await one, or null. */
export function nextFollowUp(collabs: readonly Collab[], now: Date): ISODate | null {
  const today = toISODate(now)
  const dates = collabs
    .filter((c) => awaitsFollowUp(c.status) && c.follow_up_on !== null && c.follow_up_on > today)
    .map((c) => c.follow_up_on!)
    .sort()
  return dates[0] ?? null
}

/** Reached out or Agreed, and the follow-up date has passed (or is today). */
export function isFollowUpDue(collab: Pick<Collab, "status" | "follow_up_on">, now: Date): boolean {
  return awaitsFollowUp(collab.status) && collab.follow_up_on !== null && collab.follow_up_on <= toISODate(now)
}

/** The date a card shows: the follow-up while waiting for a reply (or agreed without a date yet), otherwise the collab date. */
export function collabDateOf(collab: Pick<Collab, "status" | "follow_up_on" | "collab_date">): { kind: "follow_up" | "date"; date: ISODate } | null {
  if (collab.status === "reached_out" && collab.follow_up_on) return { kind: "follow_up", date: collab.follow_up_on }
  if (collab.status === "agreed" && collab.follow_up_on && !collab.collab_date) return { kind: "follow_up", date: collab.follow_up_on }
  return collab.collab_date ? { kind: "date", date: collab.collab_date } : null
}

/** New `content_item_ids` with `itemIds` added (existing order kept, no duplicates); null when nothing changes. */
export function withLinkedItems(collab: Pick<Collab, "content_item_ids">, itemIds: readonly ID[]): ID[] | null {
  const next = [...collab.content_item_ids]
  for (const id of itemIds) if (!next.includes(id)) next.push(id)
  return next.length === collab.content_item_ids.length ? null : next
}

export function withoutLinkedItem(collab: Pick<Collab, "content_item_ids">, itemId: ID): ID[] | null {
  return collab.content_item_ids.includes(itemId) ? collab.content_item_ids.filter((id) => id !== itemId) : null
}

/** Board/table order: status, then the date that matters (soonest first), then most recently updated. */
export function compareCollabs(a: Collab, b: Collab): number {
  const status = COLLAB_STATUS_IDS.indexOf(a.status) - COLLAB_STATUS_IDS.indexOf(b.status)
  if (status) return status
  const da = collabDateOf(a)?.date ?? "9999-12-31"
  const db = collabDateOf(b)?.date ?? "9999-12-31"
  const reverse = a.status === "published" || a.status === "reviewed" || a.status === "declined"
  if (da !== db) return reverse ? db.localeCompare(da) : da.localeCompare(db)
  return b.updated_at.localeCompare(a.updated_at)
}

/** Partner as one line: "@handle", else the name, else their niche. */
export function partnerLabel(collab: Pick<Collab, "partner_handle" | "partner_name" | "partner_niche">): string {
  return collab.partner_handle.trim() || collab.partner_name.trim() || collab.partner_niche.trim()
}

/** Search text for the page filter and ⌘K. */
export function collabSearchFields(collab: Collab): string[] {
  return [collab.title, collab.partner_name, collab.partner_handle, collab.partner_niche, collab.notes, collab.outreach_message]
}

/** A collab idea from the AI ("Save as collab idea") → an Idea-status collab. */
export interface CollabIdeaDraft {
  type: CollabType
  title: string
  partner_niche: string
  partner_kind: string
  why_it_fits: string
  platform: PlatformId
  format: string
  pillar_id: ID | null
}

export function collabIdeaValues(idea: CollabIdeaDraft, labels: { lookFor: string; why: string; format: string }): InsertRow<"collabs"> {
  const notes = [
    `${labels.lookFor}: ${idea.partner_kind.trim()}`,
    `${labels.why}: ${idea.why_it_fits.trim()}`,
    idea.format.trim() ? `${labels.format}: ${idea.format.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
  return {
    title: idea.title.trim(),
    type: idea.type,
    status: "idea",
    partner_niche: idea.partner_niche.trim(),
    partner_platform: idea.platform,
    pillar_id: idea.pillar_id,
    notes,
  }
}

/** Same idea saved twice? (title + type, case-insensitive) */
export function ideaSignature(value: { title: string; type: CollabType }): string {
  return `${value.type}|${value.title.trim().toLowerCase()}`
}

const URL_LIKE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i

/** Accepts "https://…", "www.…" or "tiktok.com/@name"; empty is fine. */
export function isValidLink(value: string): boolean {
  const v = value.trim()
  return !v || URL_LIKE.test(v)
}

/** A clickable href for a stored partner link. */
export function linkHref(value: string): string | null {
  const v = value.trim()
  if (!v || !isValidLink(v)) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}
