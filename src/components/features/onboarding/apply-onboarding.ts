/**
 * Executes onboarding plans through the store (optimistic, serialized, rolled back with a toast if
 * persistence fails): inserts in foreign-key order, then updates, then settings, and the brand
 * profile last — it flips `onboarding_completed`.
 */
import { TABLE_NAMES } from "@/lib/data/defaults"
import { createIdea, dataActions, updateBrand, updateSettings, useDataStore } from "@/lib/store"
import type { ID, InsertRow, TableName, UpdateRow } from "@/lib/types"
import { planStarterLibrary, type OnboardingPlan, type PlanInserts } from "./onboarding-plan"

function insertRows<T extends TableName>(table: T, rows: InsertRow<T>[]) {
  if (table === "content_ideas") {
    // Ideas go through the domain operation so score/priority stay consistent with the Idea Bank.
    for (const row of rows as InsertRow<"content_ideas">[]) createIdea(row)
    return
  }
  dataActions.insertMany(table, rows)
}

function updateRows<T extends TableName>(table: T, updates: { id: ID; patch: UpdateRow<T> }[]) {
  dataActions.updateMany(table, updates)
}

function insertAll(inserts: PlanInserts) {
  for (const table of TABLE_NAMES) {
    const rows = inserts[table]
    if (rows?.length) insertRows(table, rows as never)
  }
}

/**
 * Insert the Starter Kit library rows the workspace is missing (formats, angles, hook templates,
 * goals, platform strategies, tags) — new Supabase users start with an empty database.
 * Returns how many rows were added.
 */
export function ensureStarterLibrary(): number {
  const { inserts, count } = planStarterLibrary(useDataStore.getState().db)
  if (count) insertAll(inserts)
  return count
}

export function applyOnboardingPlan(plan: OnboardingPlan): void {
  insertAll(plan.inserts)
  for (const table of TABLE_NAMES) {
    const updates = plan.updates[table]
    if (updates?.length) updateRows(table, updates as never)
  }
  // A Niche Discovery re-run plans no settings change.
  if (Object.keys(plan.settings).length) updateSettings(plan.settings)
  updateBrand(plan.brand)
}
