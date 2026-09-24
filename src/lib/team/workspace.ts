/**
 * Team workspaces — which workspace is open, and which preferences stay with the person rather than the
 * workspace (docs/TEAM_WORKSPACES.md, ARCHITECTURE §17).
 *
 * Pure module: no React, no store, no browser APIs except the one localStorage helper.
 */
import type { AppSettings, ID } from "@/lib/types"
import type { MemberRole, WorkspaceAccess } from "./permissions"

/** The workspace a load must be scoped to, and the signed-in person's access to it. */
export interface WorkspaceTarget {
  /** Every row of this workspace has `user_id = ownerId`. */
  ownerId: ID
  access: WorkspaceAccess
}

/**
 * Preferences that belong to the person, not to the workspace they are visiting. A member in someone
 * else's workspace reads these from their OWN `app_settings` row and writes them back there; the owner's
 * row is never touched (row-level security forbids it anyway).
 *
 * Reminders are deliberately NOT here: reminders and push notifications go only to the owner of a
 * workspace, so Settings → Reminders is owner-only and a member's own reminders stay in their own
 * workspace (docs/TEAM_WORKSPACES.md, non-negotiable 4).
 */
export const PERSONAL_SETTING_FIELDS = ["ui_language", "simple_mode"] as const

export type PersonalSettingField = (typeof PERSONAL_SETTING_FIELDS)[number]
export type PersonalSettings = Pick<AppSettings, PersonalSettingField>

const PERSONAL = new Set<string>(PERSONAL_SETTING_FIELDS)

export const isPersonalSetting = (field: string): field is PersonalSettingField => PERSONAL.has(field)

/** The personal part of an `app_settings` patch (the only part a member may save). */
export function personalPart(patch: Record<string, unknown>): Partial<PersonalSettings> {
  return Object.fromEntries(Object.entries(patch).filter(([key]) => isPersonalSetting(key))) as Partial<PersonalSettings>
}

/** True when the patch only touches personal preferences (so a member may save it to their own row). */
export function isPersonalOnly(patch: Record<string, unknown>): boolean {
  const keys = Object.keys(patch).filter((key) => key !== "updated_at")
  return keys.length > 0 && keys.every(isPersonalSetting)
}

/** One workspace in the switcher. */
export interface WorkspaceMembership {
  owner_id: ID
  /** The owner's brand name, else their name — never their email. */
  workspace_name: string
  role: MemberRole
  money_access: boolean
  joined_at: string
}

/** A pending invite, as the invitee sees it. */
export interface WorkspaceInviteForMe {
  owner_id: ID
  workspace_name: string
  role: MemberRole
  money_access: boolean
  created_at: string
}

/** A pending invite, as the owner sees it (they typed the email). */
export interface WorkspaceInvite {
  id: ID
  email: string
  role: MemberRole
  money_access: boolean
  created_at: string
}

/** A member of the signed-in owner's workspace. */
export interface WorkspaceMember {
  user_id: ID
  role: MemberRole
  money_access: boolean
  joined_at: string
}

/** Settings → Team, for the owner. */
export interface TeamOverview {
  members: WorkspaceMember[]
  invites: WorkspaceInvite[]
}

/* ------------------------- The choice, per device ------------------------- */

/** Which workspace this browser last had open (an owner id, or absent for your own). */
export const ACTIVE_WORKSPACE_KEY = "pbos:workspace"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The slice of localStorage this module needs (injectable, so tests don't need a browser). */
export interface KeyStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function browserStore(): KeyStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

/** The remembered workspace, or null for "my own". Never throws (server, private mode, blocked storage). */
export function readActiveWorkspace(storage: KeyStore | null = browserStore()): ID | null {
  try {
    const value = storage?.getItem(ACTIVE_WORKSPACE_KEY)
    return value && UUID_RE.test(value) ? value : null
  } catch {
    return null
  }
}

/** Remembers the choice for this device; `null` goes back to your own workspace. */
export function writeActiveWorkspace(ownerId: ID | null, storage: KeyStore | null = browserStore()): void {
  try {
    if (ownerId) storage?.setItem(ACTIVE_WORKSPACE_KEY, ownerId)
    else storage?.removeItem(ACTIVE_WORKSPACE_KEY)
  } catch {
    // A device that can't remember the choice simply opens your own workspace next time.
  }
}

/**
 * The workspace to open: the remembered one when the person is still a member of it, otherwise their own.
 * `changed` is true when the remembered choice was dropped (the UI says so once).
 */
export function resolveActiveWorkspace(
  selfId: ID,
  remembered: ID | null,
  memberships: readonly WorkspaceMembership[]
): { target: WorkspaceTarget; changed: boolean } {
  const own = { target: { ownerId: selfId, access: { role: "owner", moneyAccess: true } as WorkspaceAccess }, changed: false }
  if (!remembered || remembered === selfId) return own
  const membership = memberships.find((m) => m.owner_id === remembered)
  if (!membership) return { ...own, changed: true }
  return { target: { ownerId: membership.owner_id, access: { role: membership.role, moneyAccess: membership.money_access } }, changed: false }
}

/** Reload the workspace when a tab comes back after this long away (concurrent edits: last write wins). */
export const STALE_AFTER_MS = 2 * 60 * 1000
