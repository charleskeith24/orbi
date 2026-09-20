"use client"

import { CircleHelp, Trophy } from "lucide-react"
import { PageSection, StatusPill } from "@/components/common"
import { ChartFrame, ColumnChart } from "@/components/charts"
import { EXPERIMENT_MIN_LIFT, EXPERIMENT_MIN_N, type ExperimentResults } from "@/lib/analytics"
import { useT, useUiLang } from "@/lib/i18n"
import type { ContentExperiment } from "@/lib/types"
import { formatDelta } from "@/lib/utils"
import { experimentSheetMessages } from "./detail-messages"
import { formatMetricValue, metricLabel, winnerLabel } from "./experiment-model"
import { experimentsMessages } from "./messages"

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
  const t = useT(experimentSheetMessages)
  const lang = useUiLang()
  const { a, b, suggestedWinner, reason } = results
  const thin = a.n < EXPERIMENT_MIN_N || b.n < EXPERIMENT_MIN_N
  const declared = experiment.winner
  const disagrees = declared !== null && suggestedWinner !== "inconclusive" && declared !== suggestedWinner

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
      <div className="flex flex-wrap items-center gap-2">
        {suggestedWinner === "inconclusive" ? (
          <StatusPill tone="warning" icon={CircleHelp}>
            {thin ? t("inconclusive_thin") : t("inconclusive_close")}
          </StatusPill>
        ) : (
          <StatusPill tone="good" icon={Trophy}>
            {t("data_suggests", { winner: winnerLabel(experiment, suggestedWinner, lang) })}
          </StatusPill>
        )}
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        {reason}.{" "}
        {thin ? t("thin_hint") : t("rule_hint", { min: EXPERIMENT_MIN_N, lift: EXPERIMENT_MIN_LIFT })}
      </p>
      {disagrees ? (
        <p className="text-xs text-pretty text-warning-fg">
          {t("disagrees", { winner: winnerLabel(experiment, declared, lang), letter: suggestedWinner.toUpperCase() })}
        </p>
      ) : null}
    </div>
  )
}

/** Per-variant n and mean, lift, the suggested winner and a two-column comparison (with a table view). */
export function ExperimentResultsPanel({ experiment, results }: { experiment: ContentExperiment; results: ExperimentResults }) {
  const t = useT(experimentSheetMessages)
  const tx = useT(experimentsMessages)
  const metric = experiment.metric
  const label = metricLabel(metric)
  const { a, b, lift, suggestedWinner } = results
  const format = (value: number | null) => formatMetricValue(metric, value)
  const comparable = a.n > 0 && b.n > 0
  const lower = label.toLowerCase()
  const variantA = tx("variant", { letter: "A" })
  const variantB = tx("variant", { letter: "B" })

  return (
    <PageSection
      id="experiment-results"
      title={t("results")}
      info={t("results_info", { metric: lower })}
    >
      <Verdict experiment={experiment} results={results} />
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label={variantA} value={format(a.mean)} hint={t("n_of", { n: a.n, total: a.items.length })} />
        <MiniStat label={variantB} value={format(b.mean)} hint={t("n_of", { n: b.n, total: b.items.length })} />
        <MiniStat label={t("lift")} value={lift === null ? "—" : formatDelta(lift)} hint={lift === null ? t("needs_both") : undefined} />
      </div>
      {comparable ? (
        <ChartFrame
          title={t("mean_metric", { metric: lower })}
          description={
            suggestedWinner === "inconclusive" ? t("no_winner_yet") : t("highlighted", { letter: suggestedWinner.toUpperCase() })
          }
          table={{
            columns: [t("col_variant"), t("col_linked"), t("col_measured"), t("mean_metric", { metric: lower })],
            rows: [
              [`A · ${experiment.variant_a || variantA}`, a.items.length, a.n, format(a.mean)],
              [`B · ${experiment.variant_b || variantB}`, b.items.length, b.n, format(b.mean)],
            ],
          }}
        >
          <ColumnChart
            height={180}
            labels="all"
            valueLabel={t("mean_metric", { metric: lower })}
            valueFormatter={(value) => formatMetricValue(metric, value)}
            highlight={suggestedWinner === "inconclusive" ? undefined : suggestedWinner}
            aria-label={t("chart_aria", { metric: lower })}
            data={[
              { id: "a", label: variantA, value: a.mean ?? 0 },
              { id: "b", label: variantB, value: b.mean ?? 0 },
            ]}
          />
        </ChartFrame>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-pretty text-muted-foreground">
          {t("chart_empty")}
        </p>
      )}
    </PageSection>
  )
}
