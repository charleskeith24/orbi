"use client"

import { formatDistanceStrict } from "date-fns"
import { CircleAlert, Cloud, Download, FileBraces, HardDrive, History, RotateCcw, TriangleAlert, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, CopyButton, Meter, SectionCard } from "@/components/common"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { normalizeDatabase } from "@/lib/data/defaults"
import { createStarterDatabase } from "@/lib/data/starter"
import { isSupabaseAdapter, type ReplaceProgress } from "@/lib/data/supabase-adapter"
import { formatDateTime, parseDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useDataStatus, useDataStore, useDb } from "@/lib/store"
import { prepareForAccount } from "@/lib/supabase/move-local"
import type { TableName } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { BACKUP_REMINDER_DAYS, daysSince, exportWorkspaceBackup, useLastBackup } from "./data-backup"
import { dataTabMessages } from "./data-messages"
import { MoveLocalCard } from "./data-move-local"
import { LOCAL_STORAGE_QUOTA, useStorageUsage } from "./storage-usage"
import { formatBytes, parseWorkspaceFile, totalRows, workspaceCounts, type WorkspaceParseResult } from "./workspace-io"

type Action = "import" | "fresh"
type ParsedImport = Extract<WorkspaceParseResult, { ok: true }> & { name: string }
type Key = keyof typeof dataTabMessages.en

const HEADLINE_TABLES: { table: TableName; label: Key }[] = [
  { table: "content_items", label: "count_items" },
  { table: "content_ideas", label: "count_ideas" },
  { table: "content_metrics", label: "count_metrics" },
  { table: "stories", label: "count_stories" },
  { table: "audience_personas", label: "count_personas" },
  { table: "ai_generations", label: "count_ai" },
]

const SUPABASE_SNIPPET = `NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`

const SYNC_STEPS: Key[] = ["sync_step_1", "sync_step_2", "sync_step_3", "sync_step_4"]

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

function ImportProgress({ progress, label }: { progress: ReplaceProgress | null; label: (progress: ReplaceProgress | null) => string }) {
  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
      <Progress value={percent} aria-label={label(progress)} />
      <p className="text-xs text-muted-foreground num">{label(progress)}</p>
    </div>
  )
}

