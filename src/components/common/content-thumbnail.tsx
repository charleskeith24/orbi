"use client"

import { useState } from "react"
import { catVar, catWash } from "@/components/common/color"
import { FormatCategoryIcon } from "@/components/common/entity-badges"
import { PlatformIcon } from "@/components/common/platform-icon"
import { useRow } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { cn } from "@/lib/utils"

const WIDTH = { sm: "w-9", md: "w-14", lg: "w-24" } as const
const GLYPH = { sm: "size-3.5", md: "size-5", lg: "size-7" } as const
const PLATFORM = { sm: "right-0.5 bottom-0.5 size-2.5", md: "right-1 bottom-1 size-3", lg: "right-1.5 bottom-1.5 size-4" } as const

export type ThumbnailItem = Pick<ContentItem, "thumbnail_url" | "platform" | "format_id" | "pillar_id">

/**
 * Item thumbnail: the uploaded image, or a generated tile — a soft wash of the pillar
 * colour with the format glyph and platform mark (no text). 4:5 for video, 1:1 otherwise.
 * Override the width with `className` (e.g. `w-full`) for gallery grids.
 */
export function ContentThumbnail({
  item,
  size = "md",
  aspect = "auto",
  className,
}: {
  item: ThumbnailItem
  size?: "sm" | "md" | "lg"
  /** `auto` = 4:5 for video formats, 1:1 otherwise; `square` keeps table rows even. */
  aspect?: "auto" | "square"
  className?: string
}) {
  const pillar = useRow("content_pillars", item.pillar_id)
  const format = useRow("content_formats", item.format_id)
  // A broken or expired image URL falls back to the generated tile instead of a broken-image icon.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const isVideo = format
    ? format.category === "video" || format.category === "live"
    : item.platform === "tiktok" || item.platform === "youtube"
  const portrait = aspect === "auto" && isVideo
  const frame = cn("relative shrink-0 overflow-hidden rounded-md border", WIDTH[size], portrait ? "aspect-[4/5]" : "aspect-square", className)

  const url = item.thumbnail_url
  if (url && url !== failedUrl) {
    return (
      <div className={cn(frame, "bg-muted")}>
        {/* User-supplied URLs from any host, so next/image's remote allowlist can't apply. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
          className="size-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      aria-hidden
      className={cn(frame, "flex items-center justify-center")}
      style={{
        backgroundColor: catWash(pillar?.color, 13),
        borderColor: `color-mix(in oklch, ${catVar(pillar?.color)} 22%, var(--border))`,
      }}
    >
      <FormatCategoryIcon category={format?.category} className={cn(GLYPH[size], "text-foreground/45")} strokeWidth={1.75} />
      <PlatformIcon platform={item.platform} className={cn("absolute text-foreground/50", PLATFORM[size])} />
    </div>
  )
}
