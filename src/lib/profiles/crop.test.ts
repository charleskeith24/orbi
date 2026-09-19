import { describe, expect, it } from "vitest"
import { clampCrop, clampZoom, cropRect, cropSide, initialCrop, MAX_ZOOM, panCrop, previewTransform, zoomCrop } from "./crop"

describe("crop math", () => {
  it("starts with the largest centered square", () => {
    expect(initialCrop(1200, 800)).toEqual({ zoom: 1, cx: 600, cy: 400 })
    expect(cropRect(1200, 800, initialCrop(1200, 800))).toEqual({ sx: 200, sy: 0, side: 800 })
    expect(cropRect(600, 900, initialCrop(600, 900))).toEqual({ sx: 0, sy: 150, side: 600 })
    expect(cropRect(500, 500, initialCrop(500, 500))).toEqual({ sx: 0, sy: 0, side: 500 })
  })

  it("zooms between 1× and 4×, shrinking the window around its center", () => {
    expect(clampZoom(0.2)).toBe(1)
    expect(clampZoom(9)).toBe(MAX_ZOOM)
    expect(clampZoom(Number.NaN)).toBe(1)
    expect(cropSide(1200, 800, 2)).toBe(400)
    const zoomed = zoomCrop(1200, 800, initialCrop(1200, 800), 2)
    expect(cropRect(1200, 800, zoomed)).toEqual({ sx: 400, sy: 200, side: 400 })
  })

  it("keeps the window inside the image", () => {
    expect(clampCrop(1200, 800, { zoom: 1, cx: 0, cy: 0 })).toEqual({ zoom: 1, cx: 400, cy: 400 })
    expect(clampCrop(1200, 800, { zoom: 2, cx: 5000, cy: -50 })).toEqual({ zoom: 2, cx: 1000, cy: 200 })
    expect(clampCrop(1200, 800, { zoom: 2, cx: Number.NaN, cy: 300 })).toEqual({ zoom: 2, cx: 600, cy: 300 })
    // Zooming out near an edge pulls the center back in.
    expect(zoomCrop(1200, 800, { zoom: 4, cx: 1100, cy: 700 }, 1)).toEqual({ zoom: 1, cx: 800, cy: 400 })
  })

  it("pans the opposite way to the drag, in source pixels", () => {
    // 800 source px shown in a 400 px preview: 1 screen px = 2 source px.
    const start = initialCrop(1200, 800)
    expect(panCrop(1200, 800, start, 50, 0, 400)).toEqual({ zoom: 1, cx: 500, cy: 400 })
    expect(panCrop(1200, 800, start, -500, 0, 400)).toEqual({ zoom: 1, cx: 800, cy: 400 })
    // Vertical room only exists once zoomed in.
    expect(panCrop(1200, 800, start, 0, 100, 400)).toEqual(start)
    const zoomed = zoomCrop(1200, 800, start, 2)
    expect(panCrop(1200, 800, zoomed, 0, 100, 400)).toEqual({ zoom: 2, cx: 600, cy: 300 })
  })

  it("draws the preview so it shows exactly the window", () => {
    const state = zoomCrop(1200, 800, initialCrop(1200, 800), 2)
    const t = previewTransform(1200, 800, state, 200)
    expect(t).toEqual({ scale: 0.5, x: -200, y: -100 })
    // The window's corners land on the preview's corners.
    const { sx, sy, side } = cropRect(1200, 800, state)
    expect(sx * t.scale + t.x).toBe(0)
    expect((sy + side) * t.scale + t.y).toBe(200)
  })

  it("rejects an image without a size", () => {
    expect(() => initialCrop(0, 100)).toThrow(/Invalid image size/)
    expect(() => cropSide(100, Number.NaN, 1)).toThrow(/Invalid image size/)
  })
})