export function DataTab({ now }: { now: Date }) {
  const t = useT(dataTabMessages)
  const c = useT(commonMessages)
  const router = useRouter()
  const { mode } = useDataStatus()
  const cloud = mode === "supabase"
  const db = useDb()
  const counts = useMemo(() => workspaceCounts(db), [db])
  const rows = totalRows(counts)
  const usage = useStorageUsage(mode === "local", db)
  const lastBackup = useLastBackup()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ParsedImport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<ReplaceProgress | null>(null)
  const savedAt = parseDate(usage?.savedAt)

  const rowsLabel = (n: number) => t.plural("rows", n, { count: formatNumber(n) })
  const agoLabel = (days: number) =>
    days === 0 ? t("ago_today") : days === 1 ? t("ago_yesterday") : t.plural("ago_days", days, { count: formatNumber(days) })
  const backupDays = lastBackup ? daysSince(lastBackup, now) : null
  const needsBackup = mode === "local" && (backupDays === null || backupDays >= BACKUP_REMINDER_DAYS)
  const progressLabel = (p: ReplaceProgress | null) =>
    !p || p.phase === "clearing"
      ? t("importing_prepare")
      : p.phase === "restoring"
        ? t("importing_restore")
        : t("importing", { done: formatNumber(p.done), total: formatNumber(p.total) })
  const summarizeCounts = (fileCounts: Record<TableName, number>) =>
    HEADLINE_TABLES.filter((h) => fileCounts[h.table])
      .slice(0, 4)
      .map((h) => `${formatNumber(fileCounts[h.table])} ${t(h.label).toLowerCase()}`)
      .join(" · ")

  function exportWorkspace() {
    const state = useDataStore.getState()
    const count = exportWorkspaceBackup(state.db, state.mode, new Date())
    toast.success(t("exported"), { description: t("exported_rows", { rows: rowsLabel(count) }) })
  }

  async function readImport(file: File | undefined) {
    if (!file) return
    setImportError(null)
    setPending(null)
    try {
      const result = parseWorkspaceFile(await file.text())
      if (!result.ok) setImportError(result.error)
      else setPending({ ...result, name: file.name })
    } catch {
      setImportError(t("import_read_error"))
    }
  }

  async function runImport(file: ParsedImport) {
    const store = useDataStore.getState()
    const adapter = store.adapter
    const incoming = normalizeDatabase(file.db)
    // Row ids are primary keys shared by every account: the file's rows get ids of their own.
    const next = cloud ? prepareForAccount(incoming, store.userId) : incoming
    const stop = isSupabaseAdapter(adapter) ? adapter.trackReplace(setProgress) : () => undefined
    setImporting(true)
    try {
      await store.replaceWorkspace(next)
      toast.success(t("imported"), { description: t("imported_rows", { rows: rowsLabel(file.totalRows), name: file.name }) })
      setPending(null)
    } catch (error) {
      toast.error(t("import_failed"), { description: messageOf(error), duration: 15_000 })
    } finally {
      stop()
      setImporting(false)
      setProgress(null)
    }
  }

  async function run() {
    const store = useDataStore.getState()
    if (action === "import" && pending) {
      // The dialog closes right away; progress and the result show on this card.
      void runImport(pending)
    } else if (action === "fresh") {
      await store.replaceWorkspace(createStarterDatabase(store.userId, new Date()))
      toast.success(t("fresh_done"), { description: t("fresh_done_description") })
      router.push("/onboarding")
    }
  }

  const backupLink = (
    <Button type="button" variant="link" size="xs" className="h-auto px-0 align-baseline" onClick={exportWorkspace}>
      {t("backup_first")}
    </Button>
  )
  const confirm: Record<Action, { title: string; description: React.ReactNode; confirmLabel: string }> = {
    import: {
      title: t("confirm_import_title"),
      description: (
        <>
          {t(cloud ? "confirm_import_cloud" : "confirm_import_local", {
            rows: rowsLabel(rows),
            fileRows: rowsLabel(pending?.totalRows ?? 0),
            name: pending?.name ?? "",
          })}{" "}
          {backupLink}
        </>
      ),
      confirmLabel: t("confirm_import_action"),
    },
    fresh: {
      title: t("confirm_fresh_title"),
      description: (
        <>
          {t("confirm_fresh_body", { rows: rowsLabel(rows) })} {backupLink}
        </>
      ),
      confirmLabel: t("confirm_fresh_action"),
    },
  }

  const recoveryCopies = usage?.recoveryCopies ?? 0

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionCard title={t("where_title")}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground dark:bg-input/30">
              {cloud ? <Cloud className="size-4" aria-hidden /> : <HardDrive className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{cloud ? t("cloud_title") : t("local_title")}</p>
              <p className="text-xs text-pretty text-muted-foreground">{cloud ? t("cloud_description") : t("local_description")}</p>
            </div>
          </div>

          {mode === "local" && usage ? (
            <Meter
              label={t("storage_label", { used: formatBytes(usage.workspace), quota: formatBytes(LOCAL_STORAGE_QUOTA) })}
              value={usage.total}
              max={LOCAL_STORAGE_QUOTA}
              showValue
              tone={usage.total > LOCAL_STORAGE_QUOTA * 0.8 ? "warning" : "brand"}
              valueText={t("storage_used", { percent: Math.max(1, Math.round((usage.total / LOCAL_STORAGE_QUOTA) * 100)) })}
              aria-label={t("storage_aria")}
            />
          ) : null}
          {mode === "local" && usage ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              {savedAt ? `${t("last_saved", { ago: formatDistanceStrict(savedAt, savedAt > now ? savedAt : now, { addSuffix: true }) })} · ` : ""}
              {t("storage_key")} <code className="font-mono">pbos:workspace:v2</code>
              {recoveryCopies ? ` · ${t.plural("recovery_copies", recoveryCopies, { count: formatNumber(recoveryCopies) })}` : ""}
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
            {HEADLINE_TABLES.map((h) => (
              <div key={h.table} className="bg-card px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{t(h.label)}</dt>
                <dd className="text-base font-semibold num">{formatNumber(counts[h.table])}</dd>
              </div>
            ))}
          </dl>
          <p className="-mt-2 text-xs text-muted-foreground num">
            {t("rows_across", {
              rows: rowsLabel(rows),
              used: Object.values(counts).filter(Boolean).length,
              total: Object.keys(counts).length,
            })}
          </p>
        </div>
      </SectionCard>

      {cloud ? <MoveLocalCard /> : null}

      <SectionCard title={t("backup_title")} description={t("backup_description")}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={exportWorkspace}>
              <Download aria-hidden />
              {t("export")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden />
              {t("import")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-label={t("choose_file")}
              onChange={(event) => {
                void readImport(event.target.files?.[0])
                event.target.value = ""
              }}
            />
          </div>
          <p className={cn("flex items-start gap-1.5 text-xs", needsBackup ? "text-foreground" : "text-muted-foreground")}>
            {needsBackup ? (
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-fg" aria-hidden />
            ) : (
              <History className="mt-px size-3.5 shrink-0" aria-hidden />
            )}
            <span>
              {lastBackup ? t("last_backup", { date: formatDateTime(lastBackup), ago: agoLabel(backupDays ?? 0) }) : t("last_backup_never")}
              {needsBackup && lastBackup ? ` ${t("backup_overdue")}` : ""}
            </span>
          </p>
          {importError ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertTitle>{t("import_error_title")}</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          ) : null}
          {pending ? (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <FileBraces className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{pending.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {pending.exportedAt ? t("exported_at", { date: formatDateTime(pending.exportedAt) }) : t("exported_unknown")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground num">
                {rowsLabel(pending.totalRows)}
                {summarizeCounts(pending.counts) ? ` · ${summarizeCounts(pending.counts)}` : ""}
              </p>
              {pending.warnings.map((warning) => (
                <p key={warning} className="text-xs text-warning-fg">
                  {warning}
                </p>
              ))}
              {importing && cloud ? <ImportProgress progress={progress} label={progressLabel} /> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={importing} onClick={() => setPending(null)}>
                  {c("cancel")}
                </Button>
                <Button type="button" variant="destructive" size="sm" disabled={importing} onClick={() => setAction("import")}>
                  {t("replace")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{cloud ? t("import_help_cloud") : t("import_help_local")}</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t("start_over_title")} description={t("start_over_description")} className="border-destructive/25">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-xl min-w-0">
            <p className="text-sm font-medium">{t("start_fresh")}</p>
            <p className="text-xs text-pretty text-muted-foreground">{t("start_fresh_help")}</p>
          </div>
          <Button type="button" variant="destructive" size="sm" disabled={importing} onClick={() => setAction("fresh")}>
            <RotateCcw aria-hidden />
            {t("start_fresh_button")}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t("sync_title")} description={cloud ? t("sync_description_cloud") : t("sync_description_local")}>
        <div className="flex flex-col gap-3 text-sm">
          {mode === "local" ? (
            <ol className="flex flex-col gap-2">
              {SYNC_STEPS.map((step, index) => (
                <li key={step} className="flex flex-col gap-2">
                  <span className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-medium num">
                      {index + 1}
                    </span>
                    <span className="text-pretty">{t(step)}</span>
                  </span>
                  {index === 1 ? (
                    <div className="relative ml-7 min-w-0">
                      <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 pr-12 font-mono text-xs leading-relaxed scrollbar-thin">
                        {SUPABASE_SNIPPET}
                      </pre>
                      <CopyButton text={SUPABASE_SNIPPET} successMessage={t("variables_copied")} className="absolute top-1.5 right-1.5" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          <p className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", mode === "local" && "border-t pt-3")}>
            {t("guides_label")}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">docs/DEPLOY.md</code>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">docs/SUPABASE.md</code>
          </p>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open) setAction(null)
        }}
        title={action ? confirm[action].title : ""}
        description={action ? confirm[action].description : undefined}
        confirmLabel={action ? confirm[action].confirmLabel : undefined}
        cancelLabel={c("cancel")}
        onConfirm={run}
      />
    </div>
  )
}
