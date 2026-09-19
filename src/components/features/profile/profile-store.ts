"use client"

/**
 * Profiles in the browser: one client per session (online, local or the dev fixture — `<ProfilesSync />` in the
 * app shell picks it), your own profile, a cache of other people's profiles and a cache of photo URLs.
 *
 * - `useMyProfile()` — your profile (Settings → Profile, the account menu).
 * - `useProfiles(ids)` / `useProfile(id)` — profiles you may see, batched into one `get_profiles()` call; missing
 *   ids come back `null` (not connected, or no account). Team workspaces reuse these for their member lists.
 * - `usePhotoUrl(path)` — a signed URL (online, ~1 hour, re-signed 5 minutes before it expires) or a local data URL.
 *
 * Rule: selectors return stored references only (zustand 5: no new objects from a selector).
 */
import { useEffect, useMemo } from "react"
import { create } from "zustand"
import { publicViewOf, type EncodedPhoto, type MyProfile, type PhotoUrl, type ProfilePatch, type ProfilesApi, type PublicProfile } from "@/lib/profiles/types"
import type { ID, PlatformId } from "@/lib/types"

/** Other people's profiles are refreshed after this long (ms); photo URLs this long before they expire. */
const PROFILE_TTL_MS = 10 * 60 * 1000
const PHOTO_REFRESH_MS = 5 * 60 * 1000

export type MyProfileStatus = "idle" | "loading" | "ready" | "error"

interface CachedProfile {
  /** null = not visible to you (not connected) or no such account. */
  profile: PublicProfile | null
  loadedAt: number
}

export interface ProfilesState {
  api: ProfilesApi | null
  apiKey: string
  me: MyProfile | null
  meStatus: MyProfileStatus
  meError: unknown
  profiles: Record<ID, CachedProfile>
  photos: Record<string, PhotoUrl>
}

const INITIAL: ProfilesState = { api: null, apiKey: "", me: null, meStatus: "idle", meError: null, profiles: {}, photos: {} }

export const useProfilesStore = create<ProfilesState>(() => ({ ...INITIAL }))

const pendingIds = new Set<ID>()
const inflightIds = new Set<ID>()
const pendingPaths = new Set<string>()
const inflightPaths = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
/** Brand HQ for your own public view (niche + main platform); set by `<ProfilesSync />`. */
export type BrandForProfile = () => { niche: string; main_platforms: PlatformId[] } | null
let brandOf: BrandForProfile = () => null

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushProfiles()
    void flushPhotos()
  }, 0)
}

async function flushProfiles() {
  const { api, apiKey } = useProfilesStore.getState()
  const ids = [...pendingIds].filter((id) => !inflightIds.has(id))
  pendingIds.clear()
  if (!api || !ids.length) return
  ids.forEach((id) => inflightIds.add(id))
  try {
    const found = await api.getProfiles(ids)
    if (useProfilesStore.getState().apiKey !== apiKey) return
    const at = Date.now()
    const byId = new Map(found.map((p) => [p.id, p]))
    useProfilesStore.setState((s) => {
      const profiles = { ...s.profiles }
      for (const id of ids) profiles[id] = { profile: byId.get(id) ?? null, loadedAt: at }
      return { profiles }
    })
  } catch {
    // Keep what's cached (or nothing): avatars fall back to initials, and the next render asks again.
  } finally {
    ids.forEach((id) => inflightIds.delete(id))
  }
}

async function flushPhotos() {
  const { api, apiKey } = useProfilesStore.getState()
  const paths = [...pendingPaths].filter((p) => !inflightPaths.has(p))
  pendingPaths.clear()
  if (!api || !paths.length) return
  paths.forEach((p) => inflightPaths.add(p))
  try {
    const urls = await api.photoUrls(paths)
    if (useProfilesStore.getState().apiKey !== apiKey) return
    // Paths you can't see (or files that are gone) are remembered as "" for a while, so they aren't re-asked every render.
    const missing: Record<string, PhotoUrl> = {}
    for (const path of paths) if (!urls[path]) missing[path] = { url: "", expiresAt: Date.now() + PROFILE_TTL_MS }
    useProfilesStore.setState((s) => ({ photos: { ...s.photos, ...missing, ...urls } }))
  } catch {
    // Initials until the next try.
  } finally {
    paths.forEach((p) => inflightPaths.delete(p))
  }
}

function isFresh(entry: CachedProfile | undefined, now: number): boolean {
  return Boolean(entry) && now - entry!.loadedAt < PROFILE_TTL_MS
}

function isUsable(url: PhotoUrl | undefined, now: number): boolean {
  if (!url) return false
  return url.url ? url.expiresAt - now > PHOTO_REFRESH_MS : url.expiresAt > now
}

/** After your own profile changes: keep showing the cache but refetch it (stale-while-revalidate). */
function markProfilesStale() {
  useProfilesStore.setState((s) => {
    const profiles: Record<ID, CachedProfile> = {}
    for (const [id, entry] of Object.entries(s.profiles)) profiles[id] = { ...entry, loadedAt: 0 }
    return { profiles }
  })
}

