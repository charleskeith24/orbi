"use client"

import { CircleAlert, CircleCheck, ClipboardPaste, Download, FileSpreadsheet, Upload } from "lucide-react"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { SectionCard } from "@/components/common"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { latestMetricsByItem } from "@/lib/analytics"
import { toISODate } from "@/lib/dates"
import {
  autoMapColumns,
  buildImportSnapshot,
  buildTemplateCsv,
  importCandidates,
  planImport,
  readCsvTable,
  readImportRows,
  summarizeImport,
  type ColumnMapping,
  type CsvTable,
  type ImportField,
} from "@/lib/integrations"
import { logMetrics, useDataStore, useTable } from "@/lib/store"
import type { ID, ISODate, PlatformId } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { CsvMapping } from "./csv-mapping"
import { CsvReview } from "./csv-review"
import { downloadCsvFile } from "./download"

type Step = "source" | "map" | "review" | "done"

const MAX_FILE_BYTES = 5 * 1024 * 1024
const STEPS: { key: Exclude<Step, "done">; label: string }[] = [
  { key: "source", label: "File" },
  { key: "map", label: "Columns" },
  { key: "review", label: "Review" },
]

/** Manual analytics import: CSV → column mapping → match review → `logMetrics` per matched post. */
export function CsvImport({ now }: { now: Date }) {
  const items = useTable("content_items")
  const candidates = useMemo(() => importCandidates({ content_items: items }), [items])
  const publishedCount = useMemo(() => candidates.filter((c) => c.published).length, [candidates])
  const today = toISODate(now)

  const [step, setStep] = useState<Step>("source")
  const [source, setSource] = useState<{ name: string; table: CsvTable } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [platform, setPlatform] = useState<PlatformId | null>(null)
  const [recordedOn, setRecordedOn] = useState<ISODate>(today)
  const [overrides, setOverrides] = useState<Map<number, ID | null>>(() => new Map())
  const [result, setResult] = useState<{ imported: number; skipped: number; file: string } | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const rows = useMemo(() => (source ? readImportRows(source.table, mapping) : []), [source, mapping])
  const plan = useMemo(() => planImport(rows, candidates, { platform }, overrides), [rows, candidates, platform, overrides])
  const summary = useMemo(() => summarizeImport(plan), [plan])

  function load(name: string, text: string) {
    const read = readCsvTable(text)
    if (!read.ok) {
      setError(read.error)
      return
    }
    setError(null)
    setSource({ name, table: read.table })
    setMapping(autoMapColumns(read.table.headers))
    setOverrides(new Map())
    setPasting(false)
    setPasteText("")
    setStep("map")
  }

  async function readFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over 5 MB — export fewer rows or columns.")
      return
    }
    if (!/\.(csv|tsv|txt)$/i.test(file.name) && !/csv|text\//.test(file.type)) {
      setError("Choose a .csv file (a .tsv or .txt export works too).")
      return
    }
    try {
      load(file.name, await file.text())
    } catch {
      setError("Couldn't read that file.")
    }
  }

  function reset() {
    setStep("source")
    setSource(null)
    setMapping({})
    setOverrides(new Map())
    setResult(null)
    setError(null)
  }

  function onMap(field: ImportField, index: number | undefined) {
    setMapping((current) => {
      const next = { ...current }
      if (index === undefined) delete next[field]
      else next[field] = index
      return next
    })
    setOverrides(new Map())
  }

  function onOverride(rowIndex: number, itemId: ID | null | undefined) {
    setOverrides((current) => {
      const next = new Map(current)
      if (itemId === undefined) next.delete(rowIndex)
      else next.set(rowIndex, itemId)
      return next
    })
  }

  function downloadTemplate() {
    downloadCsvFile("analytics-import-template.csv", buildTemplateCsv(candidates))
    toast.success("Template downloaded", { description: "Your latest published posts — add the numbers and import it here." })
  }

  function runImport() {
    if (!source) return
    const latest = latestMetricsByItem(useDataStore.getState().db)
    const notes = `CSV import · ${source.name}`
    let imported = 0
    for (const { row, match } of plan) {
      if (match.status !== "matched" || !match.itemId) continue
      logMetrics(match.itemId, buildImportSnapshot(row, latest.get(match.itemId), recordedOn, notes))
      imported++
    }
    const skipped = plan.length - imported
    setResult({ imported, skipped, file: source.name })
    setStep("done")
    toast.success(`Imported ${pluralize(imported, "analytics snapshot")}`, {
      description: skipped ? `${pluralize(skipped, "row")} skipped` : source.name,
    })
  }

  return (
    <div id="csv-import" className="scroll-mt-4">
      <SectionCard
        title="Import analytics from CSV"
        description="Works with every platform today: export your numbers, map the columns, check the matches, import."
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
                <p className="text-sm font-medium">Drop a CSV export here</p>
                <p className="mx-auto max-w-md text-xs text-pretty text-muted-foreground">
                  From Meta Business Suite, TikTok, YouTube Studio, LinkedIn or Metricool — or this app&apos;s Post Performance
                  export.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
                  <Upload aria-hidden />
                  Choose file
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setPasting((open) => !open)} aria-expanded={pasting}>
                  <ClipboardPaste aria-hidden />
                  Paste CSV
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={downloadTemplate} disabled={!publishedCount}>
                  <Download aria-hidden />
                  Download template
                </Button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="sr-only"
                tabIndex={-1}
                aria-label="Choose a CSV file"
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
                  aria-label="CSV text including the header row"
                  className="font-mono text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPasting(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" disabled={!pasteText.trim()} onClick={() => load("Pasted CSV", pasteText)}>
                    Read CSV
                  </Button>
                </div>
              </div>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertTitle>Couldn&apos;t use that file</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <p className="text-xs text-pretty text-muted-foreground">
              Rows are matched to your {pluralize(publishedCount, "published post")} by content ID, URL or title. The template is
              pre-filled with your latest posts. Nothing is written until you confirm.
            </p>
          </div>
        ) : null}

        {step === "map" && source ? (
          <CsvMapping
            fileName={source.name}
            table={source.table}
            mapping={mapping}
            onMap={onMap}
            platform={platform}
            onPlatformChange={setPlatform}
            recordedOn={recordedOn}
            onRecordedOnChange={setRecordedOn}
            today={today}
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
              <p className="text-sm font-medium">Imported {pluralize(result.imported, "analytics snapshot")}</p>
              <p className="text-xs text-muted-foreground">
                {result.file}
                {result.skipped ? ` · ${pluralize(result.skipped, "row")} skipped` : ""} · tiers, winners and reports now use these
                numbers.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/analytics/posts">Open Post Performance</Link>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                Import another file
              </Button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

function StepIndicator({ current }: { current: Exclude<Step, "done"> }) {
  const index = STEPS.findIndex((s) => s.key === current)
  return (
    <ol className="hidden items-center gap-1 text-xs sm:flex" aria-label="Import steps">
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
          <span className={cn(i === index ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</span>
          {i < STEPS.length - 1 ? <span className="mx-1 h-px w-3 bg-border" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  )
}
