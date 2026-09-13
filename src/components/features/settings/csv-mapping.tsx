"use client"

import { ArrowRight, FileSpreadsheet } from "lucide-react"
import { DatePicker, FormField, OptionSelect, PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { METRIC_FIELDS } from "@/lib/constants"
import { IMPORT_KEY_FIELDS, IMPORT_METRIC_KEYS, type ColumnMapping, type CsvTable, type ImportField } from "@/lib/integrations"
import type { ISODate, PlatformId } from "@/lib/types"
import { pluralize, truncate } from "@/lib/utils"

/** First non-empty value in a column, for "e.g." hints. */
function sampleOf(table: CsvTable, index: number | undefined): string {
  if (index === undefined) return ""
  const value = table.rows.find((cells) => (cells[index] ?? "").trim())?.[index]?.trim() ?? ""
  return truncate(value, 36)
}

export function mappingReady(mapping: ColumnMapping): { hasKey: boolean; hasMetric: boolean } {
  return {
    hasKey: mapping.content_id !== undefined || mapping.url !== undefined || mapping.title !== undefined,
    hasMetric: IMPORT_METRIC_KEYS.some((key) => mapping[key] !== undefined),
  }
}

/** Step 2: which column holds which field, where the export is from, and when it was measured. */
export function CsvMapping({
  fileName,
  table,
  mapping,
  onMap,
  platform,
  onPlatformChange,
  recordedOn,
  onRecordedOnChange,
  today,
  onBack,
  onNext,
}: {
  fileName: string
  table: CsvTable
  mapping: ColumnMapping
  onMap: (field: ImportField, index: number | undefined) => void
  platform: PlatformId | null
  onPlatformChange: (platform: PlatformId | null) => void
  recordedOn: ISODate
  onRecordedOnChange: (date: ISODate) => void
  today: ISODate
  onBack: () => void
  onNext: () => void
}) {
  const options = table.headers.map((header, index) => ({ value: String(index), label: header }))
  const { hasKey, hasMetric } = mappingReady(mapping)
  const mappedMetrics = IMPORT_METRIC_KEYS.filter((key) => mapping[key] !== undefined).length

  const field = (key: ImportField, label: string, hint?: string) => {
    const index = mapping[key]
    const sample = sampleOf(table, index)
    return (
      <FormField
        key={key}
        label={label}
        htmlFor={`csv-map-${key}`}
        description={index !== undefined ? (sample ? `e.g. “${sample}”` : "Empty in the first rows") : hint}
      >
        <OptionSelect
          id={`csv-map-${key}`}
          size="sm"
          options={options}
          value={index !== undefined ? String(index) : null}
          onChange={(next) => onMap(key, next === null ? undefined : Number(next))}
          allowNone
          noneLabel="Not in file"
          placeholder="Not in file"
        />
      </FormField>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-medium text-foreground">{fileName}</span>
          <span className="shrink-0 num">
            · {pluralize(table.rows.length, "row")} · {pluralize(table.headers.length, "column")}
          </span>
        </span>
        <Button type="button" variant="ghost" size="xs" onClick={onBack}>
          Choose another file
        </Button>
      </div>

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium">Match posts by</legend>
        <p className="text-xs text-muted-foreground">Map at least one of content ID, post URL or title. Columns were matched by name — check them.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {IMPORT_KEY_FIELDS.map((f) => field(f.key, f.label, f.description))}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium">Metrics</legend>
        <p className="text-xs text-muted-foreground">
          {mappedMetrics ? `${pluralize(mappedMetrics, "metric")} mapped.` : "Map at least one metric."} Watch time must be in
          seconds; retention in percent.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {METRIC_FIELDS.map((m) => field(m.key, m.label))}
        </div>
      </fieldset>

      <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
        <FormField label="Posts are from" htmlFor="csv-platform" description="Used when a row has no platform column or recognisable URL.">
          <PlatformSelect id="csv-platform" size="sm" value={platform} onChange={onPlatformChange} allowNone noneLabel="Any platform" />
        </FormField>
        <FormField label="Recorded on" htmlFor="csv-recorded" description="The day these numbers were measured — usually the export date.">
          <DatePicker
            id="csv-recorded"
            size="sm"
            value={recordedOn}
            clearable={false}
            maxDate={today}
            onChange={(next) => {
              if (next) onRecordedOnChange(next)
            }}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {!hasKey ? "Map a content ID, URL or title column to match posts." : !hasMetric ? "Map at least one metric column." : "Nothing is written until you confirm the next step."}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            Back
          </Button>
          <Button type="button" size="sm" onClick={onNext} disabled={!hasKey || !hasMetric}>
            Review {pluralize(table.rows.length, "row")}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
