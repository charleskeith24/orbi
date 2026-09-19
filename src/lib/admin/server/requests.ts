/**
 * SERVER ONLY — the access-request waitlist (`public.access_requests`), read and decided with the secret key.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AccessRequestData } from "../access-request"
import type { AccessRequest, AccessRequestStatus } from "../types"
import type { AdminIdentity } from "./session"

export const ACCESS_REQUEST_STATUSES: readonly AccessRequestStatus[] = ["pending", "approved", "rejected"]
/** Admin → Requests shows at most this many rows per status filter (the waitlist of a beta). */
export const REQUESTS_LIST_LIMIT = 500
/**
 * New requests stored per hour, for everyone together (public.submit_access_request enforces it in one
 * transaction). No per-IP limit: no IP is stored, and many mobile users share one carrier IP.
 */
export const ACCESS_REQUESTS_PER_HOUR = 30

/** What `public.submit_access_request()` answers. created / duplicate / exists all mean "thanks" to the visitor. */
export type SubmitOutcome = "created" | "duplicate" | "exists" | "closed" | "rate_limited"

const OUTCOMES: readonly SubmitOutcome[] = ["created", "duplicate", "exists", "closed", "rate_limited"]

/** Stores a validated request (secret-key client). Throws on a database error or an unknown answer. */
export async function submitAccessRequest(service: SupabaseClient, input: AccessRequestData): Promise<SubmitOutcome> {
  const { data, error } = await service.rpc("submit_access_request", {
    p_email: input.email,
    p_name: input.name,
    p_about: input.about,
    p_link: input.link,
    p_max_per_hour: ACCESS_REQUESTS_PER_HOUR,
  })
  if (error) throw new Error(`[access-requests] submit failed: ${error.message}`)
  if (!(OUTCOMES as readonly unknown[]).includes(data)) throw new Error(`[access-requests] unexpected answer: ${String(data)}`)
  return data as SubmitOutcome
}

const COLUMNS = "id, email, name, about, link, status, created_at, decided_at, decided_by_email"

export function isAccessRequestStatus(value: unknown): value is AccessRequestStatus {
  return typeof value === "string" && (ACCESS_REQUEST_STATUSES as readonly string[]).includes(value)
}

function toAccessRequest(row: Record<string, unknown>): AccessRequest {
  return {
    id: row.id as string,
    email: row.email as string,
    name: (row.name as string) ?? "",
    about: (row.about as string) ?? "",
    link: (row.link as string) ?? "",
    status: row.status as AccessRequestStatus,
    created_at: row.created_at as string,
    decided_at: (row.decided_at as string | null) ?? null,
    decided_by_email: (row.decided_by_email as string | null) ?? null,
  }
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`[admin] ${what}: ${error.message}`)
}

/** Newest first; optionally one status. */
export async function listAccessRequests(service: SupabaseClient, status?: AccessRequestStatus): Promise<AccessRequest[]> {
  let query = service.from("access_requests").select(COLUMNS)
  if (status) query = query.eq("status", status)
  const { data, error } = await query.order("created_at", { ascending: false }).limit(REQUESTS_LIST_LIMIT)
  if (error) fail("list requests", error)
  return (data ?? []).map((row) => toAccessRequest(row as Record<string, unknown>))
}

export async function getAccessRequest(service: SupabaseClient, id: string): Promise<AccessRequest | null> {
  const { data, error } = await service.from("access_requests").select(COLUMNS).eq("id", id).maybeSingle()
  if (error) fail("get request", error)
  return data ? toAccessRequest(data as Record<string, unknown>) : null
}

/**
 * Marks a pending request approved or rejected. Returns null when it was no longer pending (another admin
 * decided it first) — the update only matches `status = 'pending'`.
 */
export async function decideAccessRequest(
  service: SupabaseClient,
  id: string,
  status: "approved" | "rejected",
  admin: AdminIdentity,
  now: Date
): Promise<AccessRequest | null> {
  const { data, error } = await service
    .from("access_requests")
    .update({ status, decided_at: now.toISOString(), decided_by: admin.id, decided_by_email: admin.email })
    .eq("id", id)
    .eq("status", "pending")
    .select(COLUMNS)
    .maybeSingle()
  if (error) fail("decide request", error)
  return data ? toAccessRequest(data as Record<string, unknown>) : null
}

/** The pending request for an email, if any (an admin invited that person directly). */
export async function pendingRequestFor(service: SupabaseClient, email: string): Promise<AccessRequest | null> {
  const { data, error } = await service.from("access_requests").select(COLUMNS).eq("email", email.toLowerCase()).eq("status", "pending").maybeSingle()
  if (error) fail("find pending request", error)
  return data ? toAccessRequest(data as Record<string, unknown>) : null
}

export async function countPendingRequests(service: SupabaseClient): Promise<number> {
  const { count, error } = await service.from("access_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
  if (error) fail("count requests", error)
  return count ?? 0
}
