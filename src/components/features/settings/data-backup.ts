"use client"

/**
 * Local-mode backups: when this browser last exported the workspace, and whether it's time for a
 * gentle reminder (Settings → Data shows the date; the app-shell banner shows the reminder).
 */
import { useEffect, useState, useSyncExternalStore } from "react"
import type { DataMode } from "@/lib/data/adapter"
import type { Database } from "@/lib/types"
import { downloadJsonFile } from "./download"
import { buildWorkspaceExport, exportFilename, totalRows, workspaceCounts } from "./workspace-io"

/** ISO time of the last workspace export from this browser. */
export const LAST_BACKUP_KEY = "pbos:backup:last"
/** ISO time until which the banner reminder stays hidden ("Remind me later"). */
export const BACKUP_SNOOZE_KEY = "pbos:backup:snoozed-until"
export const BACKUP_REMINDER_DAYS = 7
export const BACKUP_SNOOZE_DAYS = 3

const DAY_MS = 86_400_000

function parseTime(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export interface BackupReminderInput {
  lastBackupAt: string | null
  /** When the workspace was created, so a brand-new workspace isn't nagged on day one. */
  workspaceSince: string | null
  snoozedUntil: string | null
  now: Date
}

export interface BackupReminder {
  due: boolean
  /** Whole days since the last backup — or since the workspace was created, when there has been none. */
  days: number | null
  never: boolean
}

export function backupReminder({ lastBackupAt, workspaceSince, snoozedUntil, now }: BackupReminderInput): BackupReminder {
  const last = parseTime(lastBackupAt)
  const since = last ?? parseTime(workspaceSince)
  const days = since ? Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS)) : null
  const snoozed = parseTime(snoozedUntil)
  return { due: days !== null && days >= BACKUP_REMINDER_DAYS && !(snoozed && snoozed > now), days, never: !last }
}

/** Whole days between `from` and `now` (0 = today). */
export function daysSince(from: string, now: Date): number | null {
  const date = parseTime(from)
  return date ? Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS)) : null
}

/* ------------------------------ Browser storage ------------------------------ */

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LAST_BACKUP_KEY || event.key === BACKUP_SNOOZE_KEY) listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage full or blocked: the reminder simply can't remember this.
  }
  listeners.forEach((l) => l())
}

export function useLastBackup(): string | null {
  return useSyncExternalStore(subscribe, () => read(LAST_BACKUP_KEY), () => null)
}

export function useBackupSnooze(): string | null {
  return useSyncExternalStore(subscribe, () => read(BACKUP_SNOOZE_KEY), () => null)
}

export function recordBackup(at: Date): void {
  write(LAST_BACKUP_KEY, at.toISOString())
  write(BACKUP_SNOOZE_KEY, null)
}

export function snoozeBackupReminder(now: Date): void {
  write(BACKUP_SNOOZE_KEY, new Date(now.getTime() + BACKUP_SNOOZE_DAYS * DAY_MS).toISOString())
}

/** Downloads the whole workspace as a JSON backup and records when. Returns the number of rows. */
export function exportWorkspaceBackup(db: Database, mode: DataMode, now: Date = new Date()): number {
  downloadJsonFile(exportFilename(now), buildWorkspaceExport(db, mode, now))
  recordBackup(now)
  return totalRows(workspaceCounts(db))
}

/** The current time, refreshed every `intervalMs` (no clock reads during render). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
