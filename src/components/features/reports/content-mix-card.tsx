"use client"

import { ChartFrame, MixBar, type ChartColor, type ChartTable, type MixSegment, type MixTarget } from "@/components/charts"
import { TONE_ICON, TONE_TEXT } from "@/components/common"
import { MIN_MIX_SAMPLE, type FunnelMix, type PillarMix } from "@/lib/analytics"
import { FUNNEL_STAGES } from "@/lib/constants"
import { useT, type Translator } from "@/lib/i18n"
import type { FunnelStage } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { reportMessages } from "./messages"

/** Funnel stages have no identity colour: fixed categorical slots in funnel order. */
const FUNNEL_COLORS: Record<FunnelStage, ChartColor> = { tofu: "blue", mofu: "orange", bofu: "aqua" }

function points(deviation: number, t: Translator<(typeof reportMessages)["en"]>): string {
  const rounded = Math.round(deviation)
  return rounded === 0 ? t("on_target") : t("points", { sign: rounded > 0 ? "+" : "−", count: Math.abs(rounded) })
}

function MixGroup({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">{label}</h4>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      </div>
      {children}
    </div>
  )
}

/** Pillar and funnel mix of the period vs targets (100% stacked bars with target lanes) + warnings. */
export function ContentMixCard({
  pillars,
  funnel,
  info,
  className,
}: {
  pillars: PillarMix
  funnel: FunnelMix
  info?: string
  className?: string
}) {
  const t = useT(reportMessages)
  const pillarSegments: MixSegment[] = pillars.rows.map((r) => ({ id: r.key, label: r.label, value: r.count, color: r.pillar.color }))
  const pillarTargets: MixTarget[] = pillars.rows.map((r) => ({ id: r.key, value: r.targetPct }))
  const funnelSegments: MixSegment[] = funnel.rows.map((r) => ({
    id: r.key,
    label: `${FUNNEL_STAGES[r.stage].label} · ${FUNNEL_STAGES[r.stage].name}`,
    value: r.count,
    color: FUNNEL_COLORS[r.stage],
  }))
  const funnelTargets: MixTarget[] = funnel.rows.map((r) => ({ id: r.key, value: r.targetPct }))
  const warnings = [...pillars.warnings, ...funnel.warnings]
  const table: ChartTable = {
    columns: [t("col_segment"), t("col_posts"), t("col_actual"), t("col_target"), t("col_vs_target")],
    rows: [
      ...pillars.rows.map((r) => [
        t("row_pillar", { label: r.label }),
        r.count,
        `${Math.round(r.actualPct)}%`,
        `${Math.round(r.targetPct)}%`,
        points(r.deviation, t),
      ]),
      ...funnel.rows.map((r) => [
        t("row_funnel", { label: FUNNEL_STAGES[r.stage].label }),
        r.count,
        `${Math.round(r.actualPct)}%`,
        `${Math.round(r.targetPct)}%`,
        points(r.deviation, t),
      ]),
    ],
  }
  const WarningIcon = TONE_ICON.warning

  return (
    <ChartFrame title="Content Mix" info={info} table={table} className={cn("print:break-inside-avoid", className)}>
      <div className="flex flex-col gap-5">
        <MixGroup label={t("pillars")} note={pillars.unassigned ? t("without_pillar", { count: formatNumber(pillars.unassigned) }) : undefined}>
          <MixBar
            segments={pillarSegments}
            targets={pillarTargets}
            valueLabel={t("col_posts")}
            valueFormatter={formatNumber}
            emptyMessage={t("no_pillar_posts")}
            aria-label={t("pillar_mix_aria")}
          />
        </MixGroup>
        <MixGroup label={t("funnel")} note={funnel.unassigned ? t("without_stage", { count: formatNumber(funnel.unassigned) }) : undefined}>
          <MixBar
            segments={funnelSegments}
            targets={funnelTargets}
            valueLabel={t("col_posts")}
            valueFormatter={formatNumber}
            emptyMessage={t("no_funnel_posts")}
            aria-label={t("funnel_mix_aria")}
          />
        </MixGroup>
        {warnings.length ? (
          <ul className="flex flex-col gap-1.5" aria-label={t("mix_warnings")}>
            {warnings.map((w) => (
              <li key={`${w.key}-${w.direction}`} className="flex items-start gap-1.5 text-xs text-pretty">
                <WarningIcon className={cn("mt-px size-3.5 shrink-0", TONE_TEXT.warning)} aria-hidden />
                <span>
                  <span className="sr-only">{t("warning_sr")}</span>
                  {w.message}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-pretty text-muted-foreground">
            {pillars.enoughData || funnel.enoughData ? t("mix_ok") : t("mix_min", { min: MIN_MIX_SAMPLE })}
          </p>
        )}
      </div>
    </ChartFrame>
  )
}