function setMe(me: MyProfile) {
  useProfilesStore.setState((s) => ({
    me,
    meStatus: "ready",
    meError: null,
    profiles: { ...s.profiles, [me.id]: { profile: publicViewOf(me, brandOf()), loadedAt: Date.now() } },
  }))
  markProfilesStale()
}

export const profileActions = {
  /** Switches the session's client (a new key resets every cache) and loads your profile. */
  connect(key: string, api: ProfilesApi, brand?: BrandForProfile) {
    if (brand) brandOf = brand
    if (useProfilesStore.getState().apiKey === key) return
    pendingIds.clear()
    pendingPaths.clear()
    useProfilesStore.setState({ ...INITIAL, api, apiKey: key })
    void profileActions.loadMe()
  },

  disconnect() {
    useProfilesStore.setState({ ...INITIAL })
  },

  async loadMe(): Promise<void> {
    const { api, apiKey } = useProfilesStore.getState()
    if (!api) return
    useProfilesStore.setState({ meStatus: "loading", meError: null })
    try {
      const me = await api.getMyProfile()
      if (useProfilesStore.getState().apiKey === apiKey) setMe(me)
    } catch (error) {
      if (useProfilesStore.getState().apiKey === apiKey) useProfilesStore.setState({ meStatus: "error", meError: error })
    }
  },

  /** Saves the profile fields. Throws a ProfileApiError on failure (the caller shows it). */
  async save(patch: ProfilePatch): Promise<MyProfile> {
    const api = requireApi()
    const me = await api.updateMyProfile(patch)
    setMe(me)
    return me
  },

  async setPhoto(photo: EncodedPhoto): Promise<MyProfile> {
    const api = requireApi()
    const me = await api.setPhoto(photo)
    setMe(me)
    return me
  },

  async removePhoto(): Promise<MyProfile> {
    const api = requireApi()
    const me = await api.removePhoto()
    setMe(me)
    return me
  },

  /** Asks for these profiles (batched with other requests in the same tick). `force` ignores the cache. */
  requestProfiles(ids: ID[], force = false) {
    const { profiles } = useProfilesStore.getState()
    const now = Date.now()
    let added = false
    for (const id of ids) {
      if (!id || inflightIds.has(id) || (!force && isFresh(profiles[id], now))) continue
      pendingIds.add(id)
      added = true
    }
    if (added) scheduleFlush()
  },

  requestPhotos(paths: string[]) {
    const { photos } = useProfilesStore.getState()
    const now = Date.now()
    let added = false
    for (const path of paths) {
      if (!path || inflightPaths.has(path) || isUsable(photos[path], now)) continue
      pendingPaths.add(path)
      added = true
    }
    if (added) scheduleFlush()
  },
}

function requireApi(): ProfilesApi {
  const api = useProfilesStore.getState().api
  if (!api) throw new Error("Profiles aren't ready yet.")
  return api
}

/* --------------------------------- hooks ---------------------------------- */

export function useMyProfile(): { me: MyProfile | null; status: MyProfileStatus; error: unknown; source: ProfilesApi["source"] | null } {
  const me = useProfilesStore((s) => s.me)
  const status = useProfilesStore((s) => s.meStatus)
  const error = useProfilesStore((s) => s.meError)
  const source = useProfilesStore((s) => s.api?.source ?? null)
  return { me, status, error, source }
}

/**
 * Profiles by id: a profile, `null` (not visible to you — not connected, or no account) or `undefined` (loading).
 * Pass a stable, sorted list where you can; the hook fetches whatever isn't cached or is stale.
 */
export function useProfiles(ids: readonly ID[]): Record<ID, PublicProfile | null | undefined> {
  const cache = useProfilesStore((s) => s.profiles)
  const ready = useProfilesStore((s) => s.api !== null)
  const key = ids.join(",")
  useEffect(() => {
    if (ready && key) profileActions.requestProfiles(key.split(","))
  }, [ready, key, cache])
  return useMemo(() => {
    const out: Record<ID, PublicProfile | null | undefined> = {}
    for (const id of key ? key.split(",") : []) out[id] = cache[id]?.profile
    return out
  }, [cache, key])
}

export function useProfile(id: ID | null | undefined): PublicProfile | null | undefined {
  const ids = useMemo(() => (id ? [id] : []), [id])
  const profiles = useProfiles(ids)
  return id ? profiles[id] : null
}

/** A URL to show a photo path (signed online, a data URL locally); null while loading or when not visible. */
export function usePhotoUrl(path: string | null | undefined): string | null {
  const entry = useProfilesStore((s) => (path ? s.photos[path] : undefined))
  const ready = useProfilesStore((s) => s.api !== null)
  useEffect(() => {
    if (ready && path) profileActions.requestPhotos([path])
  }, [ready, path, entry])
  return path && entry?.url ? entry.url : null
}
