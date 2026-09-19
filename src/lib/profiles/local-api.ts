/**
 * Local mode (no accounts): the profile is kept for THIS DEVICE ONLY in localStorage (`pbos:local-profile`),
 * with the photo as a small WebP/JPEG data URL (≤ 60 KB, re-encoded in the browser like online, so no EXIF).
 * Nobody else can see it — there's nobody to connect with — so `getProfiles` answers only for yourself.
 * The same rules as the database: limits, one-line text and valid links.
 */
import type { ID, PlatformId } from "@/lib/types"
import { cleanStoredLinks, isStoredLinks } from "./links"
import { cleanLine } from "./profile"
import {
  emptyProfile,
  PROFILE_LIMITS,
  ProfileApiError,
  publicViewOf,
  toProfileError,
  type EncodedPhoto,
  type MyProfile,
  type PhotoUrl,
  type ProfilePatch,
  type ProfilesApi,
} from "./types"

export const LOCAL_PROFILE_KEY = "pbos:local-profile"
/** Photo "paths" in local mode: `local:<key>`, a new key per photo so caches never show an old one. */
export const LOCAL_PHOTO_PREFIX = "local:"

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

interface StoredLocalProfile {
  version: 1
  display_name: string
  headline: string
  location: string
  links: unknown
  show_niche: boolean
  /** Data URL. */
  photo: string | null
  photo_key: string | null
}

export interface LocalProfilesOptions {
  self: ID
  /** Defaults to window.localStorage; null when it's unavailable (private mode, blocked). */
  storage?: StorageLike | null
  /** Brand HQ's niche and main platforms, for "Show my niche and main platform". */
  brand?: () => { niche: string; main_platforms: PlatformId[] } | null
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

/** Blob → data URL without FileReader (works in the browser and in tests). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`
}

function randomKey(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

const isPhotoDataUrl = (value: unknown): value is string => typeof value === "string" && /^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)

export function createLocalProfilesApi(options: LocalProfilesOptions): ProfilesApi {
  const self = options.self
  const storage = options.storage === undefined ? defaultStorage() : options.storage

  function read(): StoredLocalProfile | null {
    try {
      const raw = storage?.getItem(LOCAL_PROFILE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<StoredLocalProfile>
      return parsed && typeof parsed === "object" ? (parsed as StoredLocalProfile) : null
    } catch {
      return null
    }
  }

  /** What's stored, cleaned to the same rules as the database (a hand-edited value can't break the UI). */
  function current(): MyProfile & { photo: string | null } {
    const stored = read()
    const text = (value: unknown, max: number) => (typeof value === "string" ? cleanLine(value).slice(0, max).trim() : "")
    const photo = isPhotoDataUrl(stored?.photo) ? stored.photo : null
    const key = typeof stored?.photo_key === "string" && /^[0-9a-f]{16}$/.test(stored.photo_key) ? stored.photo_key : null
    return {
      ...emptyProfile(self),
      display_name: text(stored?.display_name, PROFILE_LIMITS.displayName),
      headline: text(stored?.headline, PROFILE_LIMITS.headline),
      location: text(stored?.location, PROFILE_LIMITS.location),
      links: cleanStoredLinks(stored?.links),
      show_niche: stored?.show_niche === true,
      avatar_path: photo && key ? `${LOCAL_PHOTO_PREFIX}${key}` : null,
      photo: photo && key ? photo : null,
    }
  }

  function write(profile: MyProfile & { photo: string | null }) {
    if (!storage) throw new ProfileApiError("storage_full", "This browser doesn't allow saving here.")
    const value: StoredLocalProfile = {
      version: 1,
      display_name: profile.display_name,
      headline: profile.headline,
      location: profile.location,
      links: profile.links,
      show_niche: profile.show_niche,
      photo: profile.photo,
      photo_key: profile.avatar_path?.startsWith(LOCAL_PHOTO_PREFIX) ? profile.avatar_path.slice(LOCAL_PHOTO_PREFIX.length) : null,
    }
    try {
      storage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(value))
    } catch (error) {
      throw toProfileError(error)
    }
  }

  const strip = (profile: MyProfile & { photo: string | null }): MyProfile => ({
    id: profile.id,
    display_name: profile.display_name,
    avatar_path: profile.avatar_path,
    headline: profile.headline,
    location: profile.location,
    links: profile.links,
    show_niche: profile.show_niche,
  })

  return {
    self,
    source: "local",

    async getMyProfile() {
      return strip(current())
    },

    async updateMyProfile(patch: ProfilePatch) {
      const next = { ...current() }
      if (patch.display_name !== undefined) next.display_name = cleanLine(patch.display_name)
      if (patch.headline !== undefined) next.headline = cleanLine(patch.headline)
      if (patch.location !== undefined) next.location = cleanLine(patch.location)
      if (patch.links !== undefined) next.links = patch.links
      if (patch.show_niche !== undefined) next.show_niche = patch.show_niche
      if (
        next.display_name.length > PROFILE_LIMITS.displayName ||
        next.headline.length > PROFILE_LIMITS.headline ||
        next.location.length > PROFILE_LIMITS.location ||
        !isStoredLinks(next.links)
      ) {
        throw new ProfileApiError("invalid")
      }
      write(next)
      return strip(next)
    },

    async setPhoto(photo: EncodedPhoto) {
      if (photo.type !== "image/webp" && photo.type !== "image/jpeg") throw new ProfileApiError("not_image")
      if (photo.size > PROFILE_LIMITS.localPhotoBytes) throw new ProfileApiError("too_large")
      const dataUrl = await blobToDataUrl(new Blob([photo.blob], { type: photo.type }))
      const next = { ...current(), photo: dataUrl, avatar_path: `${LOCAL_PHOTO_PREFIX}${randomKey()}` }
      write(next)
      return strip(next)
    },

    async removePhoto() {
      const next = { ...current(), photo: null, avatar_path: null }
      write(next)
      return strip(next)
    },

    async getProfiles(ids: ID[]) {
      if (!ids.includes(self)) return []
      return [publicViewOf(strip(current()), options.brand?.() ?? null)]
    },

    async photoUrls(paths: string[]) {
      const now = current()
      const out: Record<string, PhotoUrl> = {}
      for (const path of paths) if (now.avatar_path && path === now.avatar_path && now.photo) out[path] = { url: now.photo, expiresAt: Infinity }
      return out
    },
  }
}
