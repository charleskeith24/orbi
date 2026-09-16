"use client"

/**
 * Local → cloud (online version): this browser's local workspace can move into the signed-in account.
 * - `MoveLocalCard` — Settings → Data, whenever this browser still holds a local workspace.
 * - `MoveLocalPrompt` — one-time offer after sign-in, while the account is still empty.
 * The move goes through the store and the Supabase adapter (TABLE_NAMES order, with progress); a
 * failure puts the account back as it was, and the local copy is never touched.
 */
import { Check, CircleAlert, CloudUpload, Download, Trash2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { ConfirmDialog, SectionCard } from "@/components/common"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { LOCAL_STORAGE_KEY } from "@/lib/data/local-adapter"
import { isSupabaseAdapter, type ReplaceProgress } from "@/lib/data/supabase-adapter"
import { formatDateTime } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useDataStatus, useDataStore, useDb } from "@/lib/store"
import {
  alreadyMoved,
  hasWorkToMove,
  isEmptyWorkspace,
  markPrompted,
  MOVED_MARKER_KEY,
  parseLocalSnapshot,
  parseMovedMarker,
  prepareForAccount,
  PROMPTED_KEY_PREFIX,
  removeLocalCopy,
  summarizeWorkspace,
  wasPrompted,
  writeMovedMarker,
  type LocalSnapshot,
  type MovedMarker,
} from "@/lib/supabase/move-local"
import { formatNumber } from "@/lib/utils"
import { moveLocalMessages } from "./data-messages"
import { downloadJsonFile } from "./download"
import { buildWorkspaceExport, exportFilename } from "./workspace-io"

/* --------------------------- This browser's local copy --------------------------- */

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    const key = event.key
    if (key === null || key === LOCAL_STORAGE_KEY || key === MOVED_MARKER_KEY || key.startsWith(PROMPTED_KEY_PREFIX)) listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

// useSyncExternalStore needs the same object for the same stored text, so parses are cached by it.
let snapshotCache: { raw: string | null; value: LocalSnapshot | null } = { raw: null, value: null }
function getLocalSnapshot(): LocalSnapshot | null {
  const raw = readRaw(LOCAL_STORAGE_KEY)
  if (raw !== snapshotCache.raw) snapshotCache = { raw, value: parseLocalSnapshot(raw) }
  return snapshotCache.value
}

let markerCache: { raw: string | null; value: MovedMarker | null } = { raw: null, value: null }
function getMovedMarker(): MovedMarker | null {
  const raw = readRaw(MOVED_MARKER_KEY)
  if (raw !== markerCache.raw) markerCache = { raw, value: parseMovedMarker(raw) }
  return markerCache.value
}

const useLocalSnapshot = () => useSyncExternalStore(subscribe, getLocalSnapshot, () => null)
const useMovedMarker = () => useSyncExternalStore(subscribe, getMovedMarker, () => null)

function useAccountIsEmpty(): boolean {
  const db = useDb()
  return useMemo(() => isEmptyWorkspace(summarizeWorkspace(db)), [db])
}

/* ------------------------------------ The move ------------------------------------ */

type MoveState = { status: "idle" } | { status: "running"; progress: ReplaceProgress | null } | { status: "failed"; message: string }

