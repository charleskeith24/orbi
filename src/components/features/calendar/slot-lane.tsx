"use client"

import { CircleCheck, CircleDashed, CircleDotDashed, CircleSlash, Plus, type LucideIcon } from "lucide-react"
import { ColorDot, PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { PLATFORMS } from "@/lib/constants"
import type { CategoricalColor, PlatformId } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatSlotTime, isFillable, type DaySlot, type SlotStatus } from "./calendar-model"

export interface SlotPillar {
  name: string
  color: CategoricalColor
}

export const SLOT_STATUS_META: Record<SlotStatus, { label: string; icon: LucideIcon; className: string }> = {
  filled: { label: "Filled", icon: CircleCheck, className: "text-good-fg" },
  partial: { label: "Partly filled", icon: CircleDotDashed, className: "text-warning-fg" },
  open: { label: "Open slot", icon: CircleDashed, className: "text-muted-foreground" },
  missed: { label: "Missed", icon: CircleSlash, className: "text-muted-foreground" },
}

export function slotLabel(daySlot: DaySlot, pillar: SlotPillar | null): string {
  return daySlot.slot.label.trim() || pillar?.name || "Posting slot"
}

function fillText(daySlot: DaySlot): string {
  if (!daySlot.posts.length || !daySlot.missing.length) return "Fill slot"
  return `Add ${daySlot.missing.map((p) => PLATFORMS[p]?.label ?? p).join(" + ")}`
}

function SlotMeta({ time, platforms }: { time: string | null; platforms: PlatformId[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
      <span className="num">{time ?? "Any time"}</span>
      {platforms.map((p) => (
        <PlatformIcon key={p} platform={p} label className="size-3" />
      ))}
    </span>
  )
}

/**
 * A posting target as a subtle lane: status, theme, time and platforms on top, the posts that fill it
 * inside, and "Fill slot" while it still takes a post.
 */
export function SlotLane({
  daySlot,
  isPast,
  pillar,
  size = "sm",
  onFill,
  children,
}: {
  daySlot: DaySlot
  isPast: boolean
  pillar: SlotPillar | null
  size?: "sm" | "md"
  onFill: () => void
  children?: React.ReactNode
}) {
  const meta = SLOT_STATUS_META[daySlot.status]
  const Icon = meta.icon
  const time = formatSlotTime(daySlot.slot.time)
  const label = slotLabel(daySlot, pillar)
  const fillable = isFillable(daySlot, isPast)
  const md = size === "md"

  return (
    <section
      aria-label={`${label}${time ? ` at ${time}` : ""} — ${meta.label}`}
      className={cn(
        "flex min-w-0 flex-col rounded-md border",
        daySlot.status === "filled"
          ? "border-border/80 bg-muted/30 dark:bg-muted/15"
          : daySlot.status === "missed"
            ? "border-dashed border-border/70"
            : "border-dashed border-foreground/20 bg-muted/20 dark:bg-muted/10",
        md ? "gap-2 p-2" : "gap-1 p-1"
      )}
    >
      <header className={cn("flex min-w-0 flex-col gap-0.5 px-1", md ? "pt-0.5 text-xs" : "text-[11px]")}>
        <div className="flex min-w-0 items-center gap-1.5 leading-4">
          <Icon className={cn("size-3.5 shrink-0", meta.className)} aria-hidden />
          {pillar ? <ColorDot color={pillar.color} className="size-1.5" /> : null}
          <span
            className={cn("min-w-0 flex-1 truncate font-medium", daySlot.status === "missed" ? "text-muted-foreground" : "text-foreground/80")}
            title={label}
          >
            {label}
          </span>
          {md ? <SlotMeta time={time} platforms={daySlot.slot.platforms} /> : null}
        </div>
        {md ? null : (
          <div className="flex min-w-0 items-center pl-5 leading-4">
            <SlotMeta time={time} platforms={daySlot.slot.platforms} />
          </div>
        )}
      </header>
      {children}
      {fillable ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onFill}
          aria-label={`${fillText(daySlot)} — ${label}${time ? ` at ${time}` : ""}`}
          className="h-6 w-full min-w-0 justify-start gap-1 px-1 font-normal text-muted-foreground hover:text-foreground"
        >
          <Plus aria-hidden />
          <span className="min-w-0 truncate">{fillText(daySlot)}</span>
        </Button>
      ) : daySlot.status === "missed" ? (
        <p className="px-1 text-[11px] text-muted-foreground">No post went out</p>
      ) : null}
    </section>
  )
}

/** Month cell: an open posting slot as a dashed chip that opens "Fill slot". */
export function SlotChip({ daySlot, pillar, onFill }: { daySlot: DaySlot; pillar: SlotPillar | null; onFill: () => void }) {
  const label = slotLabel(daySlot, pillar)
  const time = formatSlotTime(daySlot.slot.time)
  const partial = daySlot.status === "partial"
  return (
    <button
      type="button"
      onClick={onFill}
      title={`${partial ? "Partly filled" : "Open slot"} · ${label}${time ? ` · ${time}` : ""} — fill it`}
      className="flex h-6 min-w-0 items-center gap-1.5 rounded-md border border-dashed border-foreground/20 px-1.5 text-[11px] text-muted-foreground transition-colors outline-none hover:border-foreground/35 hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Plus className="size-3 shrink-0" aria-hidden />
      {pillar ? <ColorDot color={pillar.color} className="size-1.5" /> : null}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <span className="sr-only">
        {partial ? "partly filled" : "open"} posting slot{time ? ` at ${time}` : ""}. Fill slot
      </span>
    </button>
  )
}

/** Compact slot status line (used while filters are on, where lanes would hide filtered posts). */
export function SlotLine({ daySlot, isPast, pillar, onFill }: { daySlot: DaySlot; isPast: boolean; pillar: SlotPillar | null; onFill: () => void }) {
  const meta = SLOT_STATUS_META[daySlot.status]
  const Icon = meta.icon
  const label = slotLabel(daySlot, pillar)
  const time = formatSlotTime(daySlot.slot.time)
  const fillable = isFillable(daySlot, isPast)
  return (
    <div className="flex h-6 min-w-0 items-center gap-1.5 rounded-md border border-dashed px-1.5 text-[11px] text-muted-foreground">
      <Icon className={cn("size-3.5 shrink-0", meta.className)} aria-hidden />
      <span className="sr-only">{meta.label}:</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {fillable ? (
        <Button type="button" variant="ghost" size="icon-xs" className="-mr-1 size-5" onClick={onFill} aria-label={`Fill slot: ${label}`}>
          <Plus aria-hidden />
        </Button>
      ) : time ? (
        <span className="shrink-0 num">{time}</span>
      ) : null}
    </div>
  )
}
