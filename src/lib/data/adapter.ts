import type { DeletePlan } from "@/lib/data/relations"
import type { Database, ID, Row, TableName } from "@/lib/types"

export type DataMode = "local" | "supabase"

export interface LoadResult {
  db: Database
  userId: string
  /** True when the workspace was just created (no prior data). */
  isFirstRun?: boolean
}

/**
 * Persistence boundary. The client store holds the whole workspace in memory
 * (a personal brand workspace is small) and calls the adapter for durability.
 *
 * - `local`    → browser localStorage, seeded with a demo workspace
 * - `supabase` → Postgres with row-level security, one row set per auth user
 */
export interface DataAdapter {
  readonly mode: DataMode
  load(): Promise<LoadResult>
  insert<T extends TableName>(table: T, rows: Row<T>[]): Promise<void>
  update<T extends TableName>(table: T, id: ID, patch: Record<string, unknown>): Promise<void>
  /**
   * Delete `ids` from `table`. `plan` lists every cascaded delete and patch the
   * store already applied in memory; adapters backed by a real database only
   * need the parts the database cannot enforce itself.
   */
  remove<T extends TableName>(table: T, ids: ID[], plan: DeletePlan): Promise<void>
  /** Replace the entire workspace (import, reset, load demo). */
  replaceAll(db: Database): Promise<void>
  /** Receives the full next state after every in-memory mutation. */
  onChange?(db: Database): void
  /** Flush any debounced writes (called on page hide / unload). */
  flush?(): void
}
