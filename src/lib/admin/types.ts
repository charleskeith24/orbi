/**
 * Admin & access contract (docs/ADMIN_BRIEF.md) — shared by the `/api/admin/*` route handlers,
 * the server gate and the admin UI. Pure types: no runtime imports.
 *
 * Privacy rule: nothing here carries a creator's content — account metadata and counts only.
 * Additive changes are fine; renaming or removing a field needs the lead.
 */

/* --------------------------------- Requests -------------------------------- */

export type AccessRequestStatus = "pending" | "approved" | "rejected"

/** A waitlist entry from the public "Request access" form. */
export interface AccessRequest {
  id: string
  email: string
  name: string
  /** "What do you create?" — optional, ≤ 300 chars. */
  about: string
  /** Optional link to the creator's page. */
  link: string
  status: AccessRequestStatus
  created_at: string
  decided_at: string | null
  decided_by_email: string | null
}

/* ---------------------------------- Users ---------------------------------- */

/** invited = invite sent, never signed in · active = can sign in · disabled = banned by an admin. */
export type AdminUserStatus = "invited" | "active" | "disabled"

export interface AdminUserRow {
  id: string
  email: string
  /** `public.users.full_name`, may be empty. */
  name: string
  status: AdminUserStatus
  is_admin: boolean
  /** The signed-in admin's own row (self-guards: can't disable, delete or un-admin yourself). */
  is_self: boolean
  mfa_enabled: boolean
  created_at: string
  invited_at: string | null
  last_sign_in_at: string | null
  onboarding_completed: boolean
  /** Counts only — never titles or text. */
  counts: { ideas: number; content_items: number; published: number }
}

export interface AdminUserQuery {
  /** 1-based. */
  page?: number
  /** Case-insensitive match on email or name. */
  query?: string
  status?: AdminUserStatus
}

/* --------------------------------- Overview -------------------------------- */

export interface OnboardingFunnelStep {
  /** Step key from `onboarding_step_*` usage events (e.g. "start", "about", "audience", "niche"). */
  step: string
  index: number
  viewed: number
  completed: number
}

export interface AdminOverview {
  users_total: number
  active_7d: number
  active_30d: number
  onboarding_completed: number
  pending_requests: number
  feedback_7d: number
  /** Opt-in usage events only, so it undercounts — the UI says so. */
  funnel: OnboardingFunnelStep[]
  access_open: boolean
}

/* --------------------------------- Feedback -------------------------------- */

export type AdminFeedbackKind = "bug" | "idea" | "confusing" | "praise"

export interface AdminFeedback {
  id: string
  kind: AdminFeedbackKind
  message: string
  /** Page path without query string or hash. */
  page: string
  ui_language: string
  viewport: string
  created_at: string
  user_email: string
}

/* ---------------------------------- Audit ---------------------------------- */

export const ADMIN_AUDIT_ACTIONS = [
  "request_approved",
  "request_rejected",
  "user_invited",
  "invite_resent",
  "user_disabled",
  "user_enabled",
  "password_reset_sent",
  "user_deleted",
  "admin_granted",
  "admin_revoked",
  "settings_updated",
] as const
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number]

export interface AdminAuditEntry {
  id: string
  action: AdminAuditAction
  admin_email: string
  target_email: string | null
  /** Small, content-free facts, e.g. { from: "active", to: "disabled" }. */
  details: Record<string, string | number | boolean | null>
  created_at: string
}

/* -------------------------------- Settings --------------------------------- */

export interface AdminSettings {
  /** Whether the public "Request access" form accepts new requests. */
  access_open: boolean
}

/* ------------------------------- Pagination -------------------------------- */

export interface Page<T> {
  items: T[]
  /** 1-based. */
  page: number
  has_more: boolean
}

/* ------------------------------ HTTP contract ------------------------------ */

