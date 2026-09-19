/**
 * Profile links — what a creator types → what's stored → how it's shown. Pure; mirrors the database CHECK
 * `public.profile_links_valid()` (supabase/migrations/20260920000000_profiles.sql), and the PGlite test checks
 * the two agree.
 *
 * Stored value: an http(s) URL (≤ 200 characters), or — for a platform — a handle without "@" (≤ 64 of
 * A–Z, 0–9, ".", "_", "-"). A website must be a URL.
 */
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import type { PlatformId } from "@/lib/types"
import { PROFILE_LIMITS, type ProfileLink, type ProfileLinkPlatform } from "./types"

export const PROFILE_LINK_PLATFORMS: ProfileLinkPlatform[] = [...PLATFORM_IDS, "website"]

export type LinkError = "empty" | "url" | "handle" | "too_long"

const HANDLE = /^[A-Za-z0-9._-]{1,64}$/
/** Same character rule as the CHECK: no whitespace, control characters, < > or ". */
const STORED_URL = /^https?:\/\/[^\s\u0000-\u001f\u007f<>"]+$/
const SCHEME = /^[a-z][a-z0-9+.-]*:/i

export function isProfileLinkPlatform(value: unknown): value is ProfileLinkPlatform {
  return typeof value === "string" && (PROFILE_LINK_PLATFORMS as string[]).includes(value)
}

/** Whether a stored value passes the database CHECK for this platform (exactly the SQL rule). */
export function isStoredLinkValue(platform: ProfileLinkPlatform, value: string): boolean {
  if (value.length <= PROFILE_LIMITS.linkUrl && STORED_URL.test(value)) return true
  return platform !== "website" && HANDLE.test(value)
}

/** Whether a whole `links` value would pass the CHECK. */
export function isStoredLinks(value: unknown): value is ProfileLink[] {
  if (!Array.isArray(value) || value.length > PROFILE_LIMITS.links) return false
  return value.every(
    (link) =>
      link !== null &&
      typeof link === "object" &&
      !Array.isArray(link) &&
      Object.keys(link).length === 2 &&
      isProfileLinkPlatform((link as ProfileLink).platform) &&
      typeof (link as ProfileLink).value === "string" &&
      isStoredLinkValue((link as ProfileLink).platform, (link as ProfileLink).value)
  )
}

function asUrl(raw: string): string | null {
  const withScheme = SCHEME.test(raw) ? raw : `https://${raw}`
  // Lower-case the scheme ("HTTPS://" → "https://"); anything but http(s) is refused.
  const normalized = withScheme.replace(SCHEME, (s) => s.toLowerCase())
  if (!/^https?:\/\//.test(normalized)) return null
  try {
    const url = new URL(normalized)
    if (!url.hostname.includes(".") || url.hostname.startsWith(".") || url.hostname.endsWith(".")) return null
  } catch {
    return null
  }
  return STORED_URL.test(normalized) ? normalized : null
}

/** A value that should be read as a URL rather than a handle: a scheme, "www." or a path. */
function looksLikeUrl(raw: string): boolean {
  return SCHEME.test(raw) || /^www\./i.test(raw) || raw.includes("/")
}

/**
 * What a creator typed → the stored link, or why it can't be stored.
 * "@ana.travels" → handle `ana.travels` · "instagram.com/ana" → `https://instagram.com/ana` ·
 * a website without a scheme gets `https://`.
 */
export function normalizeProfileLink(platform: ProfileLinkPlatform, raw: string): { ok: true; link: ProfileLink } | { ok: false; error: LinkError } {
  const text = raw.trim()
  if (!text) return { ok: false, error: "empty" }
  if (platform === "website" || looksLikeUrl(text)) {
    const url = asUrl(text)
    if (!url) return { ok: false, error: "url" }
    if (url.length > PROFILE_LIMITS.linkUrl) return { ok: false, error: "too_long" }
    return { ok: true, link: { platform, value: url } }
  }
  const handle = text.replace(/^@+/, "")
  if (handle.length > PROFILE_LIMITS.handle) return { ok: false, error: "too_long" }
  if (!HANDLE.test(handle)) return { ok: false, error: "handle" }
  return { ok: true, link: { platform, value: handle } }
}

const PROFILE_URLS: Record<PlatformId, (handle: string) => string> = {
  facebook: (h) => `https://www.facebook.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  instagram: (h) => `https://www.instagram.com/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  linkedin: (h) => `https://www.linkedin.com/in/${h}`,
  x: (h) => `https://x.com/${h}`,
  threads: (h) => `https://www.threads.net/@${h}`,
}

/** Where a stored link opens: its URL, or the platform's profile page for a handle. Null if it isn't valid. */
export function profileLinkHref(link: ProfileLink): string | null {
  if (!isProfileLinkPlatform(link.platform) || typeof link.value !== "string") return null
  if (STORED_URL.test(link.value)) return link.value
  if (link.platform === "website" || !HANDLE.test(link.value)) return null
  return PROFILE_URLS[link.platform](link.value)
}

/** How a stored link reads: "@handle" (a plain name on Facebook and LinkedIn), or the URL without its scheme. */
export function profileLinkText(link: ProfileLink): string {
  if (STORED_URL.test(link.value)) return link.value.replace(/^https?:\/\//, "").replace(/\/$/, "")
  return link.platform === "facebook" || link.platform === "linkedin" ? link.value : `@${link.value}`
}

/** "Instagram", "Website". */
export function profileLinkPlatformLabel(platform: ProfileLinkPlatform, websiteLabel = "Website"): string {
  return platform === "website" ? websiteLabel : PLATFORMS[platform].label
}

/** Links as the stored JSON, dropping anything that isn't valid (e.g. from an old local profile). */
export function cleanStoredLinks(value: unknown): ProfileLink[] {
  if (!Array.isArray(value)) return []
  const out: ProfileLink[] = []
  for (const entry of value) {
    if (out.length >= PROFILE_LIMITS.links) break
    const link = entry as Partial<ProfileLink> | null
    if (!link || !isProfileLinkPlatform(link.platform) || typeof link.value !== "string") continue
    if (isStoredLinkValue(link.platform, link.value)) out.push({ platform: link.platform, value: link.value })
  }
  return out
}
