"use client"

import { CircleCheck, Scale, TriangleAlert } from "lucide-react"
import { Meter, NumberField } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT, useUiLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { normalizeTo100, sumValues, TARGET_TOTAL, targetTotalError } from "./pillar-math"
import { pillarMessages } from "./pillar-messages"

export interface TargetRow {
  id: string
  label: string
  /** Identity mark before the label (pillar tile, funnel key…). */
  mark?: React.ReactNode
  /** Secondary line, e.g. "Actual 24% · last 30 days". */
  hint?: string
}

export type TargetValues = Record<string, number | null>

/** Whole-number % per row with a running total that must reach exactly 100, plus "Normalize to 100". */
export function TargetsEditor({
  rows,
  values,
  onChange,
  idPrefix,
  className,
}: {
  rows: TargetRow[]
  values: TargetValues
  onChange: (values: TargetValues) => void
  idPrefix: string
  className?: string
}) {
  const t = useT(pillarMessages)
  const lang = useUiLang()
  const total = sumValues(rows.map((r) => values[r.id]))
  const error = targetTotalError(total, lang)

  function normalize() {
    const next = normalizeTo100(rows.map((r) => values[r.id]))
    onChange(Object.fromEntries(rows.map((r, i) => [r.id, next[i]])))
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ul className="flex flex-col divide-y rounded-lg border">
        {rows.map((row) => {
          const inputId = `${idPrefix}-${row.id}`
          return (
            <li key={row.id} className="flex items-center gap-3 px-3 py-2">
              {row.mark}
              <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                <span className="block truncate text-sm font-medium">{row.label}</span>
                {row.hint ? <span className="block truncate text-xs text-muted-foreground">{row.hint}</span> : null}
              </label>
              <NumberField
                id={inputId}
                integer
                min={0}
                max={100}
                size="sm"
                suffix="%"
                className="w-24 shrink-0"
                value={values[row.id] ?? null}
                onChange={(value) => onChange({ ...values, [row.id]: value })}
                aria-label={t("row_target", { label: row.label })}
              />
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-baseline gap-2 text-sm">
            <span className="text-muted-foreground">{t("running_total")}</span>
            <span className="num font-semibold">{total}%</span>
            <span className="text-xs text-muted-foreground">{t("of_total", { total: TARGET_TOTAL })}</span>
          </p>
          <Button type="button" variant="outline" size="sm" onClick={normalize} disabled={!error || !rows.length}>
            <Scale aria-hidden />
            {t("normalize")}
          </Button>
        </div>
        <Meter
          value={Math.min(total, TARGET_TOTAL)}
          max={TARGET_TOTAL}
          tone={error ? (total > TARGET_TOTAL ? "serious" : "warning") : "good"}
          size="sm"
          aria-label={t("target_total_aria")}
          valueText={t("total_value", { total, max: TARGET_TOTAL })}
        />
        <p
          role={error ? "alert" : undefined}
          aria-live="polite"
          className={cn("flex items-center gap-1.5 text-xs", error ? "text-warning-fg" : "text-good-fg")}
        >
          {error ? <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> : <CircleCheck className="size-3.5 shrink-0" aria-hidden />}
          {error ?? t("total_ok")}
        </p>
      </div>
    </div>
  )
}
