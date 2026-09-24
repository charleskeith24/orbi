/**
 * Team workspaces — what each role may do (docs/TEAM_WORKSPACES.md, ARCHITECTURE §17).
 *
 * This is the UI's mirror of row-level security, not a second set of rules. The three table groups and
 * the three checks below are the same ones `supabase/migrations/20260921000000_team.sql` builds its
 * policies from, and `permissions.test.ts` parses that file to prove the two never drift. Postgres is
 * still the guard: a member who got past this helper would only reach a 42501.
 *
 * Pure module (no React, no store) so it can be used from the store, the adapter and tests.
 */
import type { TableName } from "@/lib/types"

export const WORKSPACE_ROLES = ["owner", "editor", "viewer"] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]
/** The roles a membership row can hold; "owner" is not a membership. */
export const MEMBER_ROLES = ["editor", "viewer"] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

/** Limits the database enforces (the team functions). */
export const TEAM_LIMITS = {
  /** Members per workspace during the beta. Pending invites take a seat too. */
  members: 5,
  /** Workspaces one person can be a member of (their own is not a membership). */
  workspacesJoined: 10,
} as const

/** Owner writes, every member reads: Brand HQ, goals, platforms, pillars, audience, formats, settings. */
export const OWNER_ONLY_TABLES: readonly TableName[] = [
  "brand_profiles",
  "app_settings",
  "content_goals",
  "content_platforms",
  "content_pillars",
  "content_formats",
  "audience_personas",
  "audience_problems",
  "audience_questions",
]

/** Owner and Editor write, every member reads: the content work. */
export const EDITOR_TABLES: readonly TableName[] = [
  "angles",
  "hooks",
  "tags",
  "content_campaigns",
  "content_series",
  "content_ideas",
  "content_items",
  "content_briefs",
  "content_scripts",
  "content_calendar",
  "content_metrics",
  "content_experiments",
  "content_repurposing",
  "stories",
  "research_items",
  "content_tags",
  "weekly_reviews",
  "monthly_reviews",
  "ai_generations",
  "engagement_logs",
  "collabs",
]

/** Money: invisible to a member without Money access. */
export const MONEY_TABLES: readonly TableName[] = ["brand_deals", "income_entries", "rate_cards"]

const OWNER_ONLY = new Set<TableName>(OWNER_ONLY_TABLES)
const MONEY = new Set<TableName>(MONEY_TABLES)

/** Who the signed-in person is in the workspace they currently have open. */
export interface WorkspaceAccess {
  role: WorkspaceRole
  /** Money tables are readable; writing them also needs a writing role. */
  moneyAccess: boolean
}

/** Your own workspace, and local mode, where there are no accounts. */
export const OWNER_ACCESS: WorkspaceAccess = { role: "owner", moneyAccess: true }

export type TeamAction = "read" | "write"

export const isMoneyTable = (table: TableName): boolean => MONEY.has(table)

/** True when this person may see the table's rows at all. */
export function canRead(table: TableName, access: WorkspaceAccess): boolean {
  return MONEY.has(table) ? access.moneyAccess : true
}

/** True when this person may insert, update or delete the table's rows. */
export function canWrite(table: TableName, access: WorkspaceAccess): boolean {
  if (access.role === "viewer") return false
  if (MONEY.has(table)) return access.moneyAccess
  if (OWNER_ONLY.has(table)) return access.role === "owner"
  return access.role === "owner" || access.role === "editor"
}

export function can(action: TeamAction, table: TableName, access: WorkspaceAccess): boolean {
  return action === "read" ? canRead(table, access) : canWrite(table, access)
}

/** In someone else's workspace. */
export const isGuest = (access: WorkspaceAccess): boolean => access.role !== "owner"

/** Money is hidden from navigation, ⌘K and Home cards for members without access. */
export const canSeeMoney = (access: WorkspaceAccess): boolean => access.moneyAccess

/**
 * Owner-only operations that aren't a table write: Settings → Data (import, start fresh, move local →
 * cloud, export — the export contains Money), Settings → Integrations, AI settings, team management and
 * deleting the workspace. Members see these disabled with an explanation.
 */
export const canManageWorkspace = (access: WorkspaceAccess): boolean => access.role === "owner"

/** Short reason a control is disabled, as a message key in `features/team/messages.ts`. */
export function denialReason(table: TableName, access: WorkspaceAccess): "viewer" | "owner_only" | "no_money" | null {
  if (canWrite(table, access)) return null
  if (MONEY.has(table) && !access.moneyAccess) return "no_money"
  if (access.role === "viewer") return "viewer"
  return "owner_only"
}
