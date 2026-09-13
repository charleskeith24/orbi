import type { DataAdapter } from "@/lib/data/adapter"
import { normalizeDatabase } from "@/lib/data/defaults"
import { createDemoDatabase } from "@/lib/data/seed"
import type { Database } from "@/lib/types"

export const LOCAL_STORAGE_KEY = "pbos:workspace:v1"
/** Stable owner id for rows created in local mode. */
export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001"

interface PersistedWorkspace {
  version: 1
  userId: string
  savedAt: string
  db: Database
}

export interface LocalAdapterOptions {
  onPersistError?: (error: Error) => void
}

/** Browser-only persistence. Every mutation schedules a debounced snapshot write. */
export function createLocalAdapter(options: LocalAdapterOptions = {}): DataAdapter {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: Database | null = null

  const write = (db: Database) => {
    const payload: PersistedWorkspace = { version: 1, userId: LOCAL_USER_ID, savedAt: new Date().toISOString(), db }
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      options.onPersistError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (pending) write(pending)
    pending = null
  }

  return {
    mode: "local",
    async load() {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PersistedWorkspace
          return { db: normalizeDatabase(parsed.db), userId: parsed.userId || LOCAL_USER_ID }
        } catch {
          // Corrupt snapshot — keep a copy for recovery and start from the demo workspace.
          window.localStorage.setItem(`${LOCAL_STORAGE_KEY}:corrupt:${Date.now()}`, raw)
        }
      }
      const db = createDemoDatabase(LOCAL_USER_ID, new Date())
      write(db)
      return { db, userId: LOCAL_USER_ID, isFirstRun: true }
    },
    async insert() {},
    async update() {},
    async remove() {},
    async replaceAll(db) {
      if (timer) clearTimeout(timer)
      timer = null
      pending = null
      write(db)
    },
    onChange(db) {
      pending = db
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 300)
    },
    flush,
  }
}
