import { toast } from "sonner"
import { create } from "zustand"
import type { DataAdapter, DataMode } from "@/lib/data/adapter"
import { buildRow, emptyDatabase, normalizeDatabase } from "@/lib/data/defaults"
import { planDelete } from "@/lib/data/relations"
import { translate, uiLangOf } from "@/lib/i18n/core"
import { canWrite, denialReason, OWNER_ACCESS, type WorkspaceAccess } from "@/lib/team/permissions"
import { isPersonalOnly } from "@/lib/team/workspace"
import { teamMessages } from "@/lib/team/messages"
import type { Database, ID, InsertRow, Row, TableName, UpdateRow } from "@/lib/types"

export type DataStatus = "idle" | "loading" | "ready" | "error"

export interface DataState {
  db: Database
  status: DataStatus
  error: string | null
  mode: DataMode
  /** The signed-in account. */
  userId: string
  /** The workspace that is open: every row's `user_id`. Equal to `userId` in your own workspace. */
  ownerId: string
  /** What the signed-in person may do in the open workspace (ARCHITECTURE §17). */
  access: WorkspaceAccess
  isFirstRun: boolean
  adapter: DataAdapter | null

  init(adapter: DataAdapter): Promise<void>
  reload(): Promise<void>
  /** Optimistic insert — returns the complete row immediately. */
  insert<T extends TableName>(table: T, values: InsertRow<T>): Row<T>
  insertMany<T extends TableName>(table: T, values: InsertRow<T>[]): Row<T>[]
  update<T extends TableName>(table: T, id: ID, patch: UpdateRow<T>): void
  updateMany<T extends TableName>(table: T, updates: { id: ID; patch: UpdateRow<T> }[]): void
  /** Deletes rows and applies cascades / set-null / tag-link cleanup. */
  remove<T extends TableName>(table: T, ids: ID | ID[]): void
  /** Replace the whole workspace (import, reset, demo data). */
  replaceWorkspace(db: Database): Promise<void>
}

const TABLE_LABELS: Partial<Record<TableName, string>> = {
  content_ideas: "idea",
  content_items: "content",
  content_metrics: "analytics",
  content_pillars: "pillar",
  audience_personas: "persona",
  brand_profiles: "brand profile",
  app_settings: "settings",
}
const labelFor = (table: TableName) => TABLE_LABELS[table] ?? table.replace(/_/g, " ")

/**
 * Team workspaces: a write the open role can't make is refused here, so the UI never fires a request
 * row-level security would reject. This mirrors the policies (src/lib/team/permissions.ts); Postgres is
 * still the guard. The one exception is `app_settings`, where a member may save their own personal
 * preferences — the adapter routes those to their own row.
 */
function refuseWrite(table: TableName, access: WorkspaceAccess, patch?: Record<string, unknown>): boolean {
  if (canWrite(table, access)) return false
  if (table === "app_settings" && patch && isPersonalOnly(patch)) return false
  const lang = uiLangOf(useDataStore.getState().db.app_settings[0])
  const reason = denialReason(table, access) ?? "viewer"
  toast.error(translate(teamMessages, lang, `refused_${reason}`), { id: `team-refused-${reason}` })
  return true
}

type AnyRow = Row<TableName>
type RowsOf = (db: Database, table: TableName) => AnyRow[]
const rowsOf: RowsOf = (db, table) => db[table] as AnyRow[]
const withRows = (db: Database, table: TableName, rows: AnyRow[]): Database => ({ ...db, [table]: rows })

/** Writes are serialized so dependent operations (insert → update) reach the backend in order. */
let writeQueue: Promise<unknown> = Promise.resolve()
function persist(label: string, op: () => Promise<void>, rollback: () => void) {
  writeQueue = writeQueue.then(op).catch((err: unknown) => {
    rollback()
    toast.error(`Couldn't save ${label}`, {
      description: err instanceof Error ? err.message : String(err),
    })
  })
}

