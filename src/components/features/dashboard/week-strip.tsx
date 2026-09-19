import { format } from "date-fns"
import { CircleCheck, CircleDashed, CircleSlash, Clock3, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { SectionHeader } from "@/components/common"
import { useT, type Translator } from "@/lib/i18n"
import type { ISODate } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CardLink } from "./card-link"
import { dayMarks, weekRangeLabel, type DayMarks, type WeekDay } from "./dashboard-utils"
import { dashboardMessages } from "./messages"

type T = Translator<typeof dashboardMessages.en>

/** Marks per day before "+N". */
const MAX_MARKS = 3

const MARKS: { key: keyof DayMarks; icon: LucideIcon; className: string; legend: keyof typeof dashboardMessages.en }[] = [
  { key: "published", icon: CircleCheck, className: "text-good-fg", legend: "published" },
  { key: "scheduled", icon: Clock3, className: "text-muted-foreground", legend: "legend_scheduled" },
  { key: "open", icon: CircleDashed, className: "text-warning-fg", legend: "slot_open" },
  { key: "missed", icon: CircleSlash, className: "text-muted-foreground/70", legend: "slot_missed" },
]

function daySummary(marks: DayMarks, t: T): string {
  const parts = [
    marks.published ? t.plural("day_published", marks.published) : null,
    marks.scheduled ? t.plural("day_scheduled", marks.scheduled) : null,
    marks.open ? t.plural("day_open", marks.open) : null,
    marks.missed ? t.plural("day_missed", marks.missed) : null,
  ].filter(Boolean)
  return parts.length ? parts.join(", ") : t("nothing_planned")
}

function DayCell({ day, beforeStart, t }: { day: WeekDay; beforeStart: boolean; t: T }) {
  const marks = dayMarks(day, beforeStart)
  const icons = MARKS.flatMap((mark) => Array.from({ length: marks[mark.key] }, () => mark))
  const shown = icons.slice(0, MAX_MARKS)
  const more = icons.length - shown.length
  const titles = day.items.map((item) => item.title.trim()).filter(Boolean)
  return (
    <li className="min-w-0">
      <Link
        href="/calendar"
        aria-label={`${format(day.date, "EEEE, MMM d")}${day.isToday ? ` (${t("today_badge")})` : ""}: ${daySummary(marks, t)}`}
        aria-current={day.isToday ? "date" : undefined}
        title={titles.length ? titles.join("\n") : undefined}
        className={cn(
          "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 pt-2 pb-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
          day.isToday ? "bg-brand-soft" : "bg-muted/40 hover:bg-muted dark:bg-muted/25"
        )}
      >
        <span className={cn("text-[11px] font-medium", day.isToday ? "text-brand" : "text-muted-foreground")}>{format(day.date, "EEE")}</span>
        <span
          className={cn(
            "text-base leading-6 font-semibold num",
            day.isPast && !day.isToday && "text-muted-foreground",
            day.isToday && "text-brand"
          )}
        >
          {format(day.date, "d")}
        </span>
        <span className="flex h-3.5 items-center gap-0.5" aria-hidden>
          {shown.map((mark, i) => {
            const Icon = mark.icon
            return <Icon key={i} className={cn("size-3 shrink-0", mark.className)} />
          })}
          {more > 0 ? <span className="text-[10px] leading-none text-muted-foreground num">+{more}</span> : null}
        </span>
      </Link>
    </li>
  )
}

/** This week at a glance: each day's posts and open or missed posting slots. Titles are on the Calendar. */
export function WeekStrip({ days, startKey = null, className }: { days: WeekDay[]; startKey?: ISODate | null; className?: string }) {
  const t = useT(dashboardMessages)
  const present = new Set(
    days.flatMap((day) => {
      const marks = dayMarks(day, Boolean(startKey && day.key < startKey))
      return MARKS.filter((mark) => marks[mark.key] > 0).map((mark) => mark.key)
    })
  )
  const legend = MARKS.filter((mark) => present.has(mark.key))
  const first = days[0]?.date
  const last = days[days.length - 1]?.date
  return (
    <section aria-labelledby="home-week" className={cn("flex min-w-0 flex-col gap-2", className)}>
      <SectionHeader
        id="home-week"
        title={
          <>
            {t("week_title")}
            {first && last ? <span className="ml-2 font-normal text-muted-foreground">{weekRangeLabel(first, last)}</span> : null}
          </>
        }
        // Phones have Calendar in the bottom bar.
        action={<CardLink href="/calendar" className="@max-xl:hidden">Calendar</CardLink>}
      />
      <ol className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day) => (
          <DayCell key={day.key} day={day} beforeStart={Boolean(startKey && day.key < startKey)} t={t} />
        ))}
      </ol>
      {legend.length ? (
        <ul className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-hidden>
          {legend.map((mark) => {
            const Icon = mark.icon
            return (
              <li key={mark.key} className="flex items-center gap-1">
                <Icon className={cn("size-3", mark.className)} />
                {t(mark.legend)}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
