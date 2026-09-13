"use client"

import { ArrowDown, ArrowUp, Copy, CopyPlus, Ellipsis, Pencil, Plus, Trash } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { ColorDot, FormatLabel, PlatformIcon, SectionCard, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { DAYS_OF_WEEK } from "@/lib/constants"
import { dataActions, useLookup } from "@/lib/store"
import type { ContentFormat, ContentPillar, ID, PostingSlot } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { formatSlotTime, weekdayOrder } from "./calendar-model"
import { daySlots, insertionPlan, moveSlotUpdates, slotPosts } from "./schedule-model"

const dayName = (day: number) => DAYS_OF_WEEK[day]?.label ?? "that day"
const slotName = (slot: PostingSlot, pillar: ContentPillar | undefined) => slot.label.trim() || pillar?.name || "Untitled slot"

/** Copy of a slot for another (or the same) day, placed in time order. */
function copySlot(slots: PostingSlot[], slot: PostingSlot, day: number): PostingSlot {
  const plan = insertionPlan(slots, day, slot.time)
  if (plan.updates.length) dataActions.updateMany("content_calendar", plan.updates)
  return dataActions.insert("content_calendar", {
    day_of_week: day,
    label: slot.label,
    pillar_id: slot.pillar_id,
    format_id: slot.format_id,
    platforms: [...slot.platforms],
    time: slot.time,
    sort_order: plan.sortOrder,
    is_active: slot.is_active,
  })
}

/** The weekly editor: one row per weekday (in week order) with its slots — add, edit, pause, reorder, copy, delete. */
export function ScheduleWeek({
  slots,
  weekStartsOn,
  highlightId,
  onAdd,
  onEdit,
}: {
  slots: PostingSlot[]
  weekStartsOn: 0 | 1
  highlightId: ID | null
  onAdd: (day: number) => void
  onEdit: (slot: PostingSlot) => void
}) {
  const pillars = useLookup("content_pillars")
  const formats = useLookup("content_formats")
  const [confirm, confirmDialog] = useConfirm()
  const days = weekdayOrder(weekStartsOn)

  function toggle(slot: PostingSlot, active: boolean) {
    dataActions.update("content_calendar", slot.id, { is_active: active })
    toast.success(active ? "Slot active again" : "Slot paused", {
      description: `${dayName(slot.day_of_week)} · ${slotName(slot, pillars.get(slot.pillar_id ?? ""))}`,
    })
  }

  function move(slot: PostingSlot, direction: -1 | 1) {
    const updates = moveSlotUpdates(slots, slot.id, direction)
    if (updates?.length) dataActions.updateMany("content_calendar", updates)
  }

  function duplicate(slot: PostingSlot, day: number) {
    const copy = copySlot(slots, slot, day)
    toast.success(day === slot.day_of_week ? "Slot duplicated" : `Copied to ${dayName(day)}`, {
      description: slotName(slot, pillars.get(slot.pillar_id ?? "")),
      action: { label: "Undo", onClick: () => dataActions.remove("content_calendar", copy.id) },
    })
  }

  async function remove(slot: PostingSlot) {
    const name = slotName(slot, pillars.get(slot.pillar_id ?? ""))
    const ok = await confirm({
      title: `Delete “${name}”?`,
      description: `The ${dayName(slot.day_of_week)} slot disappears from the Calendar and the Weekly Planner. Scheduled content keeps its dates.`,
    })
    if (!ok) return
    dataActions.remove("content_calendar", slot.id)
    toast.success("Posting slot deleted", {
      description: `${dayName(slot.day_of_week)} · ${name}`,
      action: { label: "Undo", onClick: () => dataActions.insert("content_calendar", slot) },
    })
  }

  return (
    <SectionCard
      title="Weekly slots"
      description="Each slot is a recurring posting target: a theme, a pillar, a format and the platforms it goes out on."
      contentClassName="p-0"
      footer={
        <span>
          The <Link href="/calendar?view=week" className="font-medium text-foreground underline-offset-4 hover:underline">Calendar</Link> shows these as lanes; the{" "}
          <Link href="/calendar/planner" className="font-medium text-foreground underline-offset-4 hover:underline">Weekly Planner</Link> fills open slots first.
        </span>
      }
    >
      <ol className="divide-y border-t">
        {days.map((day) => {
          const list = daySlots(slots, day)
          const posts = list.filter((s) => s.is_active).reduce((n, s) => n + slotPosts(s), 0)
          return (
            <li key={day} className="grid min-w-0 gap-2 px-4 py-3 md:grid-cols-[9.5rem_minmax(0,1fr)] md:gap-4">
              <div className="flex min-w-0 items-center justify-between gap-2 md:flex-col md:items-start md:justify-start md:gap-1">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{dayName(day)}</h3>
                  <p className="text-xs text-muted-foreground num">
                    {list.length ? `${pluralize(list.length, "slot")} · ${pluralize(posts, "post")}` : "Rest day"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => onAdd(day)}
                  aria-label={`Add a slot on ${dayName(day)}`}
                  className="-ml-2 text-muted-foreground max-md:ml-0"
                >
                  <Plus aria-hidden />
                  Add slot
                </Button>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                {list.length ? (
                  list.map((slot, index) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      pillar={slot.pillar_id ? pillars.get(slot.pillar_id) : undefined}
                      format={slot.format_id ? formats.get(slot.format_id) : undefined}
                      days={days}
                      first={index === 0}
                      last={index === list.length - 1}
                      highlighted={highlightId === slot.id}
                      onEdit={() => onEdit(slot)}
                      onToggle={(active) => toggle(slot, active)}
                      onMove={(direction) => move(slot, direction)}
                      onCopy={(target) => duplicate(slot, target)}
                      onDelete={() => void remove(slot)}
                    />
                  ))
                ) : (
                  <p className="flex min-h-9 items-center text-xs text-muted-foreground">
                    No posting target on {dayName(day)}s. Rest days are fine — consistency beats volume.
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {confirmDialog}
    </SectionCard>
  )
}

function SlotRow({
  slot,
  pillar,
  format,
  days,
  first,
  last,
  highlighted,
  onEdit,
  onToggle,
  onMove,
  onCopy,
  onDelete,
}: {
  slot: PostingSlot
  pillar: ContentPillar | undefined
  format: ContentFormat | undefined
  days: number[]
  first: boolean
  last: boolean
  highlighted: boolean
  onEdit: () => void
  onToggle: (active: boolean) => void
  onMove: (direction: -1 | 1) => void
  onCopy: (day: number) => void
  onDelete: () => void
}) {
  const name = slotName(slot, pillar)
  const time = formatSlotTime(slot.time)
  return (
    <div
      data-slot-id={slot.id}
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-card px-3 py-2 sm:flex-nowrap",
        !slot.is_active && "bg-muted/40 dark:bg-muted/20",
        highlighted && "border-brand/60 ring-2 ring-brand/30"
      )}
    >
      <span className={cn("w-16 shrink-0 text-xs font-medium num", !slot.is_active && "text-muted-foreground")}>{time ?? "Any time"}</span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${dayName(slot.day_of_week)} slot: ${name}`}
        className="flex min-w-0 flex-1 basis-48 flex-col items-start gap-0.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className={cn("flex max-w-full min-w-0 items-center gap-1.5 text-sm font-medium", !slot.is_active && "text-muted-foreground")}>
          {pillar ? (
            <ColorDot color={pillar.color} />
          ) : (
            <span aria-hidden className="size-2 shrink-0 rounded-full border border-dashed border-muted-foreground" />
          )}
          <span className="truncate">{name}</span>
          {!slot.is_active ? <span className="shrink-0 text-xs font-normal">· Paused</span> : null}
        </span>
        <span className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="truncate">{pillar?.name ?? "No pillar"}</span>
          <span aria-hidden>·</span>
          <FormatLabel format={format ?? null} emptyLabel="No format" />
          <span aria-hidden>·</span>
          {slot.platforms.length ? (
            <span className="inline-flex items-center gap-1">
              {slot.platforms.map((p) => (
                <PlatformIcon key={p} platform={p} label className="size-3.5" />
              ))}
            </span>
          ) : (
            <span>Any platform</span>
          )}
        </span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Switch
          size="sm"
          checked={slot.is_active}
          onCheckedChange={onToggle}
          aria-label={`${slot.is_active ? "Pause" : "Activate"} ${name}`}
          className="mr-1"
        />
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move ${name} earlier`} disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move ${name} later`} disabled={last} onClick={() => onMove(1)}>
          <ArrowDown aria-hidden />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={`More actions for ${name}`} className="text-muted-foreground">
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil aria-hidden />
              Edit…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCopy(slot.day_of_week)}>
              <CopyPlus aria-hidden />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Copy aria-hidden />
                Copy to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {days
                  .filter((d) => d !== slot.day_of_week)
                  .map((d) => (
                    <DropdownMenuItem key={d} onSelect={() => onCopy(d)}>
                      {dayName(d)}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash aria-hidden />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
