import { format } from "date-fns"
import { CircleCheck, CircleDashed, CircleSlash, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { ColorDot, PlatformIcon, SectionCard } from "@/components/common"
import { isPublishedItem } from "@/lib/analytics"
import { formatTime } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import type { ContentItem, ISODate } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { CardLink } from "./card-link"
import { formatSlotTime, type SlotStatus, type WeekDay, type WeekSlot } from "./dashboard-utils"
import { dashboardMessages } from "./messages"

const SLOT_STATUS: Record<SlotStatus, { label: keyof typeof dashboardMessages.en; icon: LucideIcon; className: string }> = {
  filled: { label: "slot_filled", icon: CircleCheck, className: "text-good-fg" },
  open: { label: "slot_open", icon: CircleDashed, className: "text-warning-fg" },
  missed: { label: "slot_missed", icon: CircleSlash, className: "text-muted-foreground" },
}

const ITEMS_PER_DAY = 3

function SlotChip({ weekSlot }: { weekSlot: WeekSlot }) {
  const t = useT(dashboardMessages)
  const { slot, pillar, status } = weekSlot
  const meta = SLOT_STATUS[status]
  const label = t(meta.label)
  const Icon = meta.icon
  const time = formatSlotTime(slot.time)
  return (
    <Link
      href="/calendar"
      title={`${label} · ${slot.label}${time ? ` · ${time}` : ""}`}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-md border bg-card px-2 py-1.5 text-xs outline-none transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50",
        status === "open" && "border-dashed border-warning/70"
      )}
    >
      <span className={cn("flex min-w-0 items-center gap-1 font-medium", meta.className)}>
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-foreground/85">
        {pillar ? <ColorDot color={pillar.color} /> : null}
        <span className="truncate">{slot.label || t("posting_slot")}</span>
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
  const t = useT(dashboardMessages)
  const published = isPublishedItem(item)
  return (
    <Link
      href={`/studio/${item.id}`}
      title={item.title}
      className="flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
      <span className={cn("min-w-0 flex-1 truncate", published && "text-muted-foreground")}>{item.title.trim() || t("untitled_content")}</span>
      {published ? (
        <>
          <CircleCheck className="size-3 shrink-0 text-good-fg" aria-hidden />
          <span className="sr-only">{t("published")}</span>
        </>
      ) : item.scheduled_at ? (
        <span className="shrink-0 text-muted-foreground num @4xl:hidden">{formatTime(item.scheduled_at)}</span>
      ) : null}
    </Link>
  )
}

function DayCell({ day, beforeStart }: { day: WeekDay; beforeStart: boolean }) {
  const t = useT(dashboardMessages)
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
        {day.isToday ? <span className="text-[11px] font-medium text-brand">{t("today_badge")}</span> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {slots.map((weekSlot) => (
          <SlotChip key={weekSlot.slot.id} weekSlot={weekSlot} />
        ))}
        {beforeStart && !shown.length ? (
          <p className="px-1 text-xs text-muted-foreground">{t("before_start")}</p>
        ) : shown.length ? (
          <ul className="flex min-w-0 flex-col gap-px">
            {shown.map((item) => (
              <li key={item.id}>
                <WeekItem item={item} />
              </li>
            ))}
          </ul>
        ) : !day.slots.length ? (
          <p className="px-1 text-xs text-muted-foreground">{t("nothing_planned")}</p>
        ) : null}
        {more > 0 ? (
          <Link href="/calendar" className="rounded-sm px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
            {t("more", { count: more })}
          </Link>
        ) : null}
      </div>
    </li>
  )
}

/** Mini calendar: posting slots vs scheduled / published posts for each day of this week. */
export function WeekCalendar({ days, startKey = null, className }: { days: WeekDay[]; startKey?: ISODate | null; className?: string }) {
  const t = useT(dashboardMessages)
  const posts = days.reduce((total, day) => total + day.items.length, 0)
  const open = days.reduce((total, day) => total + day.slots.filter((s) => s.status === "open").length, 0)
  return (
    <SectionCard
      title={t("week_title")}
      description={`${t.plural("week_posts", posts, { count: formatNumber(posts) })} · ${t.plural("week_open", open, { count: formatNumber(open) })}`}
      action={<CardLink href="/calendar">{t("open_calendar")}</CardLink>}
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
