"use client"

import { HardDrive, X } from "lucide-react"
import Link from "next/link"
import { useSyncExternalStore } from "react"
import { useDataStatus } from "@/lib/store"

const KEY = "pbos:banner:local-mode:dismissed"
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

/** Honest mode indicator: local mode keeps data in this browser only. */
export function WorkspaceBanner() {
  const { mode, status } = useDataStatus()
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true)
  if (mode !== "local" || status !== "ready" || dismissed) return null

  return (
    <div data-print="hide" className="flex items-center gap-2 border-b bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
      <HardDrive className="size-3.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate">
        Local workspace — data is saved in this browser only. Export backups or connect Supabase for accounts and sync in{" "}
        <Link href="/settings?tab=data" className="font-medium text-foreground underline-offset-2 hover:underline">
          Settings → Data
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="rounded p-0.5 hover:bg-accent hover:text-foreground"
        aria-label="Dismiss local workspace notice"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
