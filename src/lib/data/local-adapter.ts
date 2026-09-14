import type { DataAdapter } from "@/lib/data/adapter"
import { normalizeDatabase } from "@/lib/data/defaults"
import { createStarterDatabase } from "@/lib/data/starter"
import type { Database } from "@/lib/types"

/** v2: the demo workspace was retired — every browser starts empty and goes through onboarding. */
export const LOCAL_STORAGE_KEY = "pbos:workspace:v2"
/** Stable owner id for rows created in local mode. */
export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001"
/**
 * Dev-only QA hook: set before the first load to seed "demo" (the sample brand used by the test
 * suite) or "fresh" (onboarding done, nothing else — for empty-state checks). Ignored in production.
 */
export const DEV_SEED_KEY = "pbos:dev-seed"

interface PersistedWorkspace {
  version: 2
  userId: string
  savedAt: string
  db: Database
}

export interface LocalAdapterOptions {
  onPersistError?: (error: Error) => void
}

/** A brand-new workspace: the Starter Kit with onboarding still to do. */
async function firstRunDatabase(now: Date): Promise<Database> {
  if (process.env.NODE_ENV !== "production") {
    const seed = window.localStorage.getItem(DEV_SEED_KEY)
    if (seed === "demo") {
      const { createDemoDatabase } = await import("@/lib/data/seed")
      return createDemoDatabase(LOCAL_USER_ID, now)
    }
    if (seed === "fresh") {
      const db = createStarterDatabase(LOCAL_USER_ID, now)
      db.brand_profiles = db.brand_profiles.map((b) => ({ ...b, name: "New Creator", onboarding_completed: true }))
      return db
    }
  }
  return createStarterDatabase(LOCAL_USER_ID, now)
}

/** Browser-only persistence. Every mutation schedules a debounced snapshot write. */
export function createLocalAdapter(options: LocalAdapterOptions = {}): DataAdapter {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: Database | null = null

  const write = (db: Database) => {
    const payload: PersistedWorkspace = { version: 2, userId: LOCAL_USER_ID, savedAt: new Date().toISOString(), db }
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
          // Corrupt snapshot — keep a copy for recovery and start a new workspace.
          window.localStorage.setItem(`${LOCAL_STORAGE_KEY}:corrupt:${Date.now()}`, raw)
        }
      }
      const db = await firstRunDatabase(new Date())
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
