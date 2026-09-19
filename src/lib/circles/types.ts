/**
 * Collab Circles — the client contract (docs/CIRCLES.md, ARCHITECTURE §15).
 *
 * Rows mirror `supabase/migrations/20260919000000_circles.sql` (snake_case, like the workspace model),
 * except that `circles.invite_code_hash` is never readable and `circle_contacts` has no row type: a contact
 * is only ever a string returned by `contactOf()`.
 *
 * Implementations: the browser Supabase client (RLS + RPCs, `features/circles/api/supabase-api.ts`) and the
 * in-memory fake (`./fixture-api.ts`: tests and the dev-only fixture). Both follow the same rules.
 */
import type { CollabType, ID, ISODate, ISODateTime } from "@/lib/types"

/** Limits the database enforces (CHECKs and the circle functions). */
export const CIRCLE_LIMITS = {
  members: 8,
  circlesPerPerson: 10,
  name: 60,
  displayName: 60,
  contact: 200,
  note: 280,
  posts: 50,
  askText: 500,
} as const

/** Check-in history the client loads: enough for a year-long streak. */
export const CHECKIN_HISTORY_WEEKS = 53

export type CircleRole = "owner" | "member"
export type CircleAskStatus = "open" | "closed"
export type CircleInterestStatus = "pending" | "accepted"

export interface Circle {
  id: ID
  name: string
  /** Null once the creator's account is deleted; ownership is `CircleMember.role`. */
  created_by: ID | null
  created_at: ISODateTime
}

export interface CircleMember {
  circle_id: ID
  user_id: ID
  /** The name this member chose for this circle. */
  display_name: string
  role: CircleRole
  joined_at: ISODateTime
}

export interface CircleCheckin {
  id: ID
  circle_id: ID
  user_id: ID
  /** First day of the member's own week (their `week_starts_on`). */
  week_start: ISODate
  posts: number
  note: string
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface CircleAsk {
  id: ID
  circle_id: ID
  user_id: ID
  type: CollabType
  text: string
  status: CircleAskStatus
  created_at: ISODateTime
}

export interface CircleAskInterest {
  ask_id: ID
  circle_id: ID
  user_id: ID
  status: CircleInterestStatus
  created_at: ISODateTime
}

/** `/circles`: every circle you're in, with members and recent check-ins. */
export interface CirclesOverview {
  circles: Circle[]
  members: CircleMember[]
  checkins: CircleCheckin[]
}

/** `/circles/<id>`: one circle. */
export interface CircleSnapshot {
  circle: Circle
  members: CircleMember[]
  checkins: CircleCheckin[]
  asks: CircleAsk[]
  interests: CircleAskInterest[]
}

/** What an invite link opens, before joining: name and size only. */
export interface InvitePreview {
  circle_id: ID
  name: string
  members: number
  is_member: boolean
  is_full: boolean
}

export interface CheckinInput {
  circleId: ID
  weekStart: ISODate
  posts: number
  note: string
}

export interface CirclesApi {
  /** The signed-in member's user id. */
  readonly self: ID
  listCircles(): Promise<CirclesOverview>
  /** Null when the circle doesn't exist or you're not in it (the two look the same, on purpose). */
  getCircle(circleId: ID): Promise<CircleSnapshot | null>
  /** The invite code is returned once; only its hash is stored. */
  createCircle(input: { name: string; displayName: string }): Promise<{ circleId: ID; inviteCode: string }>
  /** Null for an unknown or rotated code. */
  previewInvite(code: string): Promise<InvitePreview | null>
  /** `joined: false` when you were already a member (nothing changes). */
  joinCircle(input: { code: string; displayName: string }): Promise<{ circleId: ID; joined: boolean }>
  /** Owner only. The old link stops working. */
  rotateInvite(circleId: ID): Promise<string>
  /** Owner only; never the owner. */
  removeMember(circleId: ID, userId: ID): Promise<void>
  /** `deleted` when you were the last member. */
  leaveCircle(circleId: ID): Promise<"left" | "deleted">
  renameSelf(circleId: ID, displayName: string): Promise<void>
  /** One per member per week: a second check-in for the same week replaces the first. */
  checkIn(input: CheckinInput): Promise<CircleCheckin>
  postAsk(input: { circleId: ID; type: CollabType; text: string }): Promise<CircleAsk>
  /** Author only. */
  closeAsk(askId: ID): Promise<void>
  showInterest(circleId: ID, askId: ID): Promise<void>
  /** Pending interests only. */
  withdrawInterest(askId: ID): Promise<void>
  /** Author only. */
  acceptInterest(askId: ID, userId: ID): Promise<void>
  /** Your own contact, or a member linked to you by an accepted interest; null otherwise or when not set. */
  contactOf(circleId: ID, userId: ID): Promise<string | null>
  /** Empty clears it. */
  setMyContact(circleId: ID, contact: string): Promise<void>
}

/** The circle functions' error codes plus the ones the client produces itself. */
export const CIRCLE_ERROR_CODES = [
  "not_signed_in",
  "invalid_name",
  "invalid_display_name",
  "invalid_code",
  "invalid_contact",
  "too_many_circles",
  "circle_full",
  "not_member",
  "not_owner",
  "last_owner",
  "not_author",
  "not_found",
  "invalid",
  "network",
  "unknown",
] as const

export type CircleErrorCode = (typeof CIRCLE_ERROR_CODES)[number]

const CODES: ReadonlySet<string> = new Set(CIRCLE_ERROR_CODES)

export class CircleApiError extends Error {
  readonly code: CircleErrorCode

  constructor(code: CircleErrorCode, message?: string) {
    super(message || code)
    this.name = "CircleApiError"
    this.code = code
  }
}

/**
 * Any failure → CircleApiError. The circle functions raise their code as the message (PostgREST passes
 * it through); CHECK and RLS violations become `invalid`, dropped connections `network`.
 */
export function toCircleError(error: unknown): CircleApiError {
  if (error instanceof CircleApiError) return error
  const e = (error ?? {}) as { message?: unknown; code?: unknown }
  const message = typeof e.message === "string" ? e.message : String(error)
  const token = message.trim()
  if (CODES.has(token)) return new CircleApiError(token as CircleErrorCode, message)
  const code = typeof e.code === "string" ? e.code : ""
  // 23514 check_violation, 23505 unique_violation, 23503 foreign_key_violation, 42501 RLS / privilege.
  if (/^23/.test(code) || code === "42501" || /row-level security|violates/i.test(message)) return new CircleApiError("invalid", message)
  if (error instanceof TypeError || /failed to fetch|network|load failed/i.test(message)) return new CircleApiError("network", message)
  return new CircleApiError("unknown", message)
}
