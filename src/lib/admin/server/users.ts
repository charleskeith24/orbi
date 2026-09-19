/**
 * SERVER ONLY — Admin → Users rows, built from Supabase Auth (`auth.admin.listUsers`) plus account metadata
 * (`public.users.full_name`, `admin_users`) and counts from `public.admin_user_stats()`.
 * Privacy rule: never a creator's content — no titles, text or other workspace fields, counts only.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { PUBLISHED_STAGES } from "@/lib/constants"
import type { AdminUserQuery, AdminUserRow, AdminUserStatus, Page } from "../types"

export const USERS_PAGE_SIZE = 50
const AUTH_PAGE_SIZE = 1000
const TABLE_PAGE_SIZE = 1000
/** `ban_duration` for Disable: 100 years (GoTrue takes hours). Enable sends "none". */
export const DISABLE_BAN_DURATION = "876000h"

interface UserStats {
  user_id: string
  onboarding_completed: boolean
  ideas: number
  content_items: number
  published: number
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`[admin] ${what}: ${error.message}`)
}

/** Every auth user (the Admin API pages at most 1,000 per request). */
export async function listAllAuthUsers(service: SupabaseClient): Promise<User[]> {
  const users: User[] = []
  for (let page = 1; page <= 1000; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })
    if (error) fail("list users", error)
    users.push(...data.users)
    if (data.users.length < AUTH_PAGE_SIZE) break
  }
  return users
}

/** invited = invite sent (or sign-up unconfirmed), never signed in · disabled = banned · else active. */
export function userStatus(user: User, now: Date): AdminUserStatus {
  if (user.banned_until && new Date(user.banned_until).getTime() > now.getTime()) return "disabled"
  if (!user.last_sign_in_at && (user.invited_at || !user.email_confirmed_at)) return "invited"
  return "active"
}

export function mfaEnabled(user: User): boolean {
  return (user.factors ?? []).some((factor) => factor.status === "verified")
}

/** `public.users.full_name` by id — for the given ids, or every account when `ids` is omitted. */
async function loadNames(service: SupabaseClient, ids?: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (ids) {
    if (!ids.length) return names
    const { data, error } = await service.from("users").select("id, full_name").in("id", ids)
    if (error) fail("load names", error)
    for (const row of data ?? []) names.set(row.id as string, (row.full_name as string) ?? "")
    return names
  }
  for (let from = 0; ; from += TABLE_PAGE_SIZE) {
    const { data, error } = await service.from("users").select("id, full_name").order("id").range(from, from + TABLE_PAGE_SIZE - 1)
    if (error) fail("load names", error)
    for (const row of data ?? []) names.set(row.id as string, (row.full_name as string) ?? "")
    if (!data || data.length < TABLE_PAGE_SIZE) return names
  }
}

export async function loadAdminIds(service: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await service.from("admin_users").select("user_id")
  if (error) fail("load admins", error)
  return new Set((data ?? []).map((row) => row.user_id as string))
}

async function loadStats(service: SupabaseClient, ids: string[]): Promise<Map<string, UserStats>> {
  const stats = new Map<string, UserStats>()
  if (!ids.length) return stats
  const { data, error } = await service.rpc("admin_user_stats", { p_user_ids: ids, p_published_stages: PUBLISHED_STAGES })
  if (error) fail("load user stats", error)
  for (const row of (data ?? []) as UserStats[]) stats.set(row.user_id, row)
  return stats
}

export function toUserRow(
  user: User,
  facts: { name: string; isAdmin: boolean; stats: UserStats | undefined; selfId: string; now: Date }
): AdminUserRow {
  return {
    id: user.id,
    email: user.email ?? "",
    name: facts.name,
    status: userStatus(user, facts.now),
    is_admin: facts.isAdmin,
    is_self: user.id === facts.selfId,
    mfa_enabled: mfaEnabled(user),
    created_at: user.created_at,
    invited_at: user.invited_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    onboarding_completed: facts.stats?.onboarding_completed ?? false,
    counts: {
      ideas: facts.stats?.ideas ?? 0,
      content_items: facts.stats?.content_items ?? 0,
      published: facts.stats?.published ?? 0,
    },
  }
}

/** One page of Admin → Users: filtered by `query` (email or name) and `status`, newest accounts first. */
export async function listUserRows(service: SupabaseClient, query: AdminUserQuery, selfId: string, now: Date): Promise<Page<AdminUserRow>> {
  const [users, names, admins] = await Promise.all([listAllAuthUsers(service), loadNames(service), loadAdminIds(service)])
  const needle = (query.query ?? "").trim().toLowerCase()
  const matching = users
    .filter((user) => !query.status || userStatus(user, now) === query.status)
    .filter((user) => !needle || (user.email ?? "").toLowerCase().includes(needle) || (names.get(user.id) ?? "").toLowerCase().includes(needle))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || (a.email ?? "").localeCompare(b.email ?? ""))

  const page = Math.max(1, query.page ?? 1)
  const slice = matching.slice((page - 1) * USERS_PAGE_SIZE, page * USERS_PAGE_SIZE)
  const stats = await loadStats(
    service,
    slice.map((user) => user.id)
  )
  return {
    items: slice.map((user) =>
      toUserRow(user, { name: names.get(user.id) ?? "", isAdmin: admins.has(user.id), stats: stats.get(user.id), selfId, now })
    ),
    page,
    has_more: matching.length > page * USERS_PAGE_SIZE,
  }
}

/** The auth user, or null when there's no such account. */
export async function getAuthUser(service: SupabaseClient, id: string): Promise<User | null> {
  const { data, error } = await service.auth.admin.getUserById(id)
  if (error) {
    if (error.status === 404 || error.code === "user_not_found") return null
    fail("get user", error)
  }
  return data.user ?? null
}

/** The Admin → Users row for one account (after a change). */
export async function userRow(service: SupabaseClient, user: User, selfId: string, now: Date): Promise<AdminUserRow> {
  const [names, admins, stats] = await Promise.all([loadNames(service, [user.id]), loadAdminIds(service), loadStats(service, [user.id])])
  return toUserRow(user, { name: names.get(user.id) ?? "", isAdmin: admins.has(user.id), stats: stats.get(user.id), selfId, now })
}

/** GoTrue's answer when an email already belongs to a confirmed account. */
export function isEmailTaken(error: { message?: string; code?: string; status?: number }): boolean {
  return error.code === "email_exists" || error.code === "user_already_exists" || /already (been )?registered/i.test(error.message ?? "")
}
