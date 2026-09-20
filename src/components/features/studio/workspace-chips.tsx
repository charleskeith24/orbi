"use client"

import { AlarmClock, CalendarCheck, CalendarClock, CalendarDays, ChevronsDown, ChevronsUp, UserRound, UserRoundX } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  FormatSelect,
  FunnelSelect,
  GoalSelect,
  PersonaSelect,
  PillarSelect,
  PlatformSelect,
  PrioritySelect,
  StageSelect,
  TimeInput,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useDeviceValue, writeDeviceValue } from "@/hooks/use-device-value"
import { useIsMobile } from "@/hooks/use-mobile"
import { getUiLang, translate, useT, useUiLang } from "@/lib/i18n"
import { BUFFER_STAGES, PUBLISHED_STAGES } from "@/lib/constants"
import { combineDateTime, daysBetween, formatDate, formatRelativeDay, parseDate, toISODate } from "@/lib/dates"
import { dataActions, moveItemToStage, scheduleItem, uiActions, unscheduleItem, useSettings, useTable } from "@/lib/store"
import type { ContentItem, PipelineStage, UpdateRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { workspaceMessages } from "./messages"
import { knownOwners } from "./studio-utils"

/** Select triggers restyled as compact property chips (chevron hidden, width follows the value). */
const SELECT_CHIP = "w-auto max-w-56 pr-2 pl-2 text-[0.8rem] [&>svg:last-child]:hidden"
/** Popover chips share the outline look of the select chips. */
const BUTTON_CHIP = "max-w-64 justify-start border-input px-2 font-normal dark:bg-input/30"

/**
 * Hover hint naming the property. A native `title` on purpose: a Radix Tooltip around a Select or
 * Popover trigger opens during the click and becomes the top dismissable layer, swallowing the first Esc.
 */
function ChipTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span title={label} className="inline-flex min-w-0">
      {children}
    </span>
  )
}

export function publishedToast(itemId: string, title?: string) {
  const lang = getUiLang()
  toast.success(title ?? translate(workspaceMessages, lang, "marked_published"), {
    description: translate(workspaceMessages, lang, "marked_published_description"),
    action: { label: translate(workspaceMessages, lang, "add_analytics"), onClick: () => uiActions.openDialog({ type: "add-metrics", itemId }) },
  })
}

/* -------------------------------- Due date -------------------------------- */

