import { format } from "date-fns"
import { CircleCheck, CircleDashed, CircleSlash, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { ColorDot, PlatformIcon, SectionCard } from "@/components/common"
import { isPublishedItem } from "@/lib/analytics"
import { formatTime } from "@/lib/dates"
import type { ContentItem, ISODate } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { CardLink } from "./card-link"
import { formatSlotTime, type SlotStatus, type WeekDay, type WeekSlot } from "./dashboard-utils"

const SLOT_STATUS: Record<SlotStatus, { label: string; icon: LucideIcon; className: string }> = {
  filled: { label: "Filled", icon: CircleCheck, className: "text-good-fg" },
  open: { label: "Open slot", icon: CircleDashed, className: "text-warning-fg" },
  missed: { label: "Missed", icon: CircleSlash, className: "text-muted-foreground" },
}

const ITEMS_PER_DAY = 3

function SlotChip({ weekSlot }: { weekSlot: WeekSlot }) {
  const { slot, pillar, status } = weekSlot
  const meta = SLOT_STATUS[status]
  const Icon = meta.icon
  const time = formatSlotTime(slot.time)
  return (
    <Link
      href="/calendar"
      title={`${meta.label} · ${slot.label}${time ? ` · ${time}` : ""}`}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-md border bg-card px-2 py-1.5 text-xs outline-none transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50",
        status === "open" && "border-dashed border-warning/70"
      )}
    >
      <span className={cn("flex min-w-0 items-center gap-1 font-medium", meta.className)}>
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{meta.label}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-foreground/85">
        {pillar ? <ColorDot color={pillar.color} /> : null}
        <span className="truncate">{slot.label || "Posting slot"}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
        {slot.platforms.map((platform) => (
          <PlatformIcon key={platform} platform={platform} label className="size-3" />
        ))}
        {time ? <span className="ml-auto truncate num">{time}</span> : null}
      </span>
    </Link>
  )
}

function WeekItem({ item }: { item: ContentItem }) {
  const published = isPublishedItem(item)
  return (
    <Link
      href={`/studio/${item.id}`}
      title={item.title}
      className="flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
      <span className={cn("min-w-0 flex-1 truncate", published && "text-muted-foreground")}>{item.title.trim() || "Untitled content"}</span>
      {published ? (
        <>
          <CircleCheck className="size-3 shrink-0 text-good-fg" aria-hidden />
          <span className="sr-only">Published</span>
        </>
      ) : item.scheduled_at ? (
        <span className="shrink-0 text-muted-foreground num @4xl:hidden">{formatTime(item.scheduled_at)}</span>
      ) : null}
    </Link>
  )
}

function DayCell({ day, beforeStart }: { day: WeekDay; beforeStart: boolean }) {
  const shown = day.items.slice(0, ITEMS_PER_DAY)
  const more = day.items.length - shown.length
  // Slots before the workspace existed were never missed.
  const slots = beforeStart ? [] : day.slots
  return (
    <li
      aria-label={format(day.date, "EEEE, MMM d")}
      aria-current={day.isToday ? "date" : undefined}
      className={cn(
        "flex min-w-0 gap-3 rounded-md border p-2 @4xl:flex-col @4xl:gap-2",
        day.isToday ? "border-brand/40 bg-brand-soft" : "border-transparent bg-muted/40 dark:bg-muted/25"
      )}
    >
      <div className="flex w-14 shrink-0 flex-col @4xl:w-auto @4xl:flex-row @4xl:items-center @4xl:justify-between">
        <span className={cn("text-xs font-medium", day.isPast && !day.isToday && "text-muted-foreground")}>{format(day.date, "EEE d")}</span>
        {day.isToday ? <span className="text-[11px] font-medium text-brand">Today</span> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {slots.map((weekSlot) => (
          <SlotChip key={weekSlot.slot.id} weekSlot={weekSlot} />
        ))}
        {beforeStart && !shown.length ? (
          <p className="px-1 text-xs text-muted-foreground">Before you started</p>
        ) : shown.length ? (
          <ul className="flex min-w-0 flex-col gap-px">
            {shown.map((item) => (
              <li key={item.id}>
                <WeekItem item={item} />
              </li>
            ))}
          </ul>
        ) : !day.slots.length ? (
          <p className="px-1 text-xs text-muted-foreground">Nothing planned</p>
        ) : null}
        {more > 0 ? (
          <Link href="/calendar" className="rounded-sm px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
            +{more} more
          </Link>
        ) : null}
      </div>
    </li>
  )
}

/** Mini calendar: posting slots vs scheduled / published posts for each day of this week. */
export function WeekCalendar({ days, startKey = null, className }: { days: WeekDay[]; startKey?: ISODate | null; className?: string }) {
  const posts = days.reduce((total, day) => total + day.items.length, 0)
  const open = days.reduce((total, day) => total + day.slots.filter((s) => s.status === "open").length, 0)
  return (
    <SectionCard
      title="This Week"
      description={`${pluralize(posts, "post")} scheduled or published · ${pluralize(open, "open slot")} left`}
      action={<CardLink href="/calendar">Open Calendar</CardLink>}
      className={className}
    >
      <ol className="grid grid-cols-1 gap-1.5 @4xl:grid-cols-7">
        {days.map((day) => (
          <DayCell key={day.key} day={day} beforeStart={Boolean(startKey && day.key < startKey)} />
        ))}
      </ol>
    </SectionCard>
  )
}
