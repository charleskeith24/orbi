"use client"

import { formatDistanceStrict } from "date-fns"
import { CircleAlert, Cloud, Download, FileBraces, HardDrive, RotateCcw, Sparkles, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, CopyButton, Meter, SectionCard } from "@/components/common"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { normalizeDatabase } from "@/lib/data/defaults"
import { createDemoDatabase, createStarterDatabase } from "@/lib/data/seed"
import { formatDateTime, parseDate } from "@/lib/dates"
import { useDataStatus, useDataStore, useDb } from "@/lib/store"
import type { TableName } from "@/lib/types"
import { cn, formatNumber, pluralize } from "@/lib/utils"
import { downloadJsonFile } from "./download"
import { LOCAL_STORAGE_QUOTA, useStorageUsage } from "./storage-usage"
import {
  buildWorkspaceExport,
  exportFilename,
  formatBytes,
  parseWorkspaceFile,
  totalRows,
  workspaceCounts,
  type WorkspaceParseResult,
} from "./workspace-io"

type Action = "import" | "demo" | "fresh"
type ParsedImport = Extract<WorkspaceParseResult, { ok: true }> & { name: string }

const HEADLINE_TABLES: { table: TableName; label: string }[] = [
  { table: "content_items", label: "Content items" },
  { table: "content_ideas", label: "Ideas" },
  { table: "content_metrics", label: "Analytics snapshots" },
  { table: "stories", label: "Stories" },
  { table: "audience_personas", label: "Personas" },
  { table: "ai_generations", label: "AI generations" },
]

const SUPABASE_SNIPPET = `NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`

function summarizeCounts(counts: Record<TableName, number>): string {
  return HEADLINE_TABLES.filter((h) => counts[h.table])
    .slice(0, 4)
    .map((h) => `${formatNumber(counts[h.table])} ${h.label.toLowerCase()}`)
    .join(" · ")
}

