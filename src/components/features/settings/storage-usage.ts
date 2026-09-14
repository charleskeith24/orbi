"use client"

import { useEffect, useState } from "react"
import { LOCAL_STORAGE_KEY } from "@/lib/data/local-adapter"

/** Browsers typically allow about 5 MB of local storage per site. */
export const LOCAL_STORAGE_QUOTA = 5 * 1024 * 1024

export interface StorageUsage {
  /** Characters in the workspace snapshot (≈ bytes for JSON). */
  workspace: number
  /** Characters across every key this site stores. */
  total: number
  savedAt: string | null
  /** Snapshots kept aside after a failed load (`pbos:workspace:v2:corrupt:*`). */
  recoveryCopies: number
}

export function readStorageUsage(): StorageUsage | null {
  try {
    const storage = window.localStorage
    let total = 0
    let recoveryCopies = 0
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key) continue
      total += key.length + (storage.getItem(key)?.length ?? 0)
      if (key.startsWith(`${LOCAL_STORAGE_KEY}:corrupt:`)) recoveryCopies++
    }
    const raw = storage.getItem(LOCAL_STORAGE_KEY) ?? ""
    const savedAt = /"savedAt":"([^"]+)"/.exec(raw.slice(0, 400))?.[1] ?? null
    return { workspace: raw.length, total, savedAt, recoveryCopies }
  } catch {
    return null
  }
}

/** Local storage usage, re-read shortly after each workspace change (the adapter saves on a short debounce). */
export function useStorageUsage(enabled: boolean, trigger: unknown): StorageUsage | null {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(() => setUsage(readStorageUsage()), 450)
    return () => window.clearTimeout(timer)
  }, [enabled, trigger])
  return enabled ? usage : null
}
