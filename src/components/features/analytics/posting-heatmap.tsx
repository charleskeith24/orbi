"use client"

import { ChartFrame, Heatmap } from "@/components/charts"
import { DAYS_OF_WEEK } from "@/lib/constants"
import { formatCompact, formatNumber, pluralize } from "@/lib/utils"
import { hourLabel, hourLongLabel } from "./format"
import type { PostingHeatmapData } from "./scope"

const dayName = (day: number) => DAYS_OF_WEEK.find((d) => d.value === day)

/** Weekday × publish hour, shaded by average views. */
export function PostingHeatmap({ data, className }: { data: PostingHeatmapData; className?: string }) {
  const best = data.best
  return (
    <ChartFrame
      className={className}
      title="Best posting times"
      description={`Average views by publish day and hour · ${pluralize(data.measured, "measured post")}`}
      table={{
        columns: ["Slot", "Posts", "Avg views"],
        rows: [...data.slots]
          .sort((a, b) => b.avgViews - a.avgViews)
          .map((s) => [`${dayName(s.day)?.label ?? ""} · ${hourLongLabel(s.hour)}`, s.posts, formatNumber(s.avgViews)]),
      }}
      footer={
        best ? (
          <>
            Best slot: <span className="font-medium text-foreground">{dayName(best.day)?.label} · {hourLongLabel(best.hour)}</span> —{" "}
            {formatCompact(best.avgViews)} avg views across {pluralize(best.posts, "post")}.
            {best.posts < 2 ? " One post per slot so far — treat it as a hint, not a rule." : null}
          </>
        ) : undefined
      }
    >
      <Heatmap
        rows={data.days.map((day) => ({ id: String(day), label: dayName(day)?.short ?? "" }))}
        cols={data.hours.map((hour) => ({ id: String(hour), label: hourLabel(hour) }))}
        cells={data.slots.map((s) => ({ row: String(s.day), col: String(s.hour), value: s.avgViews }))}
        formatter={formatCompact}
        valueLabel="Avg views"
        cellHeight={26}
        emptyMessage="Log analytics on a few posts to see which days and hours perform best."
        aria-label="Average views by weekday and publish hour"
      />
    </ChartFrame>
  )
}
