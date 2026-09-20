"use client"

import { CircleCheck, Scale, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { ChartFrame, MixBar, type ChartTable } from "@/components/charts"
import { InfoHint } from "@/components/common"
import { Button } from "@/components/ui/button"
import { MIN_MIX_SAMPLE, type PillarMix } from "@/lib/analytics"
import { useT, useUiLang } from "@/lib/i18n"
import { formatNumber } from "@/lib/utils"
import { formatPoints } from "./pillar-math"
import { pillarMessages } from "./pillar-messages"

/** Pillar mix: actual share vs targets (MixBar + table twin), imbalance warnings and a target-total check. */
export function PillarMixCard({
  mix,
  windowLabel,
  targetTotal,
  tolerance,
  onSetTargets,
  className,
}: {
  mix: PillarMix
  windowLabel: string
  /** Raw sum of active targets; a callout appears unless it is 100 (null hides the check). */
  targetTotal: number | null
  tolerance: number
  onSetTargets: () => void
  className?: string
}) {
  const t = useT(pillarMessages)
  const lang = useUiLang()
  const table: ChartTable = {
    columns: [t("pillar"), t("items"), t("actual"), t("target"), t("vs_target")],
    rows: mix.rows.map((r) => [
      r.label,
      r.count,
      `${Math.round(r.actualPct)}%`,
      `${Math.round(r.targetPct)}%`,
      formatPoints(r.deviation, lang),
    ]),
  }
  const description = [
    t.plural("items", mix.total, { count: formatNumber(mix.total) }),
    mix.unassigned ? t("without_pillar", { count: mix.unassigned }) : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <ChartFrame
      title={t("mix_title")}
      actions={
        <InfoHint title={t("mix_title")} align="end">
          <p>{t("mix_window", { window: windowLabel })}.</p>
          <p>
            {t("tolerance_note", { tolerance })}{" "}
            <Link href="/settings?tab=general" className="font-medium text-foreground underline-offset-2 hover:underline">
              {t("tolerance_link")}
            </Link>
          </p>
        </InfoHint>
      }
      description={description}
      table={table}
      className={className}
    >
      <div className="flex flex-col gap-4">
        <MixBar
          segments={mix.rows.map((r) => ({ id: r.key, label: r.label, value: r.count, color: r.pillar.color }))}
          targets={mix.rows.map((r) => ({ id: r.key, value: r.targetPct }))}
          valueLabel={t("items")}
          aria-label={t("mix_aria")}
          emptyMessage={t("mix_empty")}
        />
        {targetTotal !== null && targetTotal !== 100 ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
          >
            <TriangleAlert className="size-3.5 shrink-0 text-warning-fg" aria-hidden />
            <span className="min-w-0 flex-1">
              {t("targets_total_before")} <strong className="num font-semibold">{targetTotal}%</strong> {t("targets_total_after")}
            </span>
            <Button type="button" size="xs" variant="outline" onClick={onSetTargets}>
              <Scale aria-hidden />
              {t("set_targets")}
            </Button>
          </div>
        ) : null}
        <MixNotes mix={mix} />
      </div>
    </ChartFrame>
  )
}

function MixNotes({ mix }: { mix: PillarMix }) {
  const t = useT(pillarMessages)
  if (!mix.total) return null
  if (!mix.enoughData) {
    return <p className="text-xs text-muted-foreground">{t("balance_warnings_start", { count: MIN_MIX_SAMPLE })}</p>
  }
  if (!mix.warnings.length) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-good-fg">
        <CircleCheck className="size-3.5 shrink-0" aria-hidden />
        {t("every_pillar_ok")}
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-1.5" aria-label={t("imbalance_aria")}>
      {mix.warnings.map((warning) => (
        <li key={warning.key} className="flex items-start gap-2 text-xs">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-fg" aria-hidden />
          <span className="min-w-0">{warning.message}</span>
        </li>
      ))}
    </ul>
  )
}
