/**
 * `ProfilesApi` over the browser Supabase client (online version). No API routes and no secret key — the
 * database and Storage enforce every rule (supabase/migrations/20260920000000_profiles.sql):
 * - your own profile: your `public.users` row, always selected by column — never the email;
 * - other people's: `get_profiles()`, which answers only for yourself and connected people;
 * - photos: the private `avatars` bucket at `<your id>/<random>.webp|jpg`, shown through signed URLs (1 hour).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isProfileLinkPlatform, cleanStoredLinks } from "@/lib/profiles/links"
import { AVATARS_BUCKET, isAvatarPath, newAvatarPath } from "@/lib/profiles/photo-path"
import {
  PROFILE_LIMITS,
  ProfileApiError,
  toProfileError,
  type EncodedPhoto,
  type MyProfile,
  type PhotoUrl,
  type ProfilePatch,
  type ProfilesApi,
  type PublicProfile,
} from "@/lib/profiles/types"
import type { ID, PlatformId } from "@/lib/types"

/** Your own row's profile columns. Listed on purpose: `public.users` also holds the email, never selected here. */
export const MY_PROFILE_COLUMNS = "id, full_name, avatar_url, headline, location, links, show_niche"

interface Result<T> {
  data: T | null
  error: unknown
}

async function run<T>(request: PromiseLike<Result<T>>): Promise<T> {
  let result: Result<T>
  try {
    result = await request
  } catch (error) {
    throw toProfileError(error)
  }
  if (result.error) throw toProfileError(result.error)
  return result.data as T
}

interface UserRow {
  id: string
  full_name: string | null
  avatar_url: string | null
  headline: string | null
  location: string | null
  links: unknown
  show_niche: boolean | null
}

interface ProfileRow {
  id: string
  display_name: string | null
  avatar_path: string | null
  headline: string | null
  location: string | null
  links: unknown
  niche: string | null
  main_platform: string | null
}

function toMyProfile(row: UserRow): MyProfile {
  return {
    id: row.id,
    display_name: row.full_name ?? "",
    avatar_path: isAvatarPath(row.avatar_url, row.id) ? row.avatar_url : null,
    headline: row.headline ?? "",
    location: row.location ?? "",
    links: cleanStoredLinks(row.links),
    show_niche: row.show_niche === true,
  }
}

function toPublicProfile(row: ProfileRow): PublicProfile {
  const platform = row.main_platform
  return {
    id: row.id,
    display_name: row.display_name ?? "",
    avatar_path: isAvatarPath(row.avatar_path, row.id) ? row.avatar_path : null,
    headline: row.headline ?? "",
    location: row.location ?? "",
    links: cleanStoredLinks(row.links),
    niche: row.niche?.trim() || null,
    main_platform: platform && isProfileLinkPlatform(platform) && platform !== "website" ? (platform as PlatformId) : null,
  }
}

export function createSupabaseProfilesApi(supabase: SupabaseClient, self: ID, options: { now?: () => number } = {}): ProfilesApi {
  const now = options.now ?? (() => Date.now())
  const bucket = () => supabase.storage.from(AVATARS_BUCKET)

  async function readMine(): Promise<MyProfile> {
    const rows = await run<UserRow[]>(supabase.from("users").select(MY_PROFILE_COLUMNS).eq("id", self))
    if (!rows?.length) throw new ProfileApiError("not_signed_in")
    return toMyProfile(rows[0])
  }

  async function writeMine(values: Record<string, unknown>): Promise<MyProfile> {
    const rows = await run<UserRow[]>(supabase.from("users").update(values).eq("id", self).select(MY_PROFILE_COLUMNS))
    if (!rows?.length) throw new ProfileApiError("not_signed_in")
    return toMyProfile(rows[0])
  }

  /** Deletes every photo in your folder except `keep` — the old photo, and any left by an interrupted upload. */
  async function removeOtherPhotos(keep: string | null): Promise<void> {
    try {
      const { data, error } = await bucket().list(self, { limit: 100 })
      if (error || !data) return
      const stale = data.map((f) => `${self}/${f.name}`).filter((path) => path !== keep && isAvatarPath(path, self))
      if (stale.length) await bucket().remove(stale)
    } catch {
      // Best effort: the photo is already off the profile, and the next change tries again.
    }
  }

  return {
    self,
    source: "live",

    getMyProfile: readMine,

    async updateMyProfile(patch: ProfilePatch) {
      const values: Record<string, unknown> = {}
      if (patch.display_name !== undefined) values.full_name = patch.display_name
      if (patch.headline !== undefined) values.headline = patch.headline
      if (patch.location !== undefined) values.location = patch.location
      if (patch.links !== undefined) values.links = patch.links
      if (patch.show_niche !== undefined) values.show_niche = patch.show_niche
      if (!Object.keys(values).length) return readMine()
      return writeMine(values)
    },

    async setPhoto(photo: EncodedPhoto) {
      if (photo.type !== "image/webp" && photo.type !== "image/jpeg") throw new ProfileApiError("not_image")
      const path = newAvatarPath(self, photo.type)
      await run(bucket().upload(path, photo.blob, { contentType: photo.type, cacheControl: "3600", upsert: false }))
      let profile: MyProfile
      try {
        profile = await writeMine({ avatar_url: path })
      } catch (error) {
        await bucket().remove([path]).catch(() => undefined)
        throw error
      }
      await removeOtherPhotos(path)
      return profile
    },

    async removePhoto() {
      const profile = await writeMine({ avatar_url: null })
      await removeOtherPhotos(null)
      return profile
    },

    async getProfiles(ids: ID[]) {
      const unique = [...new Set(ids)].filter(Boolean)
      const out: PublicProfile[] = []
      for (let i = 0; i < unique.length; i += PROFILE_LIMITS.idsPerCall) {
        const rows = await run<ProfileRow[]>(supabase.rpc("get_profiles", { p_ids: unique.slice(i, i + PROFILE_LIMITS.idsPerCall) }))
        for (const row of rows ?? []) out.push(toPublicProfile(row))
      }
      return out
    },

    async photoUrls(paths: string[]) {
      const unique = [...new Set(paths)].filter(Boolean)
      if (!unique.length) return {}
      const issued = now()
      const data = await run<{ path: string | null; signedUrl: string | null; error: string | null }[]>(
        bucket().createSignedUrls(unique, PROFILE_LIMITS.signedUrlSeconds)
      )
      const out: Record<string, PhotoUrl> = {}
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl && !entry.error) out[entry.path] = { url: entry.signedUrl, expiresAt: issued + PROFILE_LIMITS.signedUrlSeconds * 1000 }
      }
      return out
    },
  }
}
