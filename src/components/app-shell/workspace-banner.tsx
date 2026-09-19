"use client"

import { Download, HardDrive, TriangleAlert, X } from "lucide-react"
import Link from "next/link"
import { useSyncExternalStore } from "react"
import { toast } from "sonner"
import {
  backupReminder,
  exportWorkspaceBackup,
  snoozeBackupReminder,
  useBackupSnooze,
  useLastBackup,
  useNow,
} from "@/components/features/settings/data-backup"
import { workspaceBannerMessages } from "@/components/features/settings/data-messages"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useDataStatus, useDataStore } from "@/lib/store"
import { formatNumber } from "@/lib/utils"

const KEY = "pbos:banner:local-mode:dismissed"
const HOUR_MS = 3_600_000
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function isDismissed() {
  try {
    return window.localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

function dismiss() {
  try {
    window.localStorage.setItem(KEY, "1")
  } catch {
    // Storage unavailable — the banner simply reappears next visit.
  }
  listeners.forEach((l) => l())
}

/**
 * Honest mode indicator, one compact line under the top bar: local mode keeps data in this browser only.
 * When the workspace hasn't been backed up for a week, the line becomes a gentle reminder with a one-click
 * backup (even if the notice itself was dismissed); "Remind me later" hides it for a few days.
 */
export function WorkspaceBanner() {
  const t = useT(workspaceBannerMessages)
  const { mode, status } = useDataStatus()
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true)
  const lastBackupAt = useLastBackup()
  const snoozedUntil = useBackupSnooze()
  const workspaceSince = useDataStore((s) => s.db.brand_profiles[0]?.created_at ?? null)
  const now = useNow(HOUR_MS)
  if (mode !== "local" || status !== "ready") return null

  const reminder = backupReminder({ lastBackupAt, workspaceSince, snoozedUntil, now })
  if (reminder.due) {
    const days = reminder.days ?? 0
    const backUp = () => {
      const state = useDataStore.getState()
      const count = exportWorkspaceBackup(state.db, state.mode, new Date())
      toast.success(t("exported"), { description: t.plural("exported_rows", count, { count: formatNumber(count) }) })
    }
    return (
      <div data-print="hide" role="status" className="flex h-8 items-center gap-2 border-b bg-muted/40 px-4 text-xs text-muted-foreground">
        <TriangleAlert className="size-3.5 shrink-0 text-warning-fg" aria-hidden />
        <p className="min-w-0 flex-1 truncate">{reminder.never ? t("never") : t.plural("due", days, { count: formatNumber(days) })}</p>
        <Button type="button" size="xs" variant="ghost" className="-mr-1 shrink-0 font-medium text-foreground" onClick={backUp}>
          <Download aria-hidden />
          {t("back_up_now")}
        </Button>
        <button
          type="button"
          onClick={() => snoozeBackupReminder(new Date())}
          className="relative rounded p-0.5 after:absolute after:-inset-2 hover:bg-accent hover:text-foreground"
          aria-label={t("remind_later")}
          title={t("remind_later")}
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  if (dismissed) return null
  const [before, after = ""] = t("local").split("{link}")
  return (
    <div data-print="hide" className="flex h-8 items-center gap-2 border-b bg-muted/40 px-4 text-xs text-muted-foreground">
      <HardDrive className="size-3.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate">
        {before}
        <Link href="/settings?tab=data" className="font-medium text-foreground underline-offset-2 hover:underline">
          {t("link")}
        </Link>
        {after}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="relative rounded p-0.5 after:absolute after:-inset-2 hover:bg-accent hover:text-foreground"
        aria-label={t("dismiss")}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