export function DataTab({ now }: { now: Date }) {
  const router = useRouter()
  const { mode } = useDataStatus()
  const db = useDb()
  const counts = useMemo(() => workspaceCounts(db), [db])
  const rows = totalRows(counts)
  const usage = useStorageUsage(mode === "local", db)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ParsedImport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const savedAt = parseDate(usage?.savedAt)

  function exportWorkspace() {
    const state = useDataStore.getState()
    const at = new Date()
    downloadJsonFile(exportFilename(at), buildWorkspaceExport(state.db, state.mode, at))
    toast.success("Workspace exported", { description: `${pluralize(totalRows(workspaceCounts(state.db)), "row")} saved to a JSON file` })
  }

  async function readImport(file: File | undefined) {
    if (!file) return
    setImportError(null)
    setPending(null)
    try {
      const result = parseWorkspaceFile(await file.text(), { requireUuids: mode === "supabase" })
      if (!result.ok) setImportError(result.error)
      else setPending({ ...result, name: file.name })
    } catch {
      setImportError("Couldn't read that file.")
    }
  }

  async function run() {
    const store = useDataStore.getState()
    if (action === "import" && pending) {
      await store.replaceWorkspace(normalizeDatabase(pending.db))
      toast.success("Workspace imported", { description: `${pluralize(pending.totalRows, "row")} from ${pending.name}` })
      setPending(null)
    } else if (action === "demo") {
      await store.replaceWorkspace(createDemoDatabase(store.userId, new Date()))
      toast.success("Demo workspace loaded", {
        description: "Northbound Commerce — a complete example brand.",
        action: { label: "Open dashboard", onClick: () => router.push("/") },
      })
    } else if (action === "fresh") {
      await store.replaceWorkspace(createStarterDatabase(store.userId, new Date()))
      toast.success("Fresh workspace ready", { description: "Let's set up your brand." })
      router.push("/onboarding")
    }
  }

  const backupLink = (
    <Button type="button" variant="link" size="xs" className="h-auto px-0 align-baseline" onClick={exportWorkspace}>
      Download a backup first
    </Button>
  )
  const confirm: Record<Action, { title: string; description: React.ReactNode; confirmLabel: string }> = {
    import: {
      title: "Replace your workspace?",
      description: (
        <>
          Your current {pluralize(rows, "row")} {mode === "supabase" ? "in Supabase " : ""}are replaced by{" "}
          {pluralize(pending?.totalRows ?? 0, "row")} from {pending?.name ?? "the file"}. This can&apos;t be undone. {backupLink}.
        </>
      ),
      confirmLabel: "Replace workspace",
    },
    demo: {
      title: "Load the demo workspace?",
      description: (
        <>
          Everything here — {pluralize(rows, "row")} — is replaced by the Northbound Commerce demo brand. This can&apos;t be undone.{" "}
          {backupLink}.
        </>
      ),
      confirmLabel: "Load demo",
    },
    fresh: {
      title: "Start fresh?",
      description: (
        <>
          All {pluralize(rows, "row")} are deleted and replaced with an empty workspace plus the starter library. Onboarding starts
          next. This can&apos;t be undone. {backupLink}.
        </>
      ),
      confirmLabel: "Delete and start fresh",
    },
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionCard title="Where your data lives">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground dark:bg-input/30">
              {mode === "local" ? <HardDrive className="size-4" aria-hidden /> : <Cloud className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{mode === "local" ? "Local workspace — this browser" : "Synced workspace — Supabase"}</p>
              <p className="text-xs text-pretty text-muted-foreground">
                {mode === "local"
                  ? "Everything is saved in this browser's local storage: no account, no server. Clearing site data or switching browsers loses it — export backups, or connect Supabase for accounts and sync across devices."
                  : "Stored in your Supabase Postgres database with row-level security, available on any device you sign in on."}
              </p>
            </div>
          </div>

          {mode === "local" && usage ? (
            <Meter
              label={`Browser storage · ${formatBytes(usage.workspace)} of about ${formatBytes(LOCAL_STORAGE_QUOTA)}`}
              value={usage.total}
              max={LOCAL_STORAGE_QUOTA}
              showValue
              tone={usage.total > LOCAL_STORAGE_QUOTA * 0.8 ? "warning" : "brand"}
              valueText={`${Math.max(1, Math.round((usage.total / LOCAL_STORAGE_QUOTA) * 100))}% used`}
              aria-label="Browser storage used"
            />
          ) : null}
          {mode === "local" && usage ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              {savedAt ? `Last saved ${formatDistanceStrict(savedAt, savedAt > now ? savedAt : now, { addSuffix: true })} · ` : ""}
              key <code className="font-mono">pbos:workspace:v1</code>
              {usage.recoveryCopies ? ` · ${pluralize(usage.recoveryCopies, "recovery copy", "recovery copies")} kept from a failed load` : ""}
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
            {HEADLINE_TABLES.map((h) => (
              <div key={h.table} className="bg-card px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{h.label}</dt>
                <dd className="text-base font-semibold num">{formatNumber(counts[h.table])}</dd>
              </div>
            ))}
          </dl>
          <p className="-mt-2 text-xs text-muted-foreground num">
            {pluralize(rows, "row")} across {Object.values(counts).filter(Boolean).length} of {Object.keys(counts).length} tables.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Backup & restore" description="A JSON file with every table — strategy, ideas, content, scripts, analytics, reviews and settings.">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={exportWorkspace}>
              <Download aria-hidden />
              Export workspace
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden />
              Import workspace…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose a workspace file"
              onChange={(event) => {
                void readImport(event.target.files?.[0])
                event.target.value = ""
              }}
            />
          </div>
          {importError ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertTitle>That file can&apos;t be imported</AlertTitle>
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
                  {pending.exportedAt ? `Exported ${formatDateTime(pending.exportedAt)}` : "Export date unknown"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground num">
                {pluralize(pending.totalRows, "row")}
                {summarizeCounts(pending.counts) ? ` · ${summarizeCounts(pending.counts)}` : ""}
              </p>
              {pending.warnings.map((warning) => (
                <p key={warning} className="text-xs text-warning-fg">
                  {warning}
                </p>
              ))}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => setAction("import")}>
                  Replace workspace…
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Importing replaces the whole workspace after a validity check and a confirmation. Ids and relationships are kept.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Start over" description="Both replace everything in this workspace — export a backup first." className="border-destructive/25">
        <div className="flex flex-col divide-y">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <div className="min-w-0 max-w-xl">
              <p className="text-sm font-medium">Load the demo workspace</p>
              <p className="text-xs text-pretty text-muted-foreground">
                Northbound Commerce, a complete example brand: content across every pipeline stage, analytics, campaigns, stories and
                reviews.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setAction("demo")}>
              <Sparkles aria-hidden />
              Load demo…
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <div className="min-w-0 max-w-xl">
              <p className="text-sm font-medium">Start fresh</p>
              <p className="text-xs text-pretty text-muted-foreground">
                An empty workspace with the starter library (formats, angles, hook templates, goals, posting schedule). Onboarding
                runs next.
              </p>
            </div>
            <Button type="button" variant="destructive" size="sm" onClick={() => setAction("fresh")}>
              <RotateCcw aria-hidden />
              Start fresh…
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Accounts & sync"
        description={
          mode === "supabase"
            ? "Supabase is connected. The setup guide covers auth settings, schema changes and troubleshooting."
            : "Supabase adds accounts, sync across devices and a real Postgres database with row-level security."
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          {mode === "local" ? (
            <ol className="flex flex-col gap-2">
              {[
                "Create a Supabase project and apply the migration in supabase/migrations.",
                "Add these two variables to .env.local in the project root:",
                "Restart the dev server and create an account.",
                "Import the backup you exported here to move this workspace into your account.",
              ].map((step, index) => (
                <li key={step} className="flex flex-col gap-2">
                  <span className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-medium num">
                      {index + 1}
                    </span>
                    <span className="text-pretty">{step}</span>
                  </span>
                  {index === 1 ? (
                    <div className="relative ml-7 min-w-0">
                      <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 pr-12 font-mono text-xs leading-relaxed scrollbar-thin">
                        {SUPABASE_SNIPPET}
                      </pre>
                      <CopyButton text={SUPABASE_SNIPPET} successMessage="Variables copied" className="absolute top-1.5 right-1.5" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          <p className={cn("text-xs text-muted-foreground", mode === "local" && "border-t pt-3")}>
            Full guide: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">docs/SUPABASE.md</code>{" "}
            in the project.
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
        onConfirm={run}
      />
    </div>
  )
}
