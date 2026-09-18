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
import { useT, type Translator } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useLookup } from "@/lib/store"
import type { ContentFormat, ContentPillar, ID, PostingSlot } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { formatSlotTime, weekdayOrder } from "./calendar-model"
import { scheduleMessages } from "./schedule-messages"
import { daySlots, insertionPlan, moveSlotUpdates, slotPosts } from "./schedule-model"

type T = Translator<typeof scheduleMessages.en>

const dayName = (day: number, t: T) => DAYS_OF_WEEK[day]?.label ?? t("that_day")
const slotName = (slot: PostingSlot, pillar: ContentPillar | undefined, t: T) => slot.label.trim() || pillar?.name || t("untitled_slot")

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
  const t = useT(scheduleMessages)
  const pillars = useLookup("content_pillars")
  const formats = useLookup("content_formats")
  const [confirm, confirmDialog] = useConfirm()
  const days = weekdayOrder(weekStartsOn)

  function toggle(slot: PostingSlot, active: boolean) {
    dataActions.update("content_calendar", slot.id, { is_active: active })
    toast.success(active ? t("slot_active_again") : t("slot_paused"), {
      description: `${dayName(slot.day_of_week, t)} · ${slotName(slot, pillars.get(slot.pillar_id ?? ""), t)}`,
    })
  }

  function move(slot: PostingSlot, direction: -1 | 1) {
    const updates = moveSlotUpdates(slots, slot.id, direction)
    if (updates?.length) dataActions.updateMany("content_calendar", updates)
  }

  function duplicate(slot: PostingSlot, day: number) {
    const copy = copySlot(slots, slot, day)
    toast.success(day === slot.day_of_week ? t("slot_duplicated") : t("copied_to", { day: dayName(day, t) }), {
      description: slotName(slot, pillars.get(slot.pillar_id ?? ""), t),
      action: { label: t("undo"), onClick: () => dataActions.remove("content_calendar", copy.id) },
    })
  }

  async function remove(slot: PostingSlot) {
    const name = slotName(slot, pillars.get(slot.pillar_id ?? ""), t)
    const ok = await confirm({
      title: t("delete_title", { name }),
      description: t("delete_description", { day: dayName(slot.day_of_week, t) }),
    })
    if (!ok) return
    dataActions.remove("content_calendar", slot.id)
    toast.success(t("slot_deleted"), {
      description: `${dayName(slot.day_of_week, t)} · ${name}`,
      action: { label: t("undo"), onClick: () => dataActions.insert("content_calendar", slot) },
    })
  }

  return (
    <SectionCard
      title={t("week_title")}
      description={t("week_description")}
      contentClassName="p-0"
      footer={
        <span>
          {t("footer_pre")}
          <Link href="/calendar?view=week" className="font-medium text-foreground underline-offset-4 hover:underline">
            Calendar
          </Link>
          {t("footer_mid")}
          <Link href="/calendar/planner" className="font-medium text-foreground underline-offset-4 hover:underline">
            Weekly Planner
          </Link>
          {t("footer_post")}
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
                  <h3 className="text-sm font-medium">{dayName(day, t)}</h3>
                  <p className="text-xs text-muted-foreground num">
                    {list.length
                      ? `${t.plural("slots", list.length, { count: formatNumber(list.length) })} · ${t.plural("posts", posts, { count: formatNumber(posts) })}`
                      : t("rest_day")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => onAdd(day)}
                  aria-label={t("add_slot_on", { day: dayName(day, t) })}
                  className="-ml-2 text-muted-foreground max-md:ml-0"
                >
                  <Plus aria-hidden />
                  {t("add_slot")}
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
                    {t("no_target_on", { day: dayName(day, t) })}
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
  const t = useT(scheduleMessages)
  const c = useT(commonMessages)
  const name = slotName(slot, pillar, t)
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
      <span className={cn("w-16 shrink-0 text-xs font-medium num", !slot.is_active && "text-muted-foreground")}>{time ?? t("any_time")}</span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("edit_slot_aria", { day: dayName(slot.day_of_week, t), name })}
        className="flex min-w-0 flex-1 basis-48 flex-col items-start gap-0.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className={cn("flex max-w-full min-w-0 items-center gap-1.5 text-sm font-medium", !slot.is_active && "text-muted-foreground")}>
          {pillar ? (
            <ColorDot color={pillar.color} />
          ) : (
            <span aria-hidden className="size-2 shrink-0 rounded-full border border-dashed border-muted-foreground" />
          )}
          <span className="truncate">{name}</span>
          {!slot.is_active ? <span className="shrink-0 text-xs font-normal">{t("paused_tag")}</span> : null}
        </span>
        <span className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="truncate">{pillar?.name ?? t("no_pillar")}</span>
          <span aria-hidden>·</span>
          <FormatLabel format={format ?? null} emptyLabel={t("no_format")} />
          <span aria-hidden>·</span>
          {slot.platforms.length ? (
            <span className="inline-flex items-center gap-1">
              {slot.platforms.map((p) => (
                <PlatformIcon key={p} platform={p} label className="size-3.5" />
              ))}
            </span>
          ) : (
            <span>{t("any_platform")}</span>
          )}
        </span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Switch
          size="sm"
          checked={slot.is_active}
          onCheckedChange={onToggle}
          aria-label={t(slot.is_active ? "pause_named" : "activate_named", { name })}
          className="mr-1"
        />
        <Button type="button" variant="ghost" size="icon-xs" aria-label={t("move_earlier", { name })} disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={t("move_later", { name })} disabled={last} onClick={() => onMove(1)}>
          <ArrowDown aria-hidden />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("more_actions", { name })} className="text-muted-foreground">
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil aria-hidden />
              {t("edit_menu")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCopy(slot.day_of_week)}>
              <CopyPlus aria-hidden />
              {t("duplicate")}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Copy aria-hidden />
                {t("copy_to")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {days
                  .filter((d) => d !== slot.day_of_week)
                  .map((d) => (
                    <DropdownMenuItem key={d} onSelect={() => onCopy(d)}>
                      {dayName(d, t)}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash aria-hidden />
              {c("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
