/**
 * SERVER ONLY — the admin audit log: one row per admin action, written with the secret key (append-only in the
 * database), read through the admin's own session (the read policy requires is_admin() and AAL2).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminAuditAction, AdminAuditEntry, Page } from "../types"
import type { AdminIdentity } from "./session"

export const AUDIT_PAGE_SIZE = 50

export type AuditDetails = AdminAuditEntry["details"]

export interface AuditInput {
  action: AdminAuditAction
  target_user_id?: string | null
  target_email?: string | null
  /** Small, content-free facts only, e.g. { from: "active", to: "disabled" }. */
  details?: AuditDetails
}

/**
 * Records an action that already happened. A failure is logged, not thrown: the action itself (an email
 * sent, an account deleted) can't be undone, and the admin must still see that it worked.
 */
export async function writeAudit(service: SupabaseClient, admin: AdminIdentity, input: AuditInput): Promise<void> {
  const { error } = await service.from("admin_audit_log").insert({
    admin_id: admin.id,
    admin_email: admin.email,
    action: input.action,
    target_user_id: input.target_user_id ?? null,
    target_email: input.target_email ?? null,
    details: input.details ?? {},
  })
  if (error) console.error("[admin] audit insert failed", input.action, error.message)
}

/** Newest first. `supabase` is the admin's session client, so row-level security applies. */
export async function listAudit(supabase: SupabaseClient, page: number): Promise<Page<AdminAuditEntry>> {
  const from = (page - 1) * AUDIT_PAGE_SIZE
  // One extra row tells whether another page exists.
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, action, admin_email, target_email, details, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE)
  if (error) throw new Error(`[admin] list audit: ${error.message}`)
  const rows = (data ?? []) as Record<string, unknown>[]
  return {
    items: rows.slice(0, AUDIT_PAGE_SIZE).map((row) => ({
      id: row.id as string,
      action: row.action as AdminAuditAction,
      admin_email: (row.admin_email as string) ?? "",
      target_email: (row.target_email as string | null) ?? null,
      details: (row.details as AuditDetails) ?? {},
      created_at: row.created_at as string,
    })),
    page,
    has_more: rows.length > AUDIT_PAGE_SIZE,
  }
}
