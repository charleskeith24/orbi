/**
 * Profiles — the client contract (docs/PROFILES.md, ARCHITECTURE §16).
 *
 * A profile belongs to the PERSON using Orbi (their account), not to the brand (Brand HQ). Rows mirror
 * `supabase/migrations/20260920000000_profiles.sql`: your own profile is your `public.users` row without the
 * email; other people's come from `get_profiles()`, which answers only for yourself and connected people
 * (circle-mates; team members when team workspaces ship) and never returns an email.
 *
 * Implementations of `ProfilesApi`:
 * - online: the browser Supabase client (`features/profile/api/supabase-api.ts`) — RLS, `get_profiles()` and the
 *   private `avatars` bucket through signed URLs;
 * - local mode: this browser's localStorage (`./local-api.ts`, `pbos:local-profile`) — you only;
 * - dev only: the sample profiles behind the Circles fixture (`./fixture-api.ts`).
 */
import type { ID, PlatformId } from "@/lib/types"

/** Limits the database enforces (CHECKs on public.users, the avatars bucket) plus the upload rules. */
export const PROFILE_LIMITS = {
  displayName: 80,
  headline: 160,
  location: 80,
  links: 6,
  /** A link's URL, http(s) only. */
  linkUrl: 200,
  /** A platform handle, without "@". */
  handle: 64,
  /** The file a creator picks, before cropping and re-encoding. */
  uploadBytes: 5 * 1024 * 1024,
  /** Online: the square photo stored in the avatars bucket (bucket limit: 1 MB). */
  photoSize: 512,
  /** Local mode: the photo kept in localStorage as a data URL. */
  localPhotoSize: 256,
  localPhotoBytes: 60 * 1024,
  /** Signed URLs for photos live this long (seconds) and are re-signed a few minutes before they expire. */
  signedUrlSeconds: 3600,
  /** get_profiles() answers at most this many ids per call. */
  idsPerCall: 200,
} as const

export type ProfileLinkPlatform = PlatformId | "website"

/** One social handle or link: a handle without "@" (platforms only) or an http(s) URL. */
export interface ProfileLink {
  platform: ProfileLinkPlatform
  value: string
}

/** Your own profile: your `public.users` row minus the email. */
export interface MyProfile {
  id: ID
  /** `public.users.full_name`; may be empty. */
  display_name: string
  /** A path in the avatars bucket (online) or a local key; null = initials. Never a URL. */
  avatar_path: string | null
  headline: string
  location: string
  links: ProfileLink[]
  /** Show Brand HQ's niche and main platform to connected people. */
  show_niche: boolean
}

/** Someone's profile as `get_profiles()` returns it: the safe columns only, never an email. */
export interface PublicProfile {
  id: ID
  display_name: string
  avatar_path: string | null
  headline: string
  location: string
  links: ProfileLink[]
  /** Brand HQ's niche — only when that person turned on "Show my niche and main platform". */
  niche: string | null
  main_platform: PlatformId | null
}

/** What Settings → Profile saves (the photo has its own calls). */
export type ProfilePatch = Partial<Pick<MyProfile, "display_name" | "headline" | "location" | "links" | "show_niche">>

/** A photo already cropped, resized and re-encoded in the browser (which strips EXIF, GPS included). */
export interface EncodedPhoto {
  blob: Blob
  type: "image/webp" | "image/jpeg"
  size: number
}

export interface PhotoUrl {
  url: string
  /** Epoch ms; `Infinity` for local data URLs. */
  expiresAt: number
}

export type ProfilesSource = "live" | "local" | "fixture"

export interface ProfilesApi {
  readonly self: ID
  readonly source: ProfilesSource
  getMyProfile(): Promise<MyProfile>
  updateMyProfile(patch: ProfilePatch): Promise<MyProfile>
  /** Stores the photo and makes it the profile photo; the previous one is deleted. */
  setPhoto(photo: EncodedPhoto): Promise<MyProfile>
  /** Back to initials; the stored photo is deleted. */
  removePhoto(): Promise<MyProfile>
  /** Profiles you may see (yourself and connected people); others are simply missing. */
  getProfiles(ids: ID[]): Promise<PublicProfile[]>
  /** Short-lived URLs for photo paths you may see; missing when you can't (or the file is gone). */
  photoUrls(paths: string[]): Promise<Record<string, PhotoUrl>>
}

export const PROFILE_ERROR_CODES = [
  "not_signed_in",
  "invalid",
  "not_image",
  "too_large",
  "heic_unsupported",
  "decode_failed",
  "storage_full",
  "network",
  "unknown",
] as const

export type ProfileErrorCode = (typeof PROFILE_ERROR_CODES)[number]

export class ProfileApiError extends Error {
  readonly code: ProfileErrorCode

  constructor(code: ProfileErrorCode, message?: string) {
    super(message || code)
    this.name = "ProfileApiError"
    this.code = code
  }
}

/** Any failure → ProfileApiError: CHECK/RLS violations are `invalid`, dropped connections `network`. */
export function toProfileError(error: unknown): ProfileApiError {
  if (error instanceof ProfileApiError) return error
  const e = (error ?? {}) as { message?: unknown; code?: unknown; name?: unknown; statusCode?: unknown }
  const message = typeof e.message === "string" ? e.message : String(error)
  const code = typeof e.code === "string" ? e.code : ""
  if (e.name === "QuotaExceededError" || /quota/i.test(message)) return new ProfileApiError("storage_full", message)
  if (/^23/.test(code) || code === "42501" || /row-level security|violates|payload too large|mime type/i.test(message) || String(e.statusCode) === "413") {
    return new ProfileApiError("invalid", message)
  }
  if (error instanceof TypeError || /failed to fetch|network|load failed/i.test(message)) return new ProfileApiError("network", message)
  return new ProfileApiError("unknown", message)
}

/** The public view of your own profile — what connected people get from get_profiles(). */
export function publicViewOf(profile: MyProfile, brand: { niche: string; main_platforms: PlatformId[] } | null): PublicProfile {
  const niche = profile.show_niche && brand ? brand.niche.trim().slice(0, 160).trim() : ""
  return {
    id: profile.id,
    display_name: profile.display_name,
    avatar_path: profile.avatar_path,
    headline: profile.headline,
    location: profile.location,
    links: profile.links.map((l) => ({ ...l })),
    niche: niche || null,
    main_platform: profile.show_niche && brand ? (brand.main_platforms[0] ?? null) : null,
  }
}

export function emptyProfile(id: ID): MyProfile {
  return { id, display_name: "", avatar_path: null, headline: "", location: "", links: [], show_niche: false }
}
