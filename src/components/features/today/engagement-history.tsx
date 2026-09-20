import { Disclosure } from "@/components/common"
import { useT, type Translator } from "@/lib/i18n"
import { cn, formatNumber } from "@/lib/utils"
import type { EngagementDay } from "./engagement-utils"
import { rhythmMessages, todayMessages } from "./messages"

function describe(day: EngagementDay, t: Translator<typeof todayMessages.en>, r: Translator<typeof rhythmMessages.en>): string {
  if (!day.logged) return t("history_nothing", { day: day.label, date: day.date })
  const tasks = day.total ? r("tasks", { done: day.completed, total: day.total }) : t("history_no_tasks")
  return t("history_day", { day: day.label, date: day.date, tasks, replies: r.plural("replies", day.replies, { count: formatNumber(day.replies) }) })
}

/**
 * Seven small columns — share of engagement tasks done each day (4px rounded tops, ≤ 24px wide) — behind a
 * "Last 7 days" disclosure whose meta is the week in numbers (days active · days complete).
 */
export function EngagementHistory({ days, className }: { days: EngagementDay[]; className?: string }) {
  const t = useT(todayMessages)
  const r = useT(rhythmMessages)
  const active = days.filter((day) => day.completed > 0 || day.replies > 0).length
  const complete = days.filter((day) => day.total > 0 && day.completed >= day.total).length
  return (
    <Disclosure
      label={t("last_7")}
      meta={
        <span className="num">
          {active} {t("active")} · {complete} {t("complete")}
        </span>
      }
      storageKey="today-engagement-history"
      className={className}
    >
      <div className="flex flex-col gap-2">
      <ol className="grid grid-cols-7 gap-1.5" aria-label={t("history_aria")}>
        {days.map((day) => {
          const share = day.total ? day.completed / day.total : day.replies > 0 ? 1 : 0
          const height = day.logged ? Math.max(share * 100, 8) : 0
          return (
            <li key={day.date} className="flex min-w-0 flex-col items-center gap-1" title={describe(day, t, r)}>
              <div className="flex h-10 w-full max-w-6 items-end overflow-hidden rounded-[4px] bg-muted dark:bg-input/40">
                <div
                  aria-hidden
                  className={cn("w-full rounded-t-[4px] transition-[height] duration-300", !day.isToday && "opacity-70")}
                  style={{ height: `${height}%`, backgroundColor: "var(--cat-blue)" }}
                />
              </div>
              <span className={cn("text-[11px] text-muted-foreground", day.isToday && "font-semibold text-foreground")}>{day.label}</span>
              <span className="sr-only">{describe(day, t, r)}</span>
            </li>
          )
        })}
      </ol>
      </div>
    </Disclosure>
  )
}
