/**
 * The photo cropper's math: a square window over the source image, moved by dragging and sized by zoom.
 * Pure (source pixels in, source pixels out) so it's tested without a browser; `features/profile` draws it.
 *
 * - zoom 1 = the largest square that fits (the image's short side); zoom 4 = a quarter of that.
 * - The window never leaves the image: the center is clamped after every pan and zoom.
 * - The output is always a `size`×`size` square (512 online, 256 locally), resampled by the canvas.
 */

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

export interface CropState {
  zoom: number
  /** Center of the square window, in source pixels. */
  cx: number
  cy: number
}

export interface CropRect {
  sx: number
  sy: number
  /** Side of the square window, in source pixels. */
  side: number
}

function assertSize(width: number, height: number) {
  if (!(width > 0 && height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`Invalid image size ${width}×${height}`)
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** The square window's side in source pixels at this zoom. */
export function cropSide(width: number, height: number, zoom: number): number {
  assertSize(width, height)
  return Math.min(width, height) / clampZoom(zoom)
}

/** Centered, zoom 1: the largest centered square. */
export function initialCrop(width: number, height: number): CropState {
  assertSize(width, height)
  return { zoom: MIN_ZOOM, cx: width / 2, cy: height / 2 }
}

/** Zoom within 1–4 and the center moved just enough for the window to stay inside the image. */
export function clampCrop(width: number, height: number, state: CropState): CropState {
  const zoom = clampZoom(state.zoom)
  const half = cropSide(width, height, zoom) / 2
  const clamp = (value: number, min: number, max: number) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : (min + max) / 2)
  return { zoom, cx: clamp(state.cx, half, width - half), cy: clamp(state.cy, half, height - half) }
}

/** The source rectangle to draw into the output square. */
export function cropRect(width: number, height: number, state: CropState): CropRect {
  const { zoom, cx, cy } = clampCrop(width, height, state)
  const side = cropSide(width, height, zoom)
  return { sx: cx - side / 2, sy: cy - side / 2, side }
}

/**
 * A drag of (dx, dy) screen pixels inside a `viewport`-pixel-wide preview. Dragging right shows more of the
 * left of the photo, so the window's center moves the other way.
 */
export function panCrop(width: number, height: number, state: CropState, dx: number, dy: number, viewport: number): CropState {
  const current = clampCrop(width, height, state)
  const perPixel = cropSide(width, height, current.zoom) / Math.max(1, viewport)
  return clampCrop(width, height, { ...current, cx: current.cx - dx * perPixel, cy: current.cy - dy * perPixel })
}

/** A new zoom around the current center (clamped). */
export function zoomCrop(width: number, height: number, state: CropState, zoom: number): CropState {
  return clampCrop(width, height, { ...state, zoom })
}

/**
 * How to draw the source image in a `viewport`-pixel square preview so it shows exactly the window:
 * `transform: translate(x, y) scale(scale)` with `transform-origin: 0 0` on the full-size image.
 */
export function previewTransform(width: number, height: number, state: CropState, viewport: number): { scale: number; x: number; y: number } {
  const { sx, sy, side } = cropRect(width, height, state)
  const scale = viewport / side
  return { scale, x: -sx * scale, y: -sy * scale }
}
