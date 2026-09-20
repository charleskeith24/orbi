/**
 * Settings → Profile's form rules: draft ⇄ profile, validation and the patch to save. Pure, shared by the
 * editor and the tests. Limits are the database CHECKs (./types PROFILE_LIMITS).
 */
import { initialsOf } from "@/lib/circles/names"
import { normalizeProfileLink, type LinkError } from "./links"
import { PROFILE_LIMITS, type MyProfile, type ProfileLink, type ProfileLinkPlatform, type ProfilePatch } from "./types"

export interface ProfileLinkDraft {
  /** Stable key for React lists. */
  key: string
  platform: ProfileLinkPlatform
  value: string
}

export interface ProfileDraft {
  display_name: string
  headline: string
  location: string
  links: ProfileLinkDraft[]
  show_niche: boolean
}

export type TextError = "too_long"

export interface ProfileDraftErrors {
  display_name?: TextError
  headline?: TextError
  location?: TextError
  /** By link key. */
  links?: Record<string, LinkError>
}

/** One line: control characters (tabs, pasted newlines) become spaces; trimmed. */
export function cleanLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim()
}

let keySeed = 0
export function newLinkKey(): string {
  keySeed += 1
  return `link-${keySeed}`
}

export function draftFromProfile(profile: MyProfile): ProfileDraft {
  return {
    display_name: profile.display_name,
    headline: profile.headline,
    location: profile.location,
    links: profile.links.map((link, i) => ({ key: `saved-${i}`, platform: link.platform, value: link.value })),
    show_niche: profile.show_niche,
  }
}

/** Errors to show under the fields. Rows with nothing typed are ignored (they're dropped on save). */
export function validateProfileDraft(draft: ProfileDraft): ProfileDraftErrors {
  const errors: ProfileDraftErrors = {}
  if (cleanLine(draft.display_name).length > PROFILE_LIMITS.displayName) errors.display_name = "too_long"
  if (cleanLine(draft.headline).length > PROFILE_LIMITS.headline) errors.headline = "too_long"
  if (cleanLine(draft.location).length > PROFILE_LIMITS.location) errors.location = "too_long"
  const linkErrors: Record<string, LinkError> = {}
  for (const link of draft.links) {
    if (!link.value.trim()) continue
    const result = normalizeProfileLink(link.platform, link.value)
    if (!result.ok) linkErrors[link.key] = result.error
  }
  if (Object.keys(linkErrors).length) errors.links = linkErrors
  return errors
}

export function hasErrors(errors: ProfileDraftErrors): boolean {
  return Boolean(errors.display_name || errors.headline || errors.location || (errors.links && Object.keys(errors.links).length))
}

/** The links as they'll be stored: empty rows dropped, handles and URLs normalized, at most 6. */
export function linksFromDraft(links: ProfileLinkDraft[]): ProfileLink[] {
  const out: ProfileLink[] = []
  for (const link of links) {
    if (!link.value.trim()) continue
    const result = normalizeProfileLink(link.platform, link.value)
    if (result.ok) out.push(result.link)
  }
  return out.slice(0, PROFILE_LIMITS.links)
}

/** The full patch for a valid draft (null when it has errors). */
export function patchFromDraft(draft: ProfileDraft): ProfilePatch | null {
  if (hasErrors(validateProfileDraft(draft))) return null
  return {
    display_name: cleanLine(draft.display_name),
    headline: cleanLine(draft.headline),
    location: cleanLine(draft.location),
    links: linksFromDraft(draft.links),
    show_niche: draft.show_niche,
  }
}

/** Whether saving the draft would change the profile. */
export function isDraftDirty(draft: ProfileDraft, profile: MyProfile): boolean {
  const patch = patchFromDraft(draft)
  const saved = draftFromProfile(profile)
  if (!patch) {
    return (
      draft.display_name !== saved.display_name ||
      draft.headline !== saved.headline ||
      draft.location !== saved.location ||
      draft.show_niche !== saved.show_niche ||
      JSON.stringify(draft.links.map(({ platform, value }) => [platform, value])) !== JSON.stringify(saved.links.map(({ platform, value }) => [platform, value]))
    )
  }
  return (
    patch.display_name !== profile.display_name ||
    patch.headline !== profile.headline ||
    patch.location !== profile.location ||
    patch.show_niche !== profile.show_niche ||
    JSON.stringify(patch.links) !== JSON.stringify(profile.links) ||
    // A typed-but-empty row is a change the Discard button should be able to undo.
    draft.links.length !== saved.links.length
  )
}

/** The name to show: the profile's, else a fallback (e.g. the email's local part, for your own menu only). */
export function profileName(displayName: string | null | undefined, fallback: string): string {
  const name = (displayName ?? "").trim()
  return name || fallback
}

/**
 * The first name for tight spots (the sidebar header): the first word, with a nickname in quotes skipped
 * ("Rafael \"Raf\" Mendoza" → "Rafael"). One-word names and handles come back unchanged.
 */
export function firstName(name: string): string {
  const first = cleanLine(name).split(/\s+/)[0] ?? ""
  return first.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "") || cleanLine(name)
}

/** Initials for an avatar without a photo. */
export function profileInitials(name: string): string {
  return initialsOf(name)
}
