"use client"

import { useMemo } from "react"
import { buildRow } from "@/lib/data/defaults"
import { useDataStore } from "@/lib/store/data-store"
import { canRead, canSeeMoney, canWrite, canManageWorkspace, denialReason, type WorkspaceAccess, type WorkspaceRole } from "@/lib/team/permissions"
import type { AppSettings, BrandProfile, Database, ID, Row, TableName, Tag, TaggableEntity } from "@/lib/types"

/** Rows of one table. Re-renders only when that table changes. */
export function useTable<T extends TableName>(table: T): Row<T>[] {
  return useDataStore((s) => s.db[table]) as Row<T>[]
}

/** One row by id (undefined when missing or id is empty). */
export function useRow<T extends TableName>(table: T, id: ID | null | undefined): Row<T> | undefined {
  return useDataStore((s) => (id ? (s.db[table] as Row<T>[]).find((r) => r.id === id) : undefined))
}

/** id → row map for fast lookups in lists. */
export function useLookup<T extends TableName>(table: T): Map<ID, Row<T>> {
  const rows = useTable(table)
  return useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])
}

/** The whole workspace — use for analytics-heavy views that read many tables. */
export function useDb(): Database {
  return useDataStore((s) => s.db)
}

/* --------------------------- Team workspaces (§17) -------------------------- */

/**
 * What the signed-in person may do in the workspace that is open. `"owner"` in your own workspace and in
 * local mode. The UI mirrors row-level security with these; Postgres is still the guard.
 */
export function useWorkspaceAccess(): WorkspaceAccess {
  return useDataStore((s) => s.access)
}

export function useWorkspaceRole(): WorkspaceRole {
  return useDataStore((s) => s.access.role)
}

/** True when the open workspace belongs to somebody else. */
export function useIsGuestWorkspace(): boolean {
  return useDataStore((s) => s.access.role !== "owner")
}

/** The owner id of the open workspace (every row's `user_id`). */
export function useWorkspaceOwnerId(): ID {
  return useDataStore((s) => s.ownerId)
}

/** May this person create, edit or delete rows of this table here? */
export function useCanWrite(table: TableName): boolean {
  const access = useWorkspaceAccess()
  return canWrite(table, access)
}

/** May this person see this table's rows at all? (Money without Money access: no.) */
export function useCanRead(table: TableName): boolean {
  const access = useWorkspaceAccess()
  return canRead(table, access)
}

/** Why a control is disabled here, or null when it isn't. Keys of `teamMessages`. */
export function useDenialReason(table: TableName): "viewer" | "owner_only" | "no_money" | null {
  const access = useWorkspaceAccess()
  return denialReason(table, access)
}

/** Money (brand deals, income, rate cards) is hidden from members without Money access. */
export function useCanSeeMoney(): boolean {
  const access = useWorkspaceAccess()
  return canSeeMoney(access)
}

/** Owner-only operations: Settings → Data, Integrations, AI, team management, deleting the workspace. */
export function useCanManageWorkspace(): boolean {
  const access = useWorkspaceAccess()
  return canManageWorkspace(access)
}

export function useDataStatus() {
  const status = useDataStore((s) => s.status)
  const error = useDataStore((s) => s.error)
  const mode = useDataStore((s) => s.mode)
  return { status, error, mode }
}

const FALLBACK_BRAND = buildRow("brand_profiles", {}, "", new Date(0))
const FALLBACK_SETTINGS = buildRow("app_settings", {}, "", new Date(0))

/** The single brand profile row (guaranteed to exist once the store is ready). */
export function useBrand(): BrandProfile {
  return useDataStore((s) => s.db.brand_profiles[0] ?? FALLBACK_BRAND)
}

/** The single settings row (guaranteed to exist once the store is ready). */
export function useSettings(): AppSettings {
  return useDataStore((s) => s.db.app_settings[0] ?? FALLBACK_SETTINGS)
}

/** Tags attached to an entity via the polymorphic `content_tags` join. */
export function useEntityTags(entityType: TaggableEntity, entityId: ID | null | undefined): Tag[] {
  const links = useTable("content_tags")
  const tags = useTable("tags")
  return useMemo(() => {
    if (!entityId) return []
    const ids = new Set(links.filter((l) => l.entity_type === entityType && l.entity_id === entityId).map((l) => l.tag_id))
    return tags.filter((t) => ids.has(t.id))
  }, [links, tags, entityType, entityId])
}
