"use client"

import { Award, Hash, MessageSquareQuote } from "lucide-react"
import Link from "next/link"
import { ColorDot, FormatCategoryIcon, PlatformIcon, SectionCard } from "@/components/common"
import type { ReportHighlight, WeeklyReport } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { useLookup } from "@/lib/store"
import type { PlatformId } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { reportMessages } from "./messages"
import { formatHighlightMetric, rankedByLabel } from "./report-format"
import { weeklyReportMessages } from "./weekly-messages"

type HighlightField = "bestPlatform" | "bestPillar" | "bestTopic" | "bestFormat" | "bestHook"

const ROWS: { field: HighlightField; label: "row_platform" | "row_pillar" | "row_topic" | "row_format" | "row_hook" }[] = [
  { field: "bestPlatform", label: "row_platform" },
  { field: "bestPillar", label: "row_pillar" },
  { field: "bestTopic", label: "row_topic" },
  { field: "bestFormat", label: "row_format" },
  { field: "bestHook", label: "row_hook" },
]

/** Best platform, pillar, topic, format and hook style of the week (measured posts, winner metric). */
export function BestOfWeekCard({ report, className }: { report: WeeklyReport; className?: string }) {
  const t = useT(weeklyReportMessages)
  const r = useT(reportMessages)
  const pillars = useLookup("content_pillars")
  const formats = useLookup("content_formats")

  function lead(field: HighlightField, h: ReportHighlight) {
    const muted = "size-3.5 shrink-0 text-muted-foreground"
    switch (field) {
      case "bestPlatform":
        return <PlatformIcon platform={h.key as PlatformId} className={muted} />
      case "bestPillar":
        return <ColorDot color={pillars.get(h.key)?.color} className="shrink-0" />
      case "bestFormat":
        return <FormatCategoryIcon category={formats.get(h.key)?.category} className={muted} />
      case "bestTopic":
        return <Hash className={muted} aria-hidden />
      default:
        return <MessageSquareQuote className={muted} aria-hidden />
    }
  }

  return (
    <SectionCard
      title={t("best_of_week")}
      info={t("top_group_info", { metric: rankedByLabel(report.rankedBy) })}
      icon={Award}
      className={cn("print:break-inside-avoid", className)}
    >
      <dl className="flex flex-col divide-y">
        {ROWS.map(({ field, label }) => {
          const h = report[field]
          return (
            <div key={field} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 py-2 first:pt-0 last:pb-0">
              <dt className="text-xs text-muted-foreground">{t(label)}</dt>
              <dd className="min-w-0">
                {h ? (
                  <>
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                      {lead(field, h)}
                      {field === "bestPillar" ? (
                        <Link
                          href={`/pillars?open=${h.key}`}
                          className="truncate outline-none underline-offset-2 hover:underline focus-visible:underline"
                        >
                          {h.label}
                        </Link>
                      ) : (
                        <span className="truncate" title={h.label}>
                          {h.label}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground num">
                      {formatHighlightMetric(h)} · {r.plural("posts", h.posts, { count: formatNumber(h.posts) })}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">{t("not_enough_data")}</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </SectionCard>
  )
}
