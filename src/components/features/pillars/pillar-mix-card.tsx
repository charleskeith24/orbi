"use client"

import { CircleCheck, Scale, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { ChartFrame, MixBar, type ChartTable } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { MIN_MIX_SAMPLE, type PillarMix } from "@/lib/analytics"
import { pluralize } from "@/lib/utils"
import { formatPoints } from "./pillar-math"

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
  const table: ChartTable = {
    columns: ["Pillar", "Items", "Actual", "Target", "vs target"],
    rows: mix.rows.map((r) => [r.label, r.count, `${Math.round(r.actualPct)}%`, `${Math.round(r.targetPct)}%`, formatPoints(r.deviation)]),
  }
  const description = [
    `Published in the ${windowLabel} plus scheduled for the next 7 days`,
    pluralize(mix.total, "item"),
    mix.unassigned ? `${mix.unassigned} without a pillar` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <ChartFrame
      title="Content mix vs targets"
      description={description}
      table={table}
      className={className}
      footer={
        <>
          Pillars more than ±{tolerance} pts from target are flagged ·{" "}
          <Link href="/settings" className="underline-offset-4 hover:text-foreground hover:underline">
            change the tolerance in Settings
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <MixBar
          segments={mix.rows.map((r) => ({ id: r.key, label: r.label, value: r.count, color: r.pillar.color }))}
          targets={mix.rows.map((r) => ({ id: r.key, value: r.targetPct }))}
          valueLabel="Items"
          aria-label="Pillar mix, actual vs target"
          emptyMessage="Nothing published or scheduled in this window yet."
        />
        {targetTotal !== null && targetTotal !== 100 ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
          >
            <TriangleAlert className="size-3.5 shrink-0 text-warning-fg" aria-hidden />
            <span className="min-w-0 flex-1">
              Active pillar targets add up to <strong className="num font-semibold">{targetTotal}%</strong> — rebalance them to 100% so the
              comparison stays honest.
            </span>
            <Button type="button" size="xs" variant="outline" onClick={onSetTargets}>
              <Scale aria-hidden />
              Set targets
            </Button>
          </div>
        ) : null}
        <MixNotes mix={mix} />
      </div>
    </ChartFrame>
  )
}

function MixNotes({ mix }: { mix: PillarMix }) {
  if (!mix.total) return null
  if (!mix.enoughData) {
    return <p className="text-xs text-muted-foreground">Balance warnings start once {MIN_MIX_SAMPLE} or more items are in the window.</p>
  }
  if (!mix.warnings.length) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-good-fg">
        <CircleCheck className="size-3.5 shrink-0" aria-hidden />
        Every pillar is within its target range.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Imbalance warnings">
      {mix.warnings.map((warning) => (
        <li key={warning.key} className="flex items-start gap-2 text-xs">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-fg" aria-hidden />
          <span className="min-w-0">{warning.message}</span>
        </li>
      ))}
    </ul>
  )
}
