"use client"

import { useMemo, useState } from "react"
import { ChartFrame, Heatmap, type ChartTable } from "@/components/charts"
import { SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT, useUiLang } from "@/lib/i18n"
import type { ID } from "@/lib/types"
import { FormatChip, PillarChip } from "./matrix-chips"
import { coverageGaps, type MatrixData } from "./matrix-data"
import { matrixMessages } from "./matrix-messages"
import { SegmentedToggle, type SegmentOption } from "./segmented-toggle"

type Scope = "all" | "published"

/** Format × pillar coverage heatmap of existing content (table twin) plus the biggest gaps, each one click from the matrix. */
export function MatrixCoverage({ data, onPlan }: { data: MatrixData; onPlan: (pillarId: ID, formatId: ID) => void }) {
  const t = useT(matrixMessages)
  const lang = useUiLang()
  const scopeOptions: SegmentOption<Scope>[] = [
    { value: "all", label: t("all_content") },
    { value: "published", label: t("published") },
  ]
  const [scope, setScope] = useState<Scope>("all")
  const counts = scope === "all" ? data.counts.all : data.counts.published

  const view = useMemo(() => {
    const cellValue = (pillarId: ID, formatId: ID) => counts.get(`${pillarId}|${formatId}`) ?? 0
    const cells = data.formats.flatMap((f) => data.pillars.map((p) => ({ row: f.id, col: p.id, value: cellValue(p.id, f.id) })))
    const table: ChartTable = {
      columns: [t("format"), ...data.pillars.map((p) => p.name), t("total")],
      rows: data.formats.map((f) => {
        const values = data.pillars.map((p) => cellValue(p.id, f.id))
        return [f.name, ...values, values.reduce((a, b) => a + b, 0)]
      }),
    }
    return { cells, table, gaps: coverageGaps(data, counts, undefined, lang) }
  }, [data, counts, t, lang])

  const pillarById = new Map(data.pillars.map((p) => [p.id, p]))
  const formatById = new Map(data.formats.map((f) => [f.id, f]))

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ChartFrame
        title={t("coverage_title")}
        description={scope === "all" ? t("coverage_all") : t("coverage_published")}
        table={view.table}
      >
        {/* Scope switch lives in the body so the header title keeps its width on narrow screens. */}
        <div className="flex flex-col gap-4">
          <SegmentedToggle value={scope} options={scopeOptions} onChange={setScope} aria-label={t("scope_aria")} className="self-start" />
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="min-w-[520px]">
              <Heatmap
                rows={data.formats.map((f) => ({ id: f.id, label: f.name }))}
                cols={data.pillars.map((p) => ({ id: p.id, label: p.name }))}
                cells={view.cells}
                valueLabel={t("items")}
                aria-label={t("heatmap_aria")}
                emptyMessage={t("heatmap_empty")}
              />
            </div>
          </div>
        </div>
      </ChartFrame>

      <SectionCard
        title={t("gaps_title")}
        description={t("gaps_description")}
        contentClassName={view.gaps.length ? "p-0" : undefined}
      >
        {view.gaps.length ? (
          <ul className="divide-y border-t">
            {view.gaps.map((gap) => {
              const pillar = pillarById.get(gap.pillarId)
              const format = formatById.get(gap.formatId)
              if (!pillar || !format) return null
              return (
                <li key={`${gap.pillarId}|${gap.formatId}`} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <PillarChip name={pillar.name} color={pillar.color} />
                      <span aria-hidden className="text-xs text-muted-foreground">
                        ×
                      </span>
                      <FormatChip name={format.name} category={format.category} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {gap.count ? t("only_items", { count: gap.count }) : t("no_content_yet")} · {gap.reason}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onPlan(gap.pillarId, gap.formatId)}
                    aria-label={t("plan_aria", { pillar: pillar.name, format: format.name })}
                  >
                    {t("plan")}
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("no_gaps")}</p>
        )}
      </SectionCard>
    </div>
  )
}
