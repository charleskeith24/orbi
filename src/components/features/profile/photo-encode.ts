"use client"

/**
 * Profile photos in the browser: check the file, open it, and re-encode the crop as a small square WebP
 * (JPEG where the browser can't write WebP). Drawing onto a canvas and encoding again keeps only the pixels,
 * so EXIF metadata — GPS location, camera, dates — never leaves the device. Browsers apply the EXIF rotation
 * when they decode, so the saved photo stays upright.
 */
import { cropRect, type CropState } from "@/lib/profiles/crop"
import { PROFILE_LIMITS, ProfileApiError, type EncodedPhoto } from "@/lib/profiles/types"

export type PhotoProblem = "not_image" | "too_large" | "heic_unsupported" | "decode_failed"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const HEIC = /^image\/hei[cf](-sequence)?$/
/** What the file picker offers. HEIC is listed so iPhone photos can be picked; not every browser can open them. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"

function isHeic(file: File): boolean {
  return HEIC.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

/** Why a picked file can't be used before even opening it, or null. */
export function checkPhotoFile(file: File): PhotoProblem | null {
  const known = ACCEPTED_TYPES.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name))
  if (!known && !isHeic(file)) return "not_image"
  if (file.size > PROFILE_LIMITS.uploadBytes) return "too_large"
  return null
}

export interface LoadedPhoto {
  image: HTMLImageElement
  width: number
  height: number
  /** Frees the object URL. */
  release: () => void
}

/** Opens the file as an image (EXIF rotation applied). HEIC works only where the browser can decode it. */
export async function loadPhoto(file: File): Promise<LoadedPhoto> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = "async"
  image.src = url
  try {
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("empty image")
  } catch {
    URL.revokeObjectURL(url)
    throw new ProfileApiError(isHeic(file) ? "heic_unsupported" : "decode_failed")
  }
  return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality))
}

function draw(photo: LoadedPhoto, crop: CropState, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new ProfileApiError("decode_failed")
  // Transparent PNGs get a white background (JPEG has no transparency). Image pixels, not a UI color.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  const { sx, sy, side } = cropRect(photo.width, photo.height, crop)
  ctx.drawImage(photo.image, sx, sy, side, side, 0, 0, size, size)
  return canvas
}

/**
 * The crop as a `size`×`size` WebP (JPEG fallback), at the best quality that fits `maxBytes`. For local mode's
 * ~60 KB it also steps the size down (256 → 192 → 160) before giving up.
 */
export async function encodePhoto(photo: LoadedPhoto, crop: CropState, options: { size: number; maxBytes: number }): Promise<EncodedPhoto> {
  const sizes = [options.size, Math.round(options.size * 0.75), Math.round(options.size * 0.625)]
  for (const size of sizes) {
    const canvas = draw(photo, crop, size)
    for (const type of ["image/webp", "image/jpeg"] as const) {
      for (const quality of [0.86, 0.76, 0.64, 0.5]) {
        const blob = await toBlob(canvas, type, quality)
        // Browsers that can't write WebP return a PNG instead: skip to JPEG.
        if (!blob || blob.type !== type) break
        if (blob.size <= options.maxBytes) return { blob, type, size: blob.size }
      }
    }
  }
  // Practically unreachable (a 160 px photo at low quality is a few KB): treat it as a photo we couldn't use.
  throw new ProfileApiError("decode_failed")
}

/** Online: 512×512 in the avatars bucket (limit 1 MB). Local mode (and the dev fixture): 256×256, ≤ 60 KB. */
export function photoTarget(source: "live" | "local" | "fixture"): { size: number; maxBytes: number } {
  return source === "live"
    ? { size: PROFILE_LIMITS.photoSize, maxBytes: 900 * 1024 }
    : { size: PROFILE_LIMITS.localPhotoSize, maxBytes: PROFILE_LIMITS.localPhotoBytes }
}
