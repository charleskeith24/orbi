"use client"

import { CircleAlert, CircleCheck, ClipboardPaste, Download, FileSpreadsheet, FileWarning, Upload } from "lucide-react"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { SectionCard } from "@/components/common"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { latestMetricsByItem } from "@/lib/analytics"
import { toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import {
  autoMapColumns,
  bootstrapItemValues,
  buildImportSnapshot,
  buildTemplateCsv,
  decodeCsvBytes,
  detectPreset,
  getImportPreset,
  importCandidates,
  isSpreadsheetFileName,
  MAX_CSV_ROWS,
  planBootstrap,
  planImport,
  readCsvTable,
  readImportRows,
  summarizeImport,
  type ColumnMapping,
  type CsvTable,
  type DateOrder,
  type ImportField,
  type PresetDetection,
} from "@/lib/integrations"
import { logMetrics, logPublishedPost, useDataStore, useTable } from "@/lib/store"
import type { ID, ISODate, PlatformId } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { bootstrapTitle } from "./csv-bootstrap"
import { CsvExportGuide } from "./csv-export-guide"
import { CsvMapping, type PresetChoice } from "./csv-mapping"
import { m, type CsvMessageKey } from "./csv-messages"
import { CsvReview } from "./csv-review"
import { downloadCsvFile } from "./download"

type Step = "source" | "map" | "review" | "done"
type ImportError = { kind: "spreadsheet" } | { kind: "message"; key: CsvMessageKey; vars?: Record<string, string> }

const MAX_FILE_BYTES = 5 * 1024 * 1024
const STEPS: { key: Exclude<Step, "done">; label: CsvMessageKey }[] = [
  { key: "source", label: "step_file" },
  { key: "map", label: "step_columns" },
  { key: "review", label: "step_review" },
]

/**
 * Manual analytics import: CSV (Meta Business Suite, TikTok Studio and YouTube Studio exports are
 * recognised) → column mapping → match review (optionally creating posts for unmatched rows) →
 * `logMetrics` per matched post, `logPublishedPost` + `logMetrics` per new post.
 */
export function CsvImport({ now }: { now: Date }) {
  const t = useT(m)
  const items = useTable("content_items")
  const candidates = useMemo(() => importCandidates({ content_items: items }), [items])
  const publishedCount = useMemo(() => candidates.filter((c) => c.published).length, [candidates])
  const today = toISODate(now)
  const reference = useMemo(() => new Date(`${today}T23:59:59`), [today])

  const [step, setStep] = useState<Step>("source")
  const [source, setSource] = useState<{ name: string; table: CsvTable } | null>(null)
  const [detection, setDetection] = useState<PresetDetection | null>(null)
  const [presetId, setPresetId] = useState<PresetChoice>("generic")
  const [error, setError] = useState<ImportError | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [platform, setPlatform] = useState<PlatformId | null>(null)
  const [dateOrder, setDateOrder] = useState<DateOrder | null>(null)
  const [recordedOn, setRecordedOn] = useState<ISODate>(today)
  const [overrides, setOverrides] = useState<Map<number, ID | null>>(() => new Map())
  const [bootstrapOn, setBootstrapOn] = useState(false)
  const [unticked, setUnticked] = useState<Set<number>>(() => new Set())
  const [result, setResult] = useState<{ imported: number; created: number; skipped: number; file: string } | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const importing = useRef(false)

  const preset = useMemo(() => getImportPreset(presetId), [presetId])
  const rows = useMemo(
    () => (source ? readImportRows(source.table, mapping, { preset, dateOrder, reference }) : []),
    [source, mapping, preset, dateOrder, reference]
  )
  const plan = useMemo(() => planImport(rows, candidates, { platform }, overrides), [rows, candidates, platform, overrides])
  const summary = useMemo(() => summarizeImport(plan), [plan])
  const bootstrap = useMemo(() => planBootstrap(plan, candidates, { platform }), [plan, candidates, platform])
  const selected = useMemo(
    () => new Set(bootstrapOn ? bootstrap.filter((b) => !b.problem && !unticked.has(b.row.index)).map((b) => b.row.index) : []),
    [bootstrap, bootstrapOn, unticked]
  )

  function resetChoices() {
    setOverrides(new Map())
    setUnticked(new Set())
  }

  function load(name: string, text: string) {
    const read = readCsvTable(text)
    if (!read.ok) {
      setError(
        read.code === "too_many_rows"
          ? { kind: "message", key: "error_too_many_rows", vars: { rows: formatNumber(read.rows ?? 0), max: formatNumber(MAX_CSV_ROWS) } }
          : { kind: "message", key: read.code === "empty" ? "error_empty" : "error_no_rows" }
      )
      return
    }
    const found = detectPreset(read.table.headers, read.table.rows)
    setError(null)
    setSource({ name, table: read.table })
    setDetection(found)
    setPresetId(found?.preset.id ?? "generic")
    setMapping(autoMapColumns(read.table.headers, found?.preset))
    setPlatform(found?.preset.platform ?? null)
    setDateOrder(null)
    setBootstrapOn(false)
    resetChoices()
    setPasting(false)
    setPasteText("")
    setStep("map")
  }

  async function readFile(file: File | undefined) {
    if (!file) return
    if (isSpreadsheetFileName(file.name)) {
      setError({ kind: "spreadsheet" })
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError({ kind: "message", key: "error_too_big" })
      return
    }
    try {
      const decoded = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()))
      if (!decoded.ok) {
        setError(decoded.code === "spreadsheet" ? { kind: "spreadsheet" } : { kind: "message", key: "error_binary" })
        return
      }
      load(file.name, decoded.text)
    } catch {
      setError({ kind: "message", key: "error_read" })
    }
  }

  function reset() {
    setStep("source")
    setSource(null)
    setDetection(null)
    setPresetId("generic")
    setMapping({})
    setBootstrapOn(false)
    resetChoices()
    setResult(null)
    setError(null)
  }

  function changePreset(id: PresetChoice) {
    if (!source) return
    const next = getImportPreset(id)
    setPresetId(next?.id ?? "generic")
    setMapping(autoMapColumns(source.table.headers, next))
    if (next) setPlatform(next.platform)
    setDateOrder(null)
    resetChoices()
  }

  function onMap(field: ImportField, index: number | undefined) {
    setMapping((current) => {
      const next = { ...current }
      if (index === undefined) delete next[field]
      else next[field] = index
      return next
    })
    resetChoices()
  }

  function onOverride(rowIndex: number, itemId: ID | null | undefined) {
    setOverrides((current) => {
      const next = new Map(current)
      if (itemId === undefined) next.delete(rowIndex)
      else next.set(rowIndex, itemId)
      return next
    })
  }

  function onBootstrapRow(rowIndex: number, create: boolean) {
    setUnticked((current) => {
      const next = new Set(current)
      if (create) next.delete(rowIndex)
      else next.add(rowIndex)
      return next
    })
  }

  function onBootstrapAll(create: boolean) {
    setUnticked(create ? new Set() : new Set(bootstrap.filter((b) => !b.problem).map((b) => b.row.index)))
  }

  function downloadTemplate() {
    downloadCsvFile("analytics-import-template.csv", buildTemplateCsv(candidates))
    toast.success(t("template_toast"), { description: t("template_toast_hint") })
  }

  function runImport() {
    if (!source || importing.current) return
    importing.current = true
    try {
      const notes = t("snapshot_notes", { file: source.name })
      const latest = latestMetricsByItem(useDataStore.getState().db)
      let imported = 0
      for (const { row, match } of plan) {
        if (match.status !== "matched" || !match.itemId) continue
        logMetrics(match.itemId, buildImportSnapshot(row, latest.get(match.itemId), recordedOn, notes))
        imported++
      }

      let created = 0
      if (selected.size) {
        // Re-plan against the live workspace so a row never creates a post that exists by now.
        const live = importCandidates(useDataStore.getState().db)
        for (const entry of planBootstrap(planImport(rows, live, { platform }, overrides), live, { platform })) {
          if (entry.problem || !selected.has(entry.row.index)) continue
          const post = logPublishedPost({
            item: bootstrapItemValues(entry, { fallbackTitle: bootstrapTitle(t, entry, recordedOn), fallbackDate: recordedOn, notes }),
          })
          logMetrics(post.id, buildImportSnapshot(entry.row, undefined, recordedOn, notes))
          created++
        }
      }

      const skipped = Math.max(0, plan.length - imported - created)
      setResult({ imported, created, skipped, file: source.name })
      setStep("done")
      toast.success(t.plural("done_imported", imported), {
        description: created ? t.plural("done_created", created) : skipped ? t.plural("done_skipped", skipped) : source.name,
      })
    } finally {
      importing.current = false
    }
  }

  return (
    <div id="csv-import" className="scroll-mt-4">
      <SectionCard
        title={t("title")}
        description={t("description")}
        icon={FileSpreadsheet}
        action={step !== "done" ? <StepIndicator current={step} /> : undefined}
      >
        {step === "source" ? (
          <div className="flex flex-col gap-3">
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void readFile(event.dataTransfer.files?.[0])
              }}
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-7 text-center transition-colors",
                dragging ? "border-brand bg-brand-soft/40" : "bg-muted/20"
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-xs dark:bg-input/30">
                <Upload className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">{t("drop_title")}</p>
                <p className="mx-auto max-w-md text-xs text-pretty text-muted-foreground">{t("drop_hint")}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
                  <Upload aria-hidden />
                  {t("choose_file")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setPasting((open) => !open)} aria-expanded={pasting}>
                  <ClipboardPaste aria-hidden />
                  {t("paste_csv")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={downloadTemplate} disabled={!publishedCount}>
                  <Download aria-hidden />
                  {t("download_template")}
                </Button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain,.xlsx,.xls"
                className="sr-only"
                tabIndex={-1}
                aria-label={t("choose_file_label")}
                onChange={(event) => {
                  void readFile(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
            </div>
            {pasting ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  rows={6}
                  value={pasteText}
                  autoFocus
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder={"Title,Views,Likes\nHow we cut CAC by 40%,12400,320"}
                  aria-label={t("paste_label")}
                  className="font-mono text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPasting(false)}>
                    {t("paste_cancel")}
                  </Button>
                  <Button type="button" size="sm" disabled={!pasteText.trim()} onClick={() => load(t("pasted_name"), pasteText)}>
                    {t("paste_read")}
                  </Button>
                </div>
              </div>
            ) : null}
            {error?.kind === "spreadsheet" ? (
              <Alert role="alert">
                <FileWarning aria-hidden />
                <AlertTitle>{t("spreadsheet_title")}</AlertTitle>
                <AlertDescription>
                  <p>{t("spreadsheet_intro")}</p>
                  <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-left">
                    <li>{t("spreadsheet_excel")}</li>
                    <li>{t("spreadsheet_sheets")}</li>
                    <li>{t("spreadsheet_numbers")}</li>
                    <li>{t("spreadsheet_tiktok")}</li>
                  </ul>
                </AlertDescription>
              </Alert>
            ) : error ? (
              <Alert variant="destructive" role="alert">
                <CircleAlert aria-hidden />
                <AlertTitle>{t("error_title")}</AlertTitle>
                <AlertDescription>{t(error.key, error.vars)}</AlertDescription>
              </Alert>
            ) : null}
            <CsvExportGuide />
            <p className="text-xs text-pretty text-muted-foreground">
              {t.plural("source_footer", publishedCount, { count: formatNumber(publishedCount) })}
            </p>
          </div>
        ) : null}

        {step === "map" && source ? (
          <CsvMapping
            fileName={source.name}
            table={source.table}
            mapping={mapping}
            onMap={onMap}
            detection={detection}
            presetId={presetId}
            onPresetChange={changePreset}
            platform={platform}
            onPlatformChange={setPlatform}
            dateOrder={dateOrder}
            onDateOrderChange={setDateOrder}
            recordedOn={recordedOn}
            onRecordedOnChange={setRecordedOn}
            today={today}
            reference={reference}
            onBack={reset}
            onNext={() => setStep("review")}
          />
        ) : null}

        {step === "review" && source ? (
          <CsvReview
            plan={plan}
            summary={summary}
            candidates={candidates}
            overrides={overrides}
            onOverride={onOverride}
            bootstrap={bootstrap}
            bootstrapOn={bootstrapOn}
            onBootstrapChange={setBootstrapOn}
            selected={selected}
            onBootstrapRow={onBootstrapRow}
            onBootstrapAll={onBootstrapAll}
            recordedOn={recordedOn}
            onBack={() => setStep("map")}
            onImport={runImport}
          />
        ) : null}

        {step === "done" && result ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-good/10 text-good-fg">
              <CircleCheck className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">{t.plural("done_imported", result.imported)}</p>
              {result.created ? <p className="text-sm font-medium">{t.plural("done_created", result.created)}</p> : null}
              <p className="text-xs text-muted-foreground">
                {[result.file, result.skipped ? t.plural("done_skipped", result.skipped) : "", t("done_hint")].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/analytics/posts">{t("open_posts")}</Link>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                {t("import_another")}
              </Button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

function StepIndicator({ current }: { current: Exclude<Step, "done"> }) {
  const t = useT(m)
  const index = STEPS.findIndex((s) => s.key === current)
  return (
    <ol className="hidden items-center gap-1 text-xs sm:flex" aria-label={t("steps_label")}>
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1" aria-current={i === index ? "step" : undefined}>
          <span
            className={cn(
              "flex size-4 items-center justify-center rounded-full border text-[10px] num",
              i < index && "border-brand bg-brand text-white",
              i === index && "border-brand text-foreground",
              i > index && "text-muted-foreground"
            )}
          >
            {i + 1}
          </span>
          <span className={cn(i === index ? "font-medium text-foreground" : "text-muted-foreground")}>{t(s.label)}</span>
          {i < STEPS.length - 1 ? <span className="mx-1 h-px w-3 bg-border" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  )
}
