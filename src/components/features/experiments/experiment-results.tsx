"use client"

import { CircleHelp, Trophy } from "lucide-react"
import { PageSection, StatusPill } from "@/components/common"
import { ChartFrame, ColumnChart } from "@/components/charts"
import { EXPERIMENT_MIN_LIFT, EXPERIMENT_MIN_N, type ExperimentResults } from "@/lib/analytics"
import type { ContentExperiment } from "@/lib/types"
import { formatDelta } from "@/lib/utils"
import { formatMetricValue, metricLabel, winnerLabel } from "./experiment-model"

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold num">{value}</span>
      {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

function Verdict({ experiment, results }: { experiment: ContentExperiment; results: ExperimentResults }) {
  const { a, b, suggestedWinner, reason } = results
  const thin = a.n < EXPERIMENT_MIN_N || b.n < EXPERIMENT_MIN_N
  const declared = experiment.winner
  const disagrees = declared !== null && suggestedWinner !== "inconclusive" && declared !== suggestedWinner

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
      <div className="flex flex-wrap items-center gap-2">
        {suggestedWinner === "inconclusive" ? (
          <StatusPill tone="warning" icon={CircleHelp}>
            {thin ? "Inconclusive — not enough data" : "Inconclusive — too close to call"}
          </StatusPill>
        ) : (
          <StatusPill tone="good" icon={Trophy}>
            Data suggests {winnerLabel(experiment, suggestedWinner)}
          </StatusPill>
        )}
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        {reason}.{" "}
        {thin
          ? "Link more published posts to each variant, or log analytics for the ones already linked."
          : `A winner is suggested only with at least ${EXPERIMENT_MIN_N} measured posts per variant and a lift of ${EXPERIMENT_MIN_LIFT}% or more.`}
      </p>
      {disagrees ? (
        <p className="text-xs text-pretty text-warning-fg">
          You recorded {winnerLabel(experiment, declared)} as the winner, but the current data points to variant{" "}
          {suggestedWinner.toUpperCase()}.
        </p>
      ) : null}
    </div>
  )
}

/** Per-variant n and mean, lift, the suggested winner and a two-column comparison (with a table view). */
export function ExperimentResultsPanel({ experiment, results }: { experiment: ContentExperiment; results: ExperimentResults }) {
  const metric = experiment.metric
  const label = metricLabel(metric)
  const { a, b, lift, suggestedWinner } = results
  const format = (value: number | null) => formatMetricValue(metric, value)
  const comparable = a.n > 0 && b.n > 0

  return (
    <PageSection
      id="experiment-results"
      title="Results"
      description={`Mean ${label.toLowerCase()} per variant, from each linked post's latest analytics snapshot.`}
    >
      <Verdict experiment={experiment} results={results} />
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Variant A" value={format(a.mean)} hint={`n = ${a.n} of ${a.items.length}`} />
        <MiniStat label="Variant B" value={format(b.mean)} hint={`n = ${b.n} of ${b.items.length}`} />
        <MiniStat label="Lift (B vs A)" value={lift === null ? "—" : formatDelta(lift)} hint={lift === null ? "Needs both means" : undefined} />
      </div>
      {comparable ? (
        <ChartFrame
          title={`Mean ${label.toLowerCase()}`}
          description={suggestedWinner === "inconclusive" ? "No winner suggested yet." : `Variant ${suggestedWinner.toUpperCase()} highlighted as the suggested winner.`}
          table={{
            columns: ["Variant", "Posts linked", "Measured (n)", `Mean ${label.toLowerCase()}`],
            rows: [
              [`A · ${experiment.variant_a || "Variant A"}`, a.items.length, a.n, format(a.mean)],
              [`B · ${experiment.variant_b || "Variant B"}`, b.items.length, b.n, format(b.mean)],
            ],
          }}
        >
          <ColumnChart
            height={180}
            labels="all"
            valueLabel={`Mean ${label.toLowerCase()}`}
            valueFormatter={(value) => formatMetricValue(metric, value)}
            highlight={suggestedWinner === "inconclusive" ? undefined : suggestedWinner}
            aria-label={`Mean ${label.toLowerCase()} by variant`}
            data={[
              { id: "a", label: "Variant A", value: a.mean ?? 0 },
              { id: "b", label: "Variant B", value: b.mean ?? 0 },
            ]}
          />
        </ChartFrame>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-pretty text-muted-foreground">
          The comparison chart appears once both variants have at least one measured post.
        </p>
      )}
    </PageSection>
  )
}