export const useDataStore = create<DataState>()((set, get) => {
  const commit = (db: Database) => {
    set({ db })
    get().adapter?.onChange?.(db)
  }

  return {
    db: emptyDatabase(),
    status: "idle",
    error: null,
    mode: "local",
    userId: "",
    ownerId: "",
    access: OWNER_ACCESS,
    isFirstRun: false,
    adapter: null,

    async init(adapter) {
      set({ status: "loading", error: null, adapter, mode: adapter.mode })
      try {
        const { db, userId, isFirstRun, ownerId, access } = await adapter.load()
        set({
          db,
          userId,
          ownerId: ownerId ?? userId,
          access: access ?? OWNER_ACCESS,
          isFirstRun: Boolean(isFirstRun),
          status: "ready",
        })
        // Guarantee singleton rows exist so `useBrand()` / `useSettings()` are always updatable.
        // A member can't create them in someone else's workspace, and doesn't need to: the owner has them.
        if (canWrite("app_settings", get().access)) {
          if (!db.app_settings.length) get().insert("app_settings", {})
          if (!db.brand_profiles.length) get().insert("brand_profiles", {})
        }
      } catch (err) {
        set({ status: "error", error: err instanceof Error ? err.message : String(err) })
      }
    },

    async reload() {
      const adapter = get().adapter
      if (adapter) await get().init(adapter)
    },

    insert(table, values) {
      return get().insertMany(table, [values])[0]
    },

    insertMany(table, values) {
      const { db, ownerId, adapter, access } = get()
      const now = new Date()
      // Rows belong to the workspace that is open, not to the signed-in account.
      const rows = values.map((v) => buildRow(table, v, ownerId, now))
      // Refused: the rows are built so callers that read the returned id don't crash, but nothing is
      // committed to the store and nothing is sent. The toast has already said why.
      if (refuseWrite(table, access)) return rows
      if (!rows.length) return rows
      commit(withRows(db, table, [...rowsOf(db, table), ...(rows as AnyRow[])]))
      if (adapter) {
        persist(
          labelFor(table),
          () => adapter.insert(table, rows),
          () => {
            const ids = new Set(rows.map((r) => r.id))
            const cur = get().db
            commit(withRows(cur, table, rowsOf(cur, table).filter((r) => !ids.has(r.id))))
          }
        )
      }
      return rows
    },

    update(table, id, patch) {
      get().updateMany(table, [{ id, patch }])
    },

    updateMany(table, updates) {
      const { db, adapter, access } = get()
      if (updates.some((u) => refuseWrite(table, access, u.patch as Record<string, unknown>))) return
      const nowIso = new Date().toISOString()
      const patches = new Map(updates.map((u) => [u.id, u.patch as Record<string, unknown>]))
      const previous = new Map<ID, AnyRow>()
      const rows = rowsOf(db, table).map((row) => {
        const patch = patches.get(row.id)
        if (!patch) return row
        previous.set(row.id, row)
        return { ...row, ...patch, updated_at: nowIso } as AnyRow
      })
      if (!previous.size) return
      commit(withRows(db, table, rows))
      if (!adapter) return
      for (const [id, patch] of patches) {
        if (!previous.has(id)) continue
        persist(
          labelFor(table),
          () => adapter.update(table, id, { ...patch, updated_at: nowIso }),
          () => {
            const cur = get().db
            commit(withRows(cur, table, rowsOf(cur, table).map((r) => (r.id === id ? previous.get(id)! : r))))
          }
        )
      }
    },

    remove(table, idOrIds) {
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
      if (!ids.length) return
      const { db, adapter, access } = get()
      if (refuseWrite(table, access)) return
      const plan = planDelete(db, table, ids)
      const nowIso = new Date().toISOString()
      const removed = new Map<TableName, AnyRow[]>()
      const patchedPrevious = new Map<TableName, AnyRow[]>()
      let next = db

      for (const [t, patchMap] of plan.patches) {
        const prev: AnyRow[] = []
        next = withRows(
          next,
          t,
          rowsOf(next, t).map((row) => {
            const patch = patchMap.get(row.id)
            if (!patch) return row
            prev.push(row)
            return { ...row, ...patch, updated_at: nowIso } as AnyRow
          })
        )
        patchedPrevious.set(t, prev)
      }
      for (const [t, idSet] of plan.deletes) {
        const rows = rowsOf(next, t)
        removed.set(t, rows.filter((r) => idSet.has(r.id)))
        next = withRows(next, t, rows.filter((r) => !idSet.has(r.id)))
      }
      commit(next)

      if (adapter) {
        persist(
          labelFor(table),
          () => adapter.remove(table, ids, plan),
          () => {
            let cur = get().db
            for (const [t, rows] of removed) cur = withRows(cur, t, [...rowsOf(cur, t), ...rows])
            for (const [t, rows] of patchedPrevious) {
              const byId = new Map(rows.map((r) => [r.id, r]))
              cur = withRows(cur, t, rowsOf(cur, t).map((r) => byId.get(r.id) ?? r))
            }
            commit(cur)
          }
        )
      }
    },

    async replaceWorkspace(db) {
      const { adapter, ownerId, access } = get()
      if (!adapter) throw new Error("Workspace is not loaded yet")
      if (access.role !== "owner") throw new Error("Only the owner of a workspace can replace its data.")
      const normalized = normalizeDatabase(db)
      for (const table of Object.keys(normalized) as TableName[]) {
        for (const row of rowsOf(normalized, table)) (row as { user_id: string }).user_id = ownerId
      }
      await writeQueue
      await adapter.replaceAll(normalized)
      set({ db: normalized, isFirstRun: false })
    },
  }
})

/** Imperative access for event handlers and domain helpers (no hook needed). */
export const dataActions = {
  insert: <T extends TableName>(table: T, values: InsertRow<T>) => useDataStore.getState().insert(table, values),
  insertMany: <T extends TableName>(table: T, values: InsertRow<T>[]) =>
    useDataStore.getState().insertMany(table, values),
  update: <T extends TableName>(table: T, id: ID, patch: UpdateRow<T>) =>
    useDataStore.getState().update(table, id, patch),
  updateMany: <T extends TableName>(table: T, updates: { id: ID; patch: UpdateRow<T> }[]) =>
    useDataStore.getState().updateMany(table, updates),
  remove: <T extends TableName>(table: T, ids: ID | ID[]) => useDataStore.getState().remove(table, ids),
  getDb: () => useDataStore.getState().db,
}
