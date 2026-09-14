"use client"

import { ChartFrame, MixBar, type ChartColor, type ChartTable, type MixSegment, type MixTarget } from "@/components/charts"
import { TONE_ICON, TONE_TEXT } from "@/components/common"
import { MIN_MIX_SAMPLE, type FunnelMix, type PillarMix } from "@/lib/analytics"
import { FUNNEL_STAGES } from "@/lib/constants"
import type { FunnelStage } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"

/** Funnel stages have no identity colour: fixed categorical slots in funnel order. */
const FUNNEL_COLORS: Record<FunnelStage, ChartColor> = { tofu: "blue", mofu: "orange", bofu: "aqua" }

function points(deviation: number): string {
  const rounded = Math.round(deviation)
  return rounded === 0 ? "on target" : `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)} pts`
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
  description,
  className,
}: {
  pillars: PillarMix
  funnel: FunnelMix
  description?: string
  className?: string
}) {
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
    columns: ["Segment", "Posts", "Actual", "Target", "vs target"],
    rows: [
      ...pillars.rows.map((r) => [`Pillar · ${r.label}`, r.count, `${Math.round(r.actualPct)}%`, `${Math.round(r.targetPct)}%`, points(r.deviation)]),
      ...funnel.rows.map((r) => [
        `Funnel · ${FUNNEL_STAGES[r.stage].label}`,
        r.count,
        `${Math.round(r.actualPct)}%`,
        `${Math.round(r.targetPct)}%`,
        points(r.deviation),
      ]),
    ],
  }
  const WarningIcon = TONE_ICON.warning

  return (
    <ChartFrame title="Content Mix" description={description} table={table} className={cn("print:break-inside-avoid", className)}>
      <div className="flex flex-col gap-5">
        <MixGroup label="Pillars" note={pillars.unassigned ? `${formatNumber(pillars.unassigned)} without a pillar` : undefined}>
          <MixBar
            segments={pillarSegments}
            targets={pillarTargets}
            valueLabel="Posts"
            valueFormatter={formatNumber}
            emptyMessage="No posts with a pillar in this period."
            aria-label="Pillar mix vs targets"
          />
        </MixGroup>
        <MixGroup label="Funnel" note={funnel.unassigned ? `${formatNumber(funnel.unassigned)} without a stage` : undefined}>
          <MixBar
            segments={funnelSegments}
            targets={funnelTargets}
            valueLabel="Posts"
            valueFormatter={formatNumber}
            emptyMessage="No posts with a funnel stage in this period."
            aria-label="Funnel mix vs targets"
          />
        </MixGroup>
        {warnings.length ? (
          <ul className="flex flex-col gap-1.5" aria-label="Mix warnings">
            {warnings.map((w) => (
              <li key={`${w.key}-${w.direction}`} className="flex items-start gap-1.5 text-xs text-pretty">
                <WarningIcon className={cn("mt-px size-3.5 shrink-0", TONE_TEXT.warning)} aria-hidden />
                <span>
                  <span className="sr-only">Warning: </span>
                  {w.message}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-pretty text-muted-foreground">
            {pillars.enoughData || funnel.enoughData
              ? "Pillar and funnel mix are within tolerance of your targets."
              : `Mix warnings appear once at least ${MIN_MIX_SAMPLE} posts are counted.`}
          </p>
        )}
      </div>
    </ChartFrame>
  )
}
