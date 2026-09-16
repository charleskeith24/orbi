"use client"

import { ArrowRight, FileSpreadsheet, ScanSearch } from "lucide-react"
import { DatePicker, FormField, OptionSelect, PlatformIcon, PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { METRIC_FIELDS } from "@/lib/constants"
import { formatDate, formatDateTime } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import {
  columnDateOrder,
  detectDateOrder,
  getImportPreset,
  IMPORT_KEY_FIELDS,
  IMPORT_METRIC_KEYS,
  IMPORT_PRESETS,
  parseImportDate,
  watchTimeUnit,
  type ColumnMapping,
  type CsvTable,
  type DateOrder,
  type ImportField,
  type ImportPreset,
  type ImportPresetId,
  type PresetDetection,
} from "@/lib/integrations"
import type { ISODate, PlatformId } from "@/lib/types"
import { formatNumber, truncate } from "@/lib/utils"
import { m } from "./csv-messages"

/** A recognised export, or "generic" (match columns by name). */
export type PresetChoice = ImportPresetId | "generic"

const TOTAL_ROW = /^(?:grand\s+)?totals?$/i
const NUMERIC_DATE = /^\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/

/** First non-empty value in a column (skipping "Total" rows), for "e.g." hints. */
function sampleOf(table: CsvTable, index: number | undefined): string {
  if (index === undefined) return ""
  const row = table.rows.find((cells) => (cells[index] ?? "").trim() && !cells.some((cell) => TOTAL_ROW.test(cell.trim())))
  return row?.[index]?.trim() ?? ""
}

export function mappingReady(mapping: ColumnMapping): { hasKey: boolean; hasMetric: boolean } {
  return {
    hasKey: mapping.content_id !== undefined || mapping.url !== undefined || mapping.title !== undefined || mapping.caption !== undefined,
    hasMetric: IMPORT_METRIC_KEYS.some((key) => mapping[key] !== undefined),
  }
}

/** Step 2: which export this is (and why), which column holds which field, where and when. */
export function CsvMapping({
  fileName,
  table,
  mapping,
  onMap,
  detection,
  presetId,
  onPresetChange,
  platform,
  onPlatformChange,
  dateOrder,
  onDateOrderChange,
  recordedOn,
  onRecordedOnChange,
  today,
  reference,
  onBack,
  onNext,
}: {
  fileName: string
  table: CsvTable
  mapping: ColumnMapping
  onMap: (field: ImportField, index: number | undefined) => void
  detection: PresetDetection | null
  presetId: PresetChoice
  onPresetChange: (id: PresetChoice) => void
  platform: PlatformId | null
  onPlatformChange: (platform: PlatformId | null) => void
  dateOrder: DateOrder | null
  onDateOrderChange: (order: DateOrder) => void
  recordedOn: ISODate
  onRecordedOnChange: (date: ISODate) => void
  today: ISODate
  reference: Date
  onBack: () => void
  onNext: () => void
}) {
  const t = useT(m)
  const preset = getImportPreset(presetId)
  const options = table.headers.map((header, index) => ({ value: String(index), label: header }))
  const { hasKey, hasMetric } = mappingReady(mapping)
  const mappedMetrics = IMPORT_METRIC_KEYS.filter((key) => mapping[key] !== undefined).length
  const order = dateOrder ?? columnDateOrder(table, mapping, preset) ?? "mdy"
  const unit = watchTimeUnit(table, mapping)

  const publishedIndex = mapping.published
  const numericDates = publishedIndex === undefined ? [] : table.rows.map((cells) => cells[publishedIndex] ?? "").filter((v) => NUMERIC_DATE.test(v))
  const exampleDate = numericDates[0]?.trim().split(/[\sT]/)[0] ?? ""
  const askDateOrder = Boolean(exampleDate) && !preset && detectDateOrder(numericDates) === null

  const hint = (key: ImportField, fallback?: string): string | undefined => {
    const index = mapping[key]
    if (index === undefined) return fallback
    const raw = sampleOf(table, index)
    if (!raw) return t("sample_empty")
    const value = truncate(raw.replace(/\s+/g, " "), 36)
    if (key === "published") {
      const date = parseImportDate(raw, { order, reference })
      if (!date) return t("sample_date_bad", { value })
      return t("sample_date", { value, date: /\d:\d{2}/.test(raw) ? formatDateTime(date) : formatDate(date) })
    }
    if (key === "watch_time_seconds" && unit !== "seconds" && !raw.includes(":")) {
      return t(unit === "hours" ? "sample_hours" : "sample_minutes", { value })
    }
    if (key === "url" && preset?.urlFromCell && preset.urlFromCell(raw) !== raw) return t("sample_video_id", { value })
    return t("sample", { value })
  }

  const field = (key: ImportField, label: string, fallback?: string) => (
    <FormField key={key} label={label} htmlFor={`csv-map-${key}`} description={hint(key, fallback)}>
      <OptionSelect
        id={`csv-map-${key}`}
        size="sm"
        options={options}
        value={mapping[key] !== undefined ? String(mapping[key]) : null}
        onChange={(next) => onMap(key, next === null ? undefined : Number(next))}
        allowNone
        noneLabel={t("not_in_file")}
        placeholder={t("not_in_file")}
      />
    </FormField>
  )

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-medium text-foreground">{fileName}</span>
          <span className="shrink-0 num">
            · {t.plural("rows", table.rows.length, { count: formatNumber(table.rows.length) })} · {t.plural("columns", table.headers.length)}
          </span>
        </span>
        <Button type="button" variant="ghost" size="xs" onClick={onBack}>
          {t("choose_another")}
        </Button>
      </div>

      <PresetPanel detection={detection} preset={preset} presetId={presetId} onChange={onPresetChange} />

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium">{t("match_legend")}</legend>
        <p className="text-xs text-muted-foreground">{t("match_hint")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {IMPORT_KEY_FIELDS.map((f) => field(f.key, t(`field_${f.key}` as const), t(`field_${f.key}_hint` as const)))}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium">{t("metrics_legend")}</legend>
        <p className="text-xs text-muted-foreground">
          {mappedMetrics ? t.plural("metrics_mapped", mappedMetrics) : t("metrics_none")} {t("metrics_hint")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{METRIC_FIELDS.map((f) => field(f.key, f.label))}</div>
      </fieldset>

      <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
        <FormField label={t("platform_label")} htmlFor="csv-platform" description={t("platform_hint")}>
          <PlatformSelect id="csv-platform" size="sm" value={platform} onChange={onPlatformChange} allowNone noneLabel={t("platform_any")} />
        </FormField>
        <FormField label={t("recorded_label")} htmlFor="csv-recorded" description={t("recorded_hint")}>
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
        {askDateOrder ? (
          <FormField label={t("date_order_label", { example: exampleDate })} htmlFor="csv-date-order" description={t("date_order_hint")}>
            <OptionSelect
              id="csv-date-order"
              size="sm"
              value={order}
              onChange={(next) => {
                if (next === "mdy" || next === "dmy") onDateOrderChange(next)
              }}
              options={(["mdy", "dmy"] as const).map((value) => {
                const date = parseImportDate(exampleDate, { order: value, reference })
                return { value, label: t(value === "mdy" ? "date_order_mdy" : "date_order_dmy", { date: date ? formatDate(date) : "—" }) }
              })}
            />
          </FormField>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {!hasKey ? t("need_key") : !hasMetric ? t("need_metric") : t("nothing_written")}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            {t("back")}
          </Button>
          <Button type="button" size="sm" onClick={onNext} disabled={!hasKey || !hasMetric}>
            {t.plural("review_rows", table.rows.length, { count: formatNumber(table.rows.length) })}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Which export this is and why — with a Format picker to override it. */
function PresetPanel({
  detection,
  preset,
  presetId,
  onChange,
}: {
  detection: PresetDetection | null
  preset: ImportPreset | null
  presetId: PresetChoice
  onChange: (id: PresetChoice) => void
}) {
  const t = useT(m)
  const nameOf = (p: ImportPreset) => `${p.app} · ${t(`preset_${p.id}` as const)}`
  const detected = Boolean(detection && preset && detection.preset.id === preset.id)

  const title = preset
    ? t(detected ? "detected_title" : "chosen_title", { name: nameOf(preset) })
    : t(detection ? "generic_chosen_title" : "generic_title")
  const why =
    detected && detection
      ? [
          detection.headers.length ? t("detected_why", { headers: detection.headers.slice(0, 5).map((h) => `“${h}”`).join(", ") }) : "",
          detection.host ? t("detected_host", { host: detection.host }) : "",
          detection.postType ? t("detected_type", { type: detection.postType }) : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : ""
  const hint = preset ? t(detected ? "detected_hint" : "chosen_hint") : t(detection ? "generic_chosen_hint" : "generic_hint")

  const formatOptions = [
    ...IMPORT_PRESETS.map((p) => ({ value: p.id, label: nameOf(p), icon: <PlatformIcon platform={p.platform} className="text-muted-foreground" /> })),
    { value: "generic", label: t("format_generic"), icon: <ScanSearch className="text-muted-foreground" aria-hidden /> },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-start lg:justify-between" data-testid="csv-preset">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 dark:bg-input/30">
          {preset ? <PlatformIcon platform={preset.platform} colored className="size-4" /> : <ScanSearch className="size-4 text-muted-foreground" aria-hidden />}
        </span>
        <div className="min-w-0" aria-live="polite">
          <p className="text-sm leading-5 font-medium">{title}</p>
          {why ? <p className="text-xs text-pretty break-words text-muted-foreground">{why}</p> : null}
          <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
        </div>
      </div>
      <FormField label={t("format_label")} htmlFor="csv-format" className="w-full shrink-0 lg:w-72">
        <OptionSelect
          id="csv-format"
          size="sm"
          options={formatOptions}
          value={presetId}
          onChange={(next) => onChange(getImportPreset(next)?.id ?? "generic")}
        />
      </FormField>
    </div>
  )
}
