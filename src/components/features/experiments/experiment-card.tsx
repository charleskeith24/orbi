"use client"

import { Trophy } from "lucide-react"
import { useMemo } from "react"
import { Meter } from "@/components/common"
import { experimentResults, type VariantResult } from "@/lib/analytics"
import { useDb } from "@/lib/store"
import type { ContentExperiment, ExperimentMetric, ID } from "@/lib/types"
import { cn, formatDelta } from "@/lib/utils"
import { experimentTiming, formatMetricValue, metricLabel, type Variant } from "./experiment-model"
import { ExperimentStatusPill, VariantMark, WinnerPill } from "./experiment-status"

function VariantLine({
  variant,
  name,
  result,
  metric,
  won,
}: {
  variant: Variant
  name: string
  result: VariantResult
  metric: ExperimentMetric
  won: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <VariantMark variant={variant} />
      <span className={cn("min-w-0 flex-1 truncate", won ? "font-medium text-foreground" : "text-foreground/90")}>
        {name || `Variant ${variant.toUpperCase()}`}
      </span>
      {won ? (
        <>
          <Trophy className="size-3.5 shrink-0 text-good-fg" aria-hidden />
          <span className="sr-only">(winner)</span>
        </>
      ) : null}
      <span className="shrink-0 text-muted-foreground num">
        {result.n ? (
          <>
            <span className="font-medium text-foreground">{formatMetricValue(metric, result.mean)}</span> · n={result.n}
          </>
        ) : result.items.length ? (
          `${result.items.length} linked · no data`
        ) : (
          "No posts yet"
        )}
      </span>
    </div>
  )
}

/** One experiment in the grouped list; the name is a stretched button that opens the detail sheet. */
export function ExperimentCard({ experiment, now, onOpen }: { experiment: ContentExperiment; now: Date; onOpen: (id: ID) => void }) {
  const db = useDb()
  const results = useMemo(() => experimentResults(db, experiment), [db, experiment])
  const timing = experimentTiming(experiment, now)
  const declared = experiment.status === "completed" ? experiment.winner : null
  const showLift = results.lift !== null && results.a.n > 0 && results.b.n > 0

  return (
    <article className="relative flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm leading-5 font-medium">
            <button
              type="button"
              onClick={() => onOpen(experiment.id)}
              className="block w-full text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring/60"
            >
              <span className="line-clamp-2 text-pretty">{experiment.name || "Untitled experiment"}</span>
            </button>
          </h3>
          {experiment.hypothesis ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-pretty text-muted-foreground">{experiment.hypothesis}</p>
          ) : null}
        </div>
        {declared ? <WinnerPill winner={declared} /> : <ExperimentStatusPill status={experiment.status} />}
      </div>

      <div className="flex flex-col gap-1.5">
        <VariantLine variant="a" name={experiment.variant_a} result={results.a} metric={experiment.metric} won={declared === "a"} />
        <VariantLine variant="b" name={experiment.variant_b} result={results.b} metric={experiment.metric} won={declared === "b"} />
      </div>

      {timing.progress !== null ? <Meter value={Math.round(timing.progress * 100)} size="sm" aria-label="Time elapsed" /> : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{metricLabel(experiment.metric)}</span>
        <span>{timing.label}</span>
        {showLift ? (
          <span className="num">
            B vs A <span className="font-medium text-foreground">{formatDelta(results.lift)}</span>
          </span>
        ) : null}
      </div>

      {experiment.status === "completed" && experiment.lesson ? (
        <p className="line-clamp-2 border-t pt-3 text-xs text-pretty">
          <span className="font-medium">Lesson · </span>
          <span className="text-muted-foreground">{experiment.lesson}</span>
        </p>
      ) : null}
    </article>
  )
}