function DueChip({ item, now }: { item: ContentItem; now: Date }) {
  const t = useT(workspaceMessages)
  const lang = useUiLang()
  const [open, setOpen] = useState(false)
  const due = parseDate(item.due_date)
  const days = daysBetween(now, due) ?? 0
  const live = PUBLISHED_STAGES.includes(item.stage)
  const overdue = Boolean(due) && !live && !BUFFER_STAGES.includes(item.stage) && days < 0

  function save(value: string | null) {
    dataActions.update("content_items", item.id, { due_date: value })
    setOpen(false)
  }

  // "Due today" / "Due ngayon", "Due in 3 days" / "Due sa 3 araw"; two or more days back, or past two weeks, reads "Due Sep 8".
  const relative = due && days >= -1 && days <= 14 ? formatRelativeDay(due, now, lang) : ""
  const label = !due
    ? t("due_date")
    : overdue
      ? t("overdue_on", { date: formatDate(due, "MMM d") })
      : t("due_on", { date: relative ? (Math.abs(days) <= 1 ? relative.toLowerCase() : relative) : formatDate(due, "MMM d") })
  const Icon = overdue ? AlarmClock : CalendarDays
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ChipTip label={due ? t("production_deadline_on", { date: formatDate(due, "EEE, MMM d, yyyy") }) : t("production_deadline")}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={due ? t("due_date_aria", { date: formatDate(due) }) : t("set_due_date")}
            className={cn(BUTTON_CHIP, !due && "text-muted-foreground", overdue && "font-medium text-critical-fg")}
          >
            <Icon aria-hidden />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
      </ChipTip>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="single"
          selected={due ?? undefined}
          defaultMonth={due ?? now}
          autoFocus
          onSelect={(date) => (date ? save(toISODate(date)) : setOpen(false))}
        />
        <div className="flex items-center justify-between gap-2 border-t p-1.5">
          <Button type="button" variant="ghost" size="xs" onClick={() => save(toISODate(now))}>
            {t("today")}
          </Button>
          {due ? (
            <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => save(null)}>
              {t("clear")}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* -------------------------------- Schedule -------------------------------- */

function ScheduleChip({
  item,
  now,
  open,
  onOpenChange,
}: {
  item: ContentItem
  now: Date
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT(workspaceMessages)
  const live = PUBLISHED_STAGES.includes(item.stage)
  const value = parseDate(live ? (item.published_at ?? item.scheduled_at) : item.scheduled_at)
  const time = value ? formatDate(value, "HH:mm") : null

  function save(date: Date, nextTime: string) {
    const wasReady = item.stage === "ready_to_post"
    const hadDate = Boolean(item.scheduled_at)
    const iso = combineDateTime(date, nextTime)
    scheduleItem(item.id, iso)
    if (!live && (wasReady || !hadDate)) {
      toast.success(t("scheduled_for", { when: formatDate(iso, "EEE, MMM d · h:mm a") }), {
        description: wasReady ? t("moved_to_scheduled") : undefined,
      })
    }
  }

  function clear() {
    const wasScheduled = item.stage === "scheduled"
    unscheduleItem(item.id)
    onOpenChange(false)
    toast.success(t("unscheduled"), { description: wasScheduled ? t("back_in_ready") : undefined })
  }

  const label = live
    ? value
      ? t("published_on", { when: formatDate(value, "MMM d · h:mm a") })
      : t("published")
    : value
      ? formatDate(value, "EEE, MMM d · h:mm a")
      : t("schedule")
  const Icon = live ? CalendarCheck : CalendarClock
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <ChipTip label={live ? t("publish_date_tip") : t("planned_tip")}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={live ? t("published_aria", { label }) : value ? t("scheduled_aria", { label }) : t("schedule_aria")}
            className={cn(BUTTON_CHIP, !value && "text-muted-foreground")}
          >
            <Icon aria-hidden />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
      </ChipTip>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          defaultMonth={value ?? now}
          autoFocus
          onSelect={(date) => {
            if (date) save(date, time ?? "09:00")
          }}
        />
        <div className="flex items-center gap-2 border-t p-2">
          <span className="text-xs text-muted-foreground">{t("time")}</span>
          <TimeInput size="sm" value={time ?? "09:00"} onChange={(next) => (next ? save(value ?? now, next) : undefined)} />
          {!live && value ? (
            <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={clear}>
              {t("unschedule")}
            </Button>
          ) : null}
          <Button type="button" size="xs" className="ml-auto" onClick={() => onOpenChange(false)}>
            {t("done")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ---------------------------------- Owner --------------------------------- */

function OwnerChip({ item }: { item: ContentItem }) {
  const t = useT(workspaceMessages)
  const items = useTable("content_items")
  const settings = useSettings()
  const owners = useMemo(() => knownOwners(items, settings.default_owner), [items, settings.default_owner])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const clean = search.replace(/\s+/g, " ").trim()
  const exists = owners.some((o) => o.toLowerCase() === clean.toLowerCase())

  function assign(owner: string) {
    if (owner !== item.owner) dataActions.update("content_items", item.id, { owner })
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch("")
      }}
    >
      <ChipTip label={t("owner")}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={item.owner ? t("owner_aria", { name: item.owner }) : t("assign_owner")}
            className={cn(BUTTON_CHIP, !item.owner && "text-muted-foreground")}
          >
            <UserRound aria-hidden />
            <span className="truncate">{item.owner || t("owner")}</span>
          </Button>
        </PopoverTrigger>
      </ChipTip>
      <PopoverContent align="start" className="w-60 gap-0 p-0">
        <Command>
          <CommandInput value={search} onValueChange={setSearch} placeholder={t("assign_placeholder")} />
          <CommandList>
            {exists || !clean ? <CommandEmpty>{t("no_owner_match")}</CommandEmpty> : null}
            {owners.length ? (
              <CommandGroup heading={t("people")}>
                {owners.map((owner) => (
                  <CommandItem key={owner} value={owner} data-checked={owner === item.owner ? "true" : undefined} onSelect={() => assign(owner)}>
                    <UserRound className="text-muted-foreground" aria-hidden />
                    <span className="min-w-0 truncate">{owner}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {clean && !exists ? (
              <CommandGroup forceMount>
                <CommandItem forceMount value={`__assign__${clean}`} onSelect={() => assign(clean)}>
                  <UserRound className="text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate">
                    {t("assign_to")} <span className="font-medium">{clean}</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {item.owner ? (
              <CommandGroup forceMount>
                <CommandItem forceMount value="__unassign__" onSelect={() => assign("")}>
                  <UserRoundX className="text-muted-foreground" aria-hidden />
                  {t("unassign")}
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------- Property bar ------------------------------ */

/**
 * The item's properties as compact chips in two rows: production (stage, priority, platform,
 * format, owner, deadline, schedule) and strategy (pillar, persona, funnel, goal). Phones show
 * the essentials until "All properties" is pressed.
 */
/** Remembered per device: whether the workspace shows every property chip or the everyday few. */
const PROPERTIES_KEY = "pbos:studio:properties"

/**
 * The item's properties as chips (Calm UI): stage, platform, format (desktop), pillar, due date and publish time
 * by default; priority, owner, persona, funnel stage and goal behind "All properties" (remembered per device).
 */
export function PropertyBar({ item, now }: { item: ContentItem; now: Date }) {
  const t = useT(workspaceMessages)
  const isMobile = useIsMobile()
  const expanded = useDeviceValue(PROPERTIES_KEY) === "all"
  const setExpanded = (value: boolean) => writeDeviceValue(PROPERTIES_KEY, value ? "all" : null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const update = (patch: UpdateRow<"content_items">) => dataActions.update("content_items", item.id, patch)

  function changeStage(stage: PipelineStage) {
    const wasLive = PUBLISHED_STAGES.includes(item.stage)
    moveItemToStage(item.id, stage)
    if (PUBLISHED_STAGES.includes(stage) && !wasLive) publishedToast(item.id)
    else if (stage === "scheduled" && !item.scheduled_at) {
      toast.info(t("pick_publish_date"), { description: t("pick_publish_date_description") })
      setScheduleOpen(true)
    }
  }

  return (
    <div role="group" aria-label={t("properties")} className="flex min-w-0 flex-wrap items-center gap-1.5">
      <ChipTip label={t("stage")}>
        <StageSelect value={item.stage} onChange={(stage) => stage && changeStage(stage)} size="sm" aria-label={t("stage")} className={SELECT_CHIP} />
      </ChipTip>
      {expanded ? (
        <ChipTip label={t("priority")}>
          <PrioritySelect value={item.priority} onChange={(priority) => priority && update({ priority })} size="sm" aria-label={t("priority")} className={SELECT_CHIP} />
        </ChipTip>
      ) : null}
      <ChipTip label={t("platform")}>
        <PlatformSelect value={item.platform} onChange={(platform) => platform && update({ platform })} size="sm" aria-label={t("platform")} className={SELECT_CHIP} />
      </ChipTip>
      {expanded || !isMobile ? (
        <ChipTip label={t("format")}>
          <FormatSelect value={item.format_id} onChange={(format_id) => update({ format_id })} allowNone size="sm" aria-label={t("format")} className={SELECT_CHIP} />
        </ChipTip>
      ) : null}
      {expanded ? <OwnerChip item={item} /> : null}
      <ChipTip label={t("content_pillar")}>
        <PillarSelect value={item.pillar_id} onChange={(pillar_id) => update({ pillar_id })} allowNone size="sm" aria-label={t("content_pillar")} className={SELECT_CHIP} />
      </ChipTip>
      <DueChip item={item} now={now} />
      <ScheduleChip item={item} now={now} open={scheduleOpen} onOpenChange={setScheduleOpen} />
      {expanded ? (
        <>
          <ChipTip label={t("target_audience_tip")}>
            <PersonaSelect value={item.persona_id} onChange={(persona_id) => update({ persona_id })} allowNone size="sm" aria-label={t("persona")} className={SELECT_CHIP} />
          </ChipTip>
          <ChipTip label={t("funnel_tip")}>
            <FunnelSelect value={item.funnel_stage} onChange={(funnel_stage) => update({ funnel_stage })} allowNone size="sm" aria-label={t("funnel_stage")} className={SELECT_CHIP} />
          </ChipTip>
          <ChipTip label={t("goal")}>
            <GoalSelect value={item.goal_id} onChange={(goal_id) => update({ goal_id })} allowNone size="sm" aria-label={t("goal")} className={SELECT_CHIP} />
          </ChipTip>
        </>
      ) : null}
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronsUp aria-hidden /> : <ChevronsDown aria-hidden />}
        {expanded ? t("fewer_properties") : t("all_properties")}
      </Button>
    </div>
  )
}