function useMoveLocal() {
  const t = useT(moveLocalMessages)
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<MoveState>({ status: "idle" })

  async function move(snapshot: LocalSnapshot): Promise<boolean> {
    const store = useDataStore.getState()
    const adapter = store.adapter
    if (!isSupabaseAdapter(adapter) || !store.userId) {
      setState({ status: "failed", message: t("not_signed_in") })
      return false
    }
    setState({ status: "running", progress: null })
    const stop = adapter.trackReplace((progress) => setState({ status: "running", progress }))
    try {
      await store.replaceWorkspace(prepareForAccount(snapshot.db, store.userId))
    } catch (error) {
      setState({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      return false
    } finally {
      stop()
    }
    writeMovedMarker({ userId: store.userId, movedAt: new Date().toISOString(), savedAt: snapshot.savedAt })
    markPrompted(store.userId)
    notify()
    setState({ status: "idle" })
    toast.success(t("done_title"), {
      description: t("done_description", { rows: t.plural("rows", snapshot.rows, { count: formatNumber(snapshot.rows) }) }),
    })
    if (pathname.startsWith("/onboarding") && useDataStore.getState().db.brand_profiles[0]?.onboarding_completed) router.replace("/")
    return true
  }

  return { state, move, reset: () => setState({ status: "idle" }) }
}

function MoveProgress({ progress }: { progress: ReplaceProgress | null }) {
  const t = useT(moveLocalMessages)
  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const label =
    !progress || progress.phase === "clearing"
      ? t("progress_prepare")
      : progress.phase === "restoring"
        ? t("progress_restore")
        : t("progress_saving", { done: formatNumber(progress.done), total: formatNumber(progress.total) })
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
      <Progress value={percent} aria-label={t("progress_aria")} />
      <p className="text-xs text-muted-foreground num">{label}</p>
    </div>
  )
}

function MoveLocalDialog({
  snapshot,
  open,
  onOpenChange,
  fromPrompt = false,
}: {
  snapshot: LocalSnapshot
  open: boolean
  onOpenChange: (open: boolean) => void
  fromPrompt?: boolean
}) {
  const t = useT(moveLocalMessages)
  const { state, move, reset } = useMoveLocal()
  const running = state.status === "running"
  const setOpen = (next: boolean) => {
    if (running) return
    if (!next) reset()
    onOpenChange(next)
  }
  const rows = t.plural("rows", snapshot.rows, { count: formatNumber(snapshot.rows) })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={!running} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialog_title")}</DialogTitle>
          <DialogDescription>
            {t("dialog_body", {
              brand: snapshot.brandName || t("summary_unnamed"),
              rows,
              date: snapshot.savedAt ? formatDateTime(snapshot.savedAt) : "—",
            })}
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5 text-sm">
          {(["dialog_point_all", "dialog_point_replace", "dialog_point_keep"] as const).map((key) => (
            <li key={key} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-pretty">{t(key)}</span>
            </li>
          ))}
        </ul>
        {state.status === "running" ? <MoveProgress progress={state.progress} /> : null}
        {state.status === "failed" ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertTitle>{t("failed_title")}</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {fromPrompt ? <p className="text-xs text-muted-foreground">{t("dialog_later_hint")}</p> : null}
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={running} onClick={() => setOpen(false)}>
            {t("not_now")}
          </Button>
          <Button type="button" disabled={running} onClick={() => void move(snapshot).then((ok) => ok && onOpenChange(false))}>
            {running ? <Spinner /> : <CloudUpload aria-hidden />}
            {running ? t("moving") : t("move_action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------- Surfaces ------------------------------------- */

/** Settings → Data (online version): this browser's local workspace, when it holds one worth keeping. */
export function MoveLocalCard() {
  const t = useT(moveLocalMessages)
  const c = useT(commonMessages)
  const snapshot = useLocalSnapshot()
  const marker = useMovedMarker()
  const userId = useDataStore((s) => s.userId)
  const accountEmpty = useAccountIsEmpty()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  if (!snapshot || !hasWorkToMove(snapshot)) return null

  const rows = t.plural("rows", snapshot.rows, { count: formatNumber(snapshot.rows) })
  const summary = t("summary", {
    brand: snapshot.brandName || t("summary_unnamed"),
    rows,
    date: snapshot.savedAt ? formatDateTime(snapshot.savedAt) : "—",
  })
  const moved = alreadyMoved(marker, snapshot) ? marker : null
  const status = accountEmpty
    ? null
    : moved
      ? t(moved.userId === userId ? "moved" : "moved_elsewhere", { date: formatDateTime(moved.movedAt) })
      : t("not_empty")

  function download() {
    const at = new Date()
    downloadJsonFile(exportFilename(at), buildWorkspaceExport(snapshot!.db, "local", at))
    toast.success(t("downloaded"))
  }

  return (
    <SectionCard title={t("card_title")} description={accountEmpty ? t("card_description_offer") : undefined}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground num">{summary}</p>
        {status ? <p className="text-sm text-pretty">{status}</p> : null}
        <div className="flex flex-wrap gap-2">
          {accountEmpty ? (
            <Button type="button" size="sm" className="h-auto min-h-7 py-1 text-left whitespace-normal" onClick={() => setDialogOpen(true)}>
              <CloudUpload aria-hidden />
              {t("move_button")}
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" onClick={download}>
                <Download aria-hidden />
                {t("download_local")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
                <Trash2 aria-hidden />
                {t("remove_local")}
              </Button>
            </>
          )}
        </div>
        {accountEmpty ? <p className="text-xs text-muted-foreground">{t("keeps_local")}</p> : null}
      </div>
      <MoveLocalDialog snapshot={snapshot} open={dialogOpen} onOpenChange={setDialogOpen} />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t("remove_title")}
        description={t("remove_body", { rows })}
        confirmLabel={t("remove_action")}
        cancelLabel={c("cancel")}
        onConfirm={() => {
          removeLocalCopy()
          notify()
          toast.success(t("removed"))
        }}
      />
    </SectionCard>
  )
}

/**
 * One-time offer after sign-in (mounted by the data gate in the online version): the account is still
 * empty and this browser holds a local workspace that hasn't been moved. Shown until answered.
 */
export function MoveLocalPrompt() {
  const { mode, status } = useDataStatus()
  const snapshot = useLocalSnapshot()
  const marker = useMovedMarker()
  const userId = useDataStore((s) => s.userId)
  const accountEmpty = useAccountIsEmpty()
  const prompted = useSyncExternalStore(subscribe, () => !userId || wasPrompted(userId), () => true)
  const eligible =
    mode === "supabase" && status === "ready" && accountEmpty && snapshot !== null && hasWorkToMove(snapshot) && !alreadyMoved(marker, snapshot)
  if (!eligible || !snapshot) return null

  return (
    <MoveLocalDialog
      snapshot={snapshot}
      open={!prompted}
      fromPrompt
      onOpenChange={(open) => {
        if (open) return
        markPrompted(userId)
        notify()
      }}
    />
  )
}
