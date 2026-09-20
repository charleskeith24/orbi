"use client"

import { ChartFrame, Heatmap } from "@/components/charts"
import { DAYS_OF_WEEK } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { formatCompact, formatNumber } from "@/lib/utils"
import { hourLabel, hourLongLabel } from "./format"
import { analyticsMessages } from "./messages"
import type { PostingHeatmapData } from "./scope"

const dayName = (day: number) => DAYS_OF_WEEK.find((d) => d.value === day)

/** Weekday × publish hour, shaded by average views. */
export function PostingHeatmap({ data, className }: { data: PostingHeatmapData; className?: string }) {
  const t = useT(analyticsMessages)
  const best = data.best
  return (
    <ChartFrame
      className={className}
      title={t("heatmap_title")}
      info={t.plural("heatmap_info", data.measured, { count: formatNumber(data.measured) })}
      table={{
        columns: ["Slot", "Posts", "Avg views"],
        rows: [...data.slots]
          .sort((a, b) => b.avgViews - a.avgViews)
          .map((s) => [`${dayName(s.day)?.label ?? ""} · ${hourLongLabel(s.hour)}`, s.posts, formatNumber(s.avgViews)]),
      }}
      footer={
        best ? (
          <>
            {t("best_slot")} <span className="font-medium text-foreground">{dayName(best.day)?.label} · {hourLongLabel(best.hour)}</span> —{" "}
            {t.plural("best_slot_rest", best.posts, { count: formatNumber(best.posts), views: formatCompact(best.avgViews) })}
            {best.posts < 2 ? t("one_post_hint") : null}
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
        emptyMessage={t("heatmap_empty")}
        aria-label={t("heatmap_aria")}
      />
    </ChartFrame>
  )
}
