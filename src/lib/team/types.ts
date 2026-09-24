/**
 * Team workspaces — the client contract (docs/TEAM_WORKSPACES.md, ARCHITECTURE §17).
 *
 * Rows mirror `supabase/migrations/20260921000000_team.sql` (snake_case, like the workspace model). There
 * are no API routes and no secret key: the browser talks to Postgres through row-level security and the
 * team functions.
 *
 * Implementations: `features/team/api/supabase-api.ts` (the browser Supabase client) and
 * `./fixture-api.ts` (an in-memory fake with the same rules, for tests and the dev-only fixture).
 */
import type { ID } from "@/lib/types"
import type { MemberRole } from "./permissions"
import type { TeamOverview, WorkspaceInviteForMe, WorkspaceMembership } from "./workspace"

export interface InviteInput {
  email: string
  role: MemberRole
  moneyAccess: boolean
}

export interface TeamApi {
  /** The signed-in account. */
  readonly self: ID
  /** The members and pending invites of the caller's OWN workspace. */
  team(): Promise<TeamOverview>
  /** The workspaces the caller is a member of (their own is not one). */
  workspaces(): Promise<WorkspaceMembership[]>
  /** Invites addressed to the caller's email. */
  invites(): Promise<WorkspaceInviteForMe[]>
  /** Owner only (always their own workspace). Re-inviting an email updates its role. */
  invite(input: InviteInput): Promise<void>
  cancelInvite(inviteId: ID): Promise<void>
  /** Owner only. A member can never change a role, including their own. */
  setMember(userId: ID, input: { role: MemberRole; moneyAccess: boolean }): Promise<void>
  /** Owner only. */
  removeMember(userId: ID): Promise<void>
  /** A member leaves a workspace they were invited into. */
  leave(ownerId: ID): Promise<void>
  respond(ownerId: ID, accept: boolean): Promise<"accepted" | "declined">
}

/** The team functions' error codes plus the ones the client produces itself. */
export const TEAM_ERROR_CODES = [
  "not_signed_in",
  "invalid_email",
  "invalid_role",
  "self_invite",
  "already_member",
  "workspace_full",
  "too_many_workspaces",
  "not_member",
  "not_found",
  "invalid",
  "network",
  "unknown",
] as const

export type TeamErrorCode = (typeof TEAM_ERROR_CODES)[number]

const CODES: ReadonlySet<string> = new Set(TEAM_ERROR_CODES)

export class TeamApiError extends Error {
  readonly code: TeamErrorCode

  constructor(code: TeamErrorCode, message?: string) {
    super(message || code)
    this.name = "TeamApiError"
    this.code = code
  }
}

/**
 * Any failure → TeamApiError. The team functions raise their code as the message (PostgREST passes it
 * through); CHECK and RLS violations become `invalid`, dropped connections `network`.
 */
export function toTeamError(error: unknown): TeamApiError {
  if (error instanceof TeamApiError) return error
  const e = (error ?? {}) as { message?: unknown; code?: unknown }
  const message = typeof e.message === "string" ? e.message : String(error)
  const token = message.trim()
  if (CODES.has(token)) return new TeamApiError(token as TeamErrorCode, message)
  const code = typeof e.code === "string" ? e.code : ""
  // 23514 check_violation, 23505 unique_violation, 23503 foreign_key_violation, 42501 RLS / privilege.
  if (/^23/.test(code) || code === "42501" || /row-level security|violates/i.test(message)) return new TeamApiError("invalid", message)
  if (error instanceof TypeError || /failed to fetch|network|load failed/i.test(message)) return new TeamApiError("network", message)
  return new TeamApiError("unknown", message)
}

/** The key in `teamMessages` for an error code (`invalid` has no wording of its own). */
export type TeamErrorMessageKey = `err_${Exclude<TeamErrorCode, "invalid">}`

export function teamErrorKey(code: TeamErrorCode): TeamErrorMessageKey {
  return code === "invalid" ? "err_unknown" : `err_${code}`
}
