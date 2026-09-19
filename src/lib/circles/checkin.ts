/**
 * Collab Circles — the check-in pre-compute. The number is computed from the member's own workspace and
 * shown before they submit; nothing is sent until they press "Check in" (and they can change it).
 */
import { weeklyPostingProgress } from "@/lib/analytics/consistency"
import type { AppSettings, Database, ISODate } from "@/lib/types"
import { CIRCLE_LIMITS } from "./types"

export interface CheckinDraft {
  /** First day of this week, from `settings.week_starts_on`. */
  weekStart: ISODate
  /** Posts published this week in the workspace (Studio items in a published stage). */
  published: number
  /** What the form starts with: `published`, within 0–50. */
  posts: number
}

/** A whole number within 0–50 (what a check-in may hold); NaN and blanks become 0. */
export function clampPosts(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(CIRCLE_LIMITS.posts, Math.max(0, Math.round(value)))
}

/** "You published N posts this week" — the same count as Home's weekly posting goal. */
export function checkinDraft(db: Database, now: Date, settings: AppSettings): CheckinDraft {
  const progress = weeklyPostingProgress(db, now, settings)
  return { weekStart: progress.weekStart, published: progress.published, posts: clampPosts(progress.published) }
}

/** Whether a check-in form is valid: posts 0–50 (whole), note ≤ 280 characters. */
export function checkinErrors(input: { posts: number | null; note: string }): { posts?: "range"; note?: "too_long" } {
  const errors: { posts?: "range"; note?: "too_long" } = {}
  if (input.posts === null || !Number.isInteger(input.posts) || input.posts < 0 || input.posts > CIRCLE_LIMITS.posts) errors.posts = "range"
  if (input.note.trim().length > CIRCLE_LIMITS.note) errors.note = "too_long"
  return errors
}
