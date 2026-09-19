"use client"

import { CircleAlert, Minus, Plus, ShieldCheck } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { cropRect, initialCrop, MAX_ZOOM, MIN_ZOOM, panCrop, zoomCrop, type CropState } from "@/lib/profiles/crop"
import type { ProfilesSource } from "@/lib/profiles/types"
import { profileMessages } from "./messages"
import { encodePhoto, photoTarget, type LoadedPhoto } from "./photo-encode"
import { useDescribeProfileError } from "./profile-errors"
import { profileActions } from "./profile-store"

const KEY_STEP_PX = 12
const ZOOM_STEP = 0.2

/**
 * Crop a picked photo to a square (drag to move, zoom 1–4×), then re-encode and save it. Uploading shows a
 * spinner; a failure keeps the dialog open with the reason and "Try again".
 */
export function PhotoCropDialog({
  photo,
  source,
  onClose,
}: {
  /** The opened photo; the dialog is open while it's set. */
  photo: LoadedPhoto | null
  source: ProfilesSource
  onClose: () => void
}) {
  return (
    <Dialog
      open={photo !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">{photo ? <CropForm key={photo.image.src} photo={photo} source={source} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  )
}

function CropForm({ photo, source, onClose }: { photo: LoadedPhoto; source: ProfilesSource; onClose: () => void }) {
  const t = useT(profileMessages)
  const c = useT(commonMessages)
  const describe = useDescribeProfileError()
  const hintId = useId()
  const [crop, setCrop] = useState<CropState>(() => initialCrop(photo.width, photo.height))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const [viewport, setViewport] = useState(256)

  // The preview's size in CSS pixels (drags are converted with it).
  useLayoutEffect(() => {
    const node = frame.current
    if (!node) return
    const measure = () => setViewport(node.getBoundingClientRect().width || 256)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Draw exactly the crop window into the preview canvas (sharp on high-DPI screens).
  useEffect(() => {
    const node = canvas.current
    if (!node) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const px = Math.max(1, Math.round(viewport * ratio))
    if (node.width !== px) {
      node.width = px
      node.height = px
    }
    const ctx = node.getContext("2d")
    if (!ctx) return
    const { sx, sy, side } = cropRect(photo.width, photo.height, crop)
    ctx.imageSmoothingQuality = "high"
    ctx.clearRect(0, 0, px, px)
    ctx.drawImage(photo.image, sx, sy, side, side, 0, 0, px, px)
  }, [crop, photo, viewport])

  const pan = (dx: number, dy: number) => setCrop((current) => panCrop(photo.width, photo.height, current, dx, dy, viewport))
  const zoomTo = (zoom: number) => setCrop((current) => zoomCrop(photo.width, photo.height, current, zoom))

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const encoded = await encodePhoto(photo, crop, photoTarget(source))
      await profileActions.setPhoto(encoded)
      toast.success(t("photo_updated"))
      onClose()
    } catch (failure) {
      setError(failure)
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("crop_title")}</DialogTitle>
        <DialogDescription>{t("crop_description")}</DialogDescription>
      </DialogHeader>

      <div
        ref={frame}
        role="group"
        tabIndex={0}
        aria-label={t("crop_area")}
        aria-describedby={hintId}
        aria-busy={saving || undefined}
        className="relative mx-auto aspect-square w-full max-w-72 cursor-grab touch-none overflow-hidden rounded-lg bg-muted outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        onPointerDown={(event) => {
          if (saving) return
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const start = drag.current
          if (!start || start.id !== event.pointerId) return
          pan(event.clientX - start.x, event.clientY - start.y)
          drag.current = { ...start, x: event.clientX, y: event.clientY }
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onWheel={(event) => {
          if (saving) return
          zoomTo(crop.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08))
        }}
        onKeyDown={(event) => {
          if (saving) return
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [KEY_STEP_PX, 0],
            ArrowRight: [-KEY_STEP_PX, 0],
            ArrowUp: [0, KEY_STEP_PX],
            ArrowDown: [0, -KEY_STEP_PX],
          }
          if (moves[event.key]) {
            event.preventDefault()
            pan(...moves[event.key])
          } else if (event.key === "+" || event.key === "=") {
            event.preventDefault()
            zoomTo(crop.zoom + ZOOM_STEP)
          } else if (event.key === "-" || event.key === "_") {
            event.preventDefault()
            zoomTo(crop.zoom - ZOOM_STEP)
          }
        }}
      >
        <canvas ref={canvas} className="size-full" aria-hidden />
        {/* The circle the avatar shows; the corners are dimmed. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.45)] ring-2 ring-white/80" />
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`${t("crop_zoom")} −`} disabled={saving || crop.zoom <= MIN_ZOOM} onClick={() => zoomTo(crop.zoom - ZOOM_STEP)}>
          <Minus aria-hidden />
        </Button>
        <Slider
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={[crop.zoom]}
          disabled={saving}
          aria-label={t("crop_zoom")}
          onValueChange={([zoom]) => zoomTo(zoom)}
        />
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`${t("crop_zoom")} +`} disabled={saving || crop.zoom >= MAX_ZOOM} onClick={() => zoomTo(crop.zoom + ZOOM_STEP)}>
          <Plus aria-hidden />
        </Button>
      </div>

      <p id={hintId} className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-good-fg" aria-hidden />
        {t("photo_exif")}
      </p>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical-fg" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">{t("crop_failed")}</p>
            <p className="text-xs text-muted-foreground">{describe(error)}</p>
          </div>
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          {c("cancel")}
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? <Spinner /> : null}
          {saving ? (source === "live" || source === "fixture" ? t("crop_uploading") : t("crop_saving")) : error ? t("crop_retry") : t("crop_save")}
        </Button>
      </DialogFooter>
    </div>
  )
}
