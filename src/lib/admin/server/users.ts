/**
 * SERVER ONLY — Admin → Users rows, built from Supabase Auth (`auth.admin.listUsers`) plus account metadata
 * (`public.users.full_name` and the profile photo, `admin_users`) and counts from `public.admin_user_stats()`.
 * Privacy rule: never a creator's content — no titles, text or other workspace fields, counts only. Of the profile,
 * admins get the name and the photo (a signed URL from the private avatars bucket), nothing else.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { PUBLISHED_STAGES } from "@/lib/constants"
import { AVATARS_BUCKET, isAvatarPath } from "@/lib/profiles/photo-path"
import { PROFILE_LIMITS } from "@/lib/profiles/types"
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

interface ProfileFacts {
  name: string
  /** Storage path in the avatars bucket, or null. */
  avatar: string | null
}

/**
 * Name and photo path by id, from `public.users` (admins see a profile's name and photo only — never its headline,
 * location or links). For the given ids, or every account when `ids` is omitted.
 */
async function loadProfiles(service: SupabaseClient, ids?: string[]): Promise<Map<string, ProfileFacts>> {
  const profiles = new Map<string, ProfileFacts>()
  const add = (rows: Record<string, unknown>[] | null) => {
    for (const row of rows ?? []) {
      const avatar = typeof row.avatar_url === "string" && isAvatarPath(row.avatar_url, row.id as string) ? row.avatar_url : null
      profiles.set(row.id as string, { name: (row.full_name as string) ?? "", avatar })
    }
  }
  if (ids) {
    if (!ids.length) return profiles
    const { data, error } = await service.from("users").select("id, full_name, avatar_url").in("id", ids)
    if (error) fail("load names", error)
    add(data)
    return profiles
  }
  for (let from = 0; ; from += TABLE_PAGE_SIZE) {
    const { data, error } = await service.from("users").select("id, full_name, avatar_url").order("id").range(from, from + TABLE_PAGE_SIZE - 1)
    if (error) fail("load names", error)
    add(data)
    if (!data || data.length < TABLE_PAGE_SIZE) return profiles
  }
}

/**
 * Signed URLs (1 hour) for photo paths, made with the secret key. A failure only costs the photos (initials show
 * instead): it's logged, never thrown, so the Users list still loads.
 */
export async function signPhotoUrls(service: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  if (!paths.length) return urls
  const { data, error } = await service.storage.from(AVATARS_BUCKET).createSignedUrls(paths, PROFILE_LIMITS.signedUrlSeconds)
  if (error) {
    console.error("[admin] sign profile photos", error.message)
    return urls
  }
  for (const entry of data ?? []) if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl)
  return urls
}

/**
 * Deletes every file in the account's avatars folder (its profile photo, and any leftover from an interrupted
 * upload) through the Storage API. Returns how many were removed; throws when Storage fails.
 */
export async function removeProfilePhotos(service: SupabaseClient, userId: string): Promise<number> {
  const bucket = service.storage.from(AVATARS_BUCKET)
  let removed = 0
  for (let round = 0; round < 20; round++) {
    const { data, error } = await bucket.list(userId, { limit: 100 })
    if (error) fail("list profile photos", error)
    const paths = (data ?? []).filter((f) => f.name && f.id !== null).map((f) => `${userId}/${f.name}`)
    if (!paths.length) return removed
    const { error: removeError } = await bucket.remove(paths)
    if (removeError) fail("remove profile photos", removeError)
    removed += paths.length
    if (paths.length < 100) return removed
  }
  return removed
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
  facts: { name: string; photoUrl?: string | null; isAdmin: boolean; stats: UserStats | undefined; selfId: string; now: Date }
): AdminUserRow {
  return {
    id: user.id,
    email: user.email ?? "",
    name: facts.name,
    photo_url: facts.photoUrl ?? null,
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
  const [users, profiles, admins] = await Promise.all([listAllAuthUsers(service), loadProfiles(service), loadAdminIds(service)])
  const needle = (query.query ?? "").trim().toLowerCase()
  const nameOf = (id: string) => profiles.get(id)?.name ?? ""
  const matching = users
    .filter((user) => !query.status || userStatus(user, now) === query.status)
    .filter((user) => !needle || (user.email ?? "").toLowerCase().includes(needle) || nameOf(user.id).toLowerCase().includes(needle))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || (a.email ?? "").localeCompare(b.email ?? ""))

  const page = Math.max(1, query.page ?? 1)
  const slice = matching.slice((page - 1) * USERS_PAGE_SIZE, page * USERS_PAGE_SIZE)
  const avatars = slice.map((user) => profiles.get(user.id)?.avatar).filter((path): path is string => Boolean(path))
  const [stats, photos] = await Promise.all([
    loadStats(
      service,
      slice.map((user) => user.id)
    ),
    signPhotoUrls(service, avatars),
  ])
  return {
    items: slice.map((user) => {
      const avatar = profiles.get(user.id)?.avatar
      return toUserRow(user, {
        name: nameOf(user.id),
        photoUrl: avatar ? (photos.get(avatar) ?? null) : null,
        isAdmin: admins.has(user.id),
        stats: stats.get(user.id),
        selfId,
        now,
      })
    }),
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
  const [profiles, admins, stats] = await Promise.all([loadProfiles(service, [user.id]), loadAdminIds(service), loadStats(service, [user.id])])
  const profile = profiles.get(user.id)
  const photos = await signPhotoUrls(service, profile?.avatar ? [profile.avatar] : [])
  return toUserRow(user, {
    name: profile?.name ?? "",
    photoUrl: profile?.avatar ? (photos.get(profile.avatar) ?? null) : null,
    isAdmin: admins.has(user.id),
    stats: stats.get(user.id),
    selfId,
    now,
  })
}

/** GoTrue's answer when an email already belongs to a confirmed account. */
export function isEmailTaken(error: { message?: string; code?: string; status?: number }): boolean {
  return error.code === "email_exists" || error.code === "user_already_exists" || /already (been )?registered/i.test(error.message ?? "")
}
