import { cn, pluralize } from "@/lib/utils"
import type { EngagementDay } from "./engagement-utils"

function describe(day: EngagementDay): string {
  if (!day.logged) return `${day.label} ${day.date}: nothing logged`
  const tasks = day.total ? `${day.completed} of ${day.total} tasks` : "no tasks set"
  return `${day.label} ${day.date}: ${tasks}, ${pluralize(day.replies, "reply", "replies")}`
}

/** Seven small columns — share of engagement tasks done each day (4px rounded tops, ≤ 24px wide). */
export function EngagementHistory({ days, className }: { days: EngagementDay[]; className?: string }) {
  const active = days.filter((day) => day.completed > 0 || day.replies > 0).length
  const complete = days.filter((day) => day.total > 0 && day.completed >= day.total).length
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">Last 7 days</span>
        <span className="text-xs text-muted-foreground">
          <span className="num">{active}</span> active · <span className="num">{complete}</span> complete
        </span>
      </div>
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Engagement over the last 7 days">
        {days.map((day) => {
          const share = day.total ? day.completed / day.total : day.replies > 0 ? 1 : 0
          const height = day.logged ? Math.max(share * 100, 8) : 0
          return (
            <li key={day.date} className="flex min-w-0 flex-col items-center gap-1" title={describe(day)}>
              <div className="flex h-10 w-full max-w-6 items-end overflow-hidden rounded-[4px] bg-muted dark:bg-input/40">
                <div
                  aria-hidden
                  className={cn("w-full rounded-t-[4px] transition-[height] duration-300", !day.isToday && "opacity-70")}
                  style={{ height: `${height}%`, backgroundColor: "var(--cat-blue)" }}
                />
              </div>
              <span className={cn("text-[11px] text-muted-foreground", day.isToday && "font-semibold text-foreground")}>{day.label}</span>
              <span className="sr-only">{describe(day)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
