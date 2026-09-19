/**
 * Where a profile photo lives in the private `avatars` bucket: `<user id>/<random>.webp|jpg` — the shape the
 * storage policies and the `users_avatar_url_check` CHECK accept (20260920000000_profiles.sql). A fresh random
 * name per upload, so a replaced photo is a new object and an old signed URL never shows the new one.
 */
import type { EncodedPhoto } from "./types"

export const AVATARS_BUCKET = "avatars"

const NAME = /^[A-Za-z0-9_-]{16,64}\.(webp|jpg)$/

function randomName(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function newAvatarPath(userId: string, type: EncodedPhoto["type"]): string {
  return `${userId}/${randomName()}.${type === "image/webp" ? "webp" : "jpg"}`
}

/** Whether `path` is a photo path inside `userId`'s own folder. */
export function isAvatarPath(path: string | null | undefined, userId: string): path is string {
  if (!path || !path.startsWith(`${userId}/`)) return false
  return NAME.test(path.slice(userId.length + 1))
}

/** The user id a photo path belongs to (its folder), or null. */
export function avatarOwner(path: string): string | null {
  const [folder, name, ...rest] = path.split("/")
  return folder && name && !rest.length && NAME.test(name) ? folder : null
}