/**
 * Routes (all `Cache-Control: no-store`; failures are `{ error, message }` with a real status;
 * mutations require a same-origin `Origin` header):
 *
 *   GET    /api/admin/overview                       → AdminOverview
 *   GET    /api/admin/requests?status=               → AccessRequest[]
 *   POST   /api/admin/requests/:id/approve           → AccessRequest
 *   POST   /api/admin/requests/:id/reject            → AccessRequest
 *   GET    /api/admin/users?page=&query=&status=     → Page<AdminUserRow>
 *   POST   /api/admin/users/invite        { email }  → AdminUserRow
 *   POST   /api/admin/users/:id/resend-invite        → { ok: true }
 *   POST   /api/admin/users/:id/disable              → AdminUserRow
 *   POST   /api/admin/users/:id/enable               → AdminUserRow
 *   POST   /api/admin/users/:id/reset-password       → { ok: true }
 *   DELETE /api/admin/users/:id   { confirm_email }  → { ok: true }
 *   POST   /api/admin/users/:id/admin                → AdminUserRow
 *   DELETE /api/admin/users/:id/admin                → AdminUserRow
 *   GET    /api/admin/feedback?page=                 → Page<AdminFeedback>
 *   GET    /api/admin/audit?page=                    → Page<AdminAuditEntry>
 *   GET    /api/admin/settings                       → AdminSettings
 *   PATCH  /api/admin/settings    Partial<AdminSettings> → AdminSettings
 *
 *   POST   /api/access-requests   AccessRequestInput → { ok: true }   (public; same answer for duplicates)
 *
 * Error codes the UI translates: "not_configured" 501, "unauthorized" 401, "not_found" 404 (also for
 * non-admins), "mfa_required" 403, "bad_origin" 403, "invalid" 400, "self_action" 409,
 * "last_admin" 409, "conflict" 409, "rate_limited" 429, "closed" 403, "server_error" 500.
 */
export type AdminErrorCode =
  | "not_configured"
  | "unauthorized"
  | "not_found"
  | "mfa_required"
  | "bad_origin"
  | "invalid"
  | "self_action"
  | "last_admin"
  | "conflict"
  | "rate_limited"
  | "closed"
  | "server_error"

export interface AdminErrorBody {
  error: AdminErrorCode
  message: string
  /** POST /api/access-requests, 400 invalid only: field → error key from `accessRequestErrors` (./access-request). */
  fields?: Partial<Record<string, string>>
}

/**
 * Whether the public "Request access" form takes requests — `getAccessRequestState()` in ./server/settings, for the
 * `/signup` server component: local (no Supabase) · not_configured (no SUPABASE_SECRET_KEY on the server, so
 * requests can't be stored) · open · closed (the admin switched requests off).
 */
export type AccessRequestState = "local" | "not_configured" | "open" | "closed"

/** The admin UI's data client. `features/admin` implements it over HTTP (and a dev-only fixture). */
export interface AdminApi {
  overview(): Promise<AdminOverview>
  listRequests(status?: AccessRequestStatus): Promise<AccessRequest[]>
  approveRequest(id: string): Promise<AccessRequest>
  rejectRequest(id: string): Promise<AccessRequest>
  listUsers(query?: AdminUserQuery): Promise<Page<AdminUserRow>>
  inviteUser(email: string): Promise<AdminUserRow>
  resendInvite(id: string): Promise<void>
  disableUser(id: string): Promise<AdminUserRow>
  enableUser(id: string): Promise<AdminUserRow>
  sendPasswordReset(id: string): Promise<void>
  deleteUser(id: string, confirmEmail: string): Promise<void>
  grantAdmin(id: string): Promise<AdminUserRow>
  revokeAdmin(id: string): Promise<AdminUserRow>
  listFeedback(page?: number): Promise<Page<AdminFeedback>>
  listAudit(page?: number): Promise<Page<AdminAuditEntry>>
  getSettings(): Promise<AdminSettings>
  updateSettings(patch: Partial<AdminSettings>): Promise<AdminSettings>
}

/* ---------------------------------- Gate ----------------------------------- */

/**
 * Where a request to an `/admin` page stands (`getAdminGate()` in `./gate`):
 * local = no Supabase (show the online-version notice) · signed_out → /login?next= ·
 * not_admin → 404 · needs_mfa → /admin/security (enroll when !has_factor, else challenge) · ok.
 */
export type AdminGate =
  | { status: "local" }
  | { status: "signed_out" }
  | { status: "not_admin" }
  | { status: "needs_mfa"; has_factor: boolean; email: string }
  | { status: "ok"; admin: { id: string; email: string } }
