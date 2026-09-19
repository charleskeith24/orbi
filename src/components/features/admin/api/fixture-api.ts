/**
 * DEV-ONLY admin fixture: an in-memory fake of the admin API (and of 2-step verification) with a
 * handful of clearly-labelled sample rows, so the admin screens can be screenshotted and click-audited
 * on the local dev server, where the real admin can't run.
 *
 * Enabled with `localStorage["pbos:dev-admin"] = "fixture"` (scripts: `--admin`) and loaded only
 * through `loadAdminFixture()` in `./dev-fixture`, which never runs in production. Creating it in a
 * production build throws. Nothing here is real: every person is "(sample)" at example.com.
 */
import type {
  AccessRequest,
  AccessRequestStatus,
  AdminApi,
  AdminAuditAction,
  AdminAuditEntry,
  AdminFeedback,
  AdminFeedbackKind,
  AdminOverview,
  AdminSettings,
  AdminUserQuery,
  AdminUserRow,
  Page,
} from "@/lib/admin/types"
import { samplePhoto } from "@/lib/profiles/sample-photos"
import { AdminApiError } from "./errors"
import { MfaError, type MfaClient, type MfaFactor } from "./mfa-client"

export const FIXTURE_PAGE_SIZE = 10

export const FIXTURE_SELF = { id: "sample-admin", email: "you.sample@example.com" } as const

/** Simulated network latency, so pending states show up in screenshots. */
const LATENCY_MS = 120

const DAY = 86_400_000
const HOUR = 3_600_000

interface FixtureState {
  users: AdminUserRow[]
  requests: AccessRequest[]
  feedback: AdminFeedback[]
  audit: AdminAuditEntry[]
  settings: AdminSettings
  factors: MfaFactor[]
  pendingFactor: string | null
  nextId: number
}

function iso(now: number, offset: number): string {
  return new Date(now - offset).toISOString()
}

function user(
  now: number,
  id: string,
  name: string,
  email: string,
  patch: Partial<AdminUserRow> & { joinedDaysAgo: number; lastSignInDaysAgo?: number | null }
): AdminUserRow {
  const { joinedDaysAgo, lastSignInDaysAgo = null, ...rest } = patch
  return {
    id,
    email,
    name,
    photo_url: null,
    status: "active",
    is_admin: false,
    is_self: false,
    mfa_enabled: false,
    created_at: iso(now, joinedDaysAgo * DAY),
    invited_at: iso(now, joinedDaysAgo * DAY),
    last_sign_in_at: lastSignInDaysAgo === null ? null : iso(now, lastSignInDaysAgo * DAY + 2 * HOUR),
    onboarding_completed: true,
    counts: { ideas: 0, content_items: 0, published: 0 },
    ...rest,
  }
}

function seed(now: number): FixtureState {
  const users: AdminUserRow[] = [
    user(now, FIXTURE_SELF.id, "You (sample admin)", FIXTURE_SELF.email, {
      joinedDaysAgo: 60,
      lastSignInDaysAgo: 0,
      is_admin: true,
      is_self: true,
      mfa_enabled: true,
      counts: { ideas: 64, content_items: 31, published: 22 },
    }),
    user(now, "sample-u2", "Mika Dizon (sample)", "mika.sample@example.com", {
      photo_url: samplePhoto(1),
      joinedDaysAgo: 55,
      lastSignInDaysAgo: 2,
      is_admin: true,
      mfa_enabled: true,
      counts: { ideas: 18, content_items: 9, published: 6 },
    }),
    user(now, "sample-u3", "Bea Santos (sample)", "bea.sample@example.com", {
      photo_url: samplePhoto(4),
      joinedDaysAgo: 40,
      lastSignInDaysAgo: 1,
      counts: { ideas: 42, content_items: 18, published: 11 },
    }),
    user(now, "sample-u4", "Gio Tan (sample)", "gio.sample@example.com", {
      photo_url: samplePhoto(2),
      joinedDaysAgo: 33,
      lastSignInDaysAgo: 4,
      counts: { ideas: 12, content_items: 5, published: 2 },
    }),
    user(now, "sample-u5", "Dana Cruz (sample)", "dana.sample@example.com", {
      joinedDaysAgo: 2,
      status: "invited",
      onboarding_completed: false,
    }),
    user(now, "sample-u6", "Eli Navarro (sample)", "eli.sample@example.com", {
      joinedDaysAgo: 28,
      lastSignInDaysAgo: 21,
      status: "disabled",
      counts: { ideas: 3, content_items: 1, published: 0 },
    }),
    user(now, "sample-u7", "Faye Lim (sample)", "faye.sample@example.com", {
      joinedDaysAgo: 9,
      lastSignInDaysAgo: 9,
      onboarding_completed: false,
    }),
    user(now, "sample-u8", "Hana Uy (sample)", "hana.sample@example.com", {
      joinedDaysAgo: 6,
      status: "invited",
      onboarding_completed: false,
    }),
    user(now, "sample-u9", "Ivan Ramos (sample)", "ivan.sample@example.com", {
      joinedDaysAgo: 24,
      lastSignInDaysAgo: 20,
      counts: { ideas: 5, content_items: 1, published: 0 },
    }),
    user(now, "sample-u10", "Jo Mercado (sample)", "jo.sample@example.com", {
      photo_url: samplePhoto(5),
      joinedDaysAgo: 19,
      lastSignInDaysAgo: 3,
      counts: { ideas: 27, content_items: 12, published: 8 },
    }),
    user(now, "sample-u11", "Kai Villanueva (sample)", "kai.sample@example.com", {
      photo_url: samplePhoto(6),
      joinedDaysAgo: 14,
      lastSignInDaysAgo: 0,
      counts: { ideas: 9, content_items: 4, published: 1 },
    }),
    user(now, "sample-u12", "", "lea.sample@example.com", {
      joinedDaysAgo: 12,
      lastSignInDaysAgo: 11,
      counts: { ideas: 2, content_items: 0, published: 0 },
    }),
  ]

  const request = (
    id: string,
    name: string,
    email: string,
    about: string,
    link: string,
    hoursAgo: number,
    status: AccessRequestStatus = "pending"
  ): AccessRequest => ({
    id,
    name,
    email,
    about,
    link,
    status,
    created_at: iso(now, hoursAgo * HOUR),
    decided_at: status === "pending" ? null : iso(now, (hoursAgo - 6) * HOUR),
    decided_by_email: status === "pending" ? null : FIXTURE_SELF.email,
  })
  const requests: AccessRequest[] = [
    request("sample-r1", "Marco Bautista (sample)", "marco.sample@example.com", "Sample request — food vlogs about neighborhood carinderias", "https://example.com/marco", 5),
    request("sample-r2", "Nina Castillo (sample)", "nina.sample@example.com", "Sample request — money tips for first-jobbers", "", 20),
    request("sample-r3", "Paolo Aquino (sample)", "paolo.sample@example.com", "", "https://example.com/@paolo", 30),
    request("sample-r4", "Bea Santos (sample)", "bea.sample@example.com", "Sample request — skincare on a budget", "https://example.com/bea", 40 * 24, "approved"),
    request("sample-r5", "Gio Tan (sample)", "gio.sample@example.com", "Sample request — gym and running", "", 33 * 24, "approved"),
    request("sample-r6", "Test Bot (sample)", "bot.sample@example.com", "Sample request — spam", "https://example.com/spam", 12 * 24, "rejected"),
  ]

  const kinds: AdminFeedbackKind[] = ["bug", "idea", "confusing", "praise"]
  const notes = [
    "Sample feedback — the calendar skipped my Sunday slot.",
    "Sample feedback — could the Idea Bank group ideas by pillar?",
    "Sample feedback — I wasn't sure what 'Content Buffer' means.",
    "Sample feedback — Quick Capture on my phone is great.",
    "Sample feedback — analytics didn't save when I pressed Enter.",
    "Sample feedback — an export to CSV would help my VA.",
    "Sample feedback — the Pipeline stages felt like too many at first.",
    "Sample feedback — love the Taglish copy!",
    "Sample feedback — the script editor lost a line after undo.",
    "Sample feedback — reminders at 7am would be nice.",
    "Sample feedback — where do I set my posting schedule?",
    "Sample feedback — the weekly report is exactly what I needed.",
    "Sample feedback — the media kit PDF cut off my rates.",
    "Sample feedback — dark mode charts look sharp.",
  ]
  const pages = ["/calendar", "/ideas", "/", "/ideas", "/analytics", "/money", "/pipeline", "/today", "/studio", "/settings", "/calendar/schedule", "/reports", "/money/media-kit", "/analytics"]
  const senders = users.filter((u) => u.status === "active")
  const feedback: AdminFeedback[] = notes.map((message, i) => ({
    id: `sample-f${i + 1}`,
    kind: kinds[i % kinds.length],
    message,
    page: pages[i],
    ui_language: i % 3 === 0 ? "tl" : "en",
    viewport: i % 2 === 0 ? "mobile" : "desktop",
    created_at: iso(now, (i * 26 + 3) * HOUR),
    user_email: senders[i % senders.length].email,
  }))

  const entries: [AdminAuditAction, string | null, AdminAuditEntry["details"], number][] = [
    ["user_invited", "dana.sample@example.com", {}, 2 * 24],
    ["request_approved", "hana.sample@example.com", {}, 6 * 24],
    ["user_disabled", "eli.sample@example.com", { from: "active", to: "disabled" }, 7 * 24],
    ["password_reset_sent", "ivan.sample@example.com", {}, 8 * 24],
    ["settings_updated", null, { access_open: true }, 9 * 24],
    ["settings_updated", null, { access_open: false }, 10 * 24],
    ["request_rejected", "bot.sample@example.com", {}, 12 * 24],
    ["invite_resent", "faye.sample@example.com", {}, 13 * 24],
    ["request_approved", "kai.sample@example.com", {}, 14 * 24],
    ["request_approved", "jo.sample@example.com", {}, 19 * 24],
    ["user_enabled", "ivan.sample@example.com", { from: "disabled", to: "active" }, 22 * 24],
    ["user_deleted", "old.sample@example.com", {}, 26 * 24],
    ["request_approved", "gio.sample@example.com", {}, 33 * 24],
    ["request_approved", "bea.sample@example.com", {}, 40 * 24],
    ["admin_granted", "mika.sample@example.com", {}, 54 * 24],
    ["profile_photo_removed", "eli.sample@example.com", {}, 27 * 24],
  ]
  const audit: AdminAuditEntry[] = entries.map(([action, target, details, hoursAgo], i) => ({
    id: `sample-a${i + 1}`,
    action,
    admin_email: i % 4 === 3 ? "mika.sample@example.com" : FIXTURE_SELF.email,
    target_email: target,
    details,
    created_at: iso(now, hoursAgo * HOUR),
  }))

  return {
    users,
    requests,
    feedback,
    audit,
    settings: { access_open: true },
    factors: [{ id: "sample-factor-1", name: "Phone (sample)", created_at: iso(now, 59 * DAY), last_used_at: iso(now, 3 * HOUR) }],
    pendingFactor: null,
    nextId: 100,
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function paginate<T>(items: T[], page = 1): Page<T> {
  const current = Math.max(1, Math.floor(page) || 1)
  const start = (current - 1) * FIXTURE_PAGE_SIZE
  return { items: items.slice(start, start + FIXTURE_PAGE_SIZE), page: current, has_more: start + FIXTURE_PAGE_SIZE < items.length }
}

const byNewest = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at)
const clone = <T>(value: T): T => structuredClone(value)

export interface AdminFixture {
  api: AdminApi
  mfa: MfaClient
  self: { id: string; email: string }
}

export interface FixtureOptions {
  now?: () => number
  latencyMs?: number
}

/** A fresh in-memory fixture. Throws in production builds. */
export function createAdminFixture(options: FixtureOptions = {}): AdminFixture {
  if (process.env.NODE_ENV === "production") throw new Error("The admin fixture is development-only.")
  const now = options.now ?? (() => Date.now())
  const latency = options.latencyMs ?? LATENCY_MS
  const state = seed(now())

  const wait = <T>(value: () => T): Promise<T> =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(clone(value()))
        } catch (error) {
          reject(error)
        }
      }, latency)
    })

  const nextId = (prefix: string) => `${prefix}-${state.nextId++}`
  const stamp = () => new Date(now()).toISOString()

  function log(action: AdminAuditAction, target: string | null, details: AdminAuditEntry["details"] = {}) {
    state.audit.unshift({ id: nextId("sample-a"), action, admin_email: FIXTURE_SELF.email, target_email: target, details, created_at: stamp() })
  }

  function findUser(id: string): AdminUserRow {
    const row = state.users.find((u) => u.id === id)
    if (!row) throw new AdminApiError("not_found", 404, "No such user.")
    return row
  }

  function findRequest(id: string): AccessRequest {
    const row = state.requests.find((r) => r.id === id)
    if (!row) throw new AdminApiError("not_found", 404, "No such request.")
    return row
  }

  function guardSelf(row: AdminUserRow) {
    if (row.is_self) throw new AdminApiError("self_action", 409, "You can't do that to your own account.")
  }

  function invite(email: string, name = ""): AdminUserRow {
    const clean = email.trim().toLowerCase()
    if (!EMAIL.test(clean)) throw new AdminApiError("invalid", 400, "Enter a valid email.")
    if (state.users.some((u) => u.email === clean)) throw new AdminApiError("conflict", 409, "That email already has an account.")
    const row = user(now(), nextId("sample-u"), name, clean, { joinedDaysAgo: 0, status: "invited", onboarding_completed: false })
    state.users.push(row)
    return row
  }

  function decide(id: string, status: Exclude<AccessRequestStatus, "pending">): AccessRequest {
    const row = findRequest(id)
    if (row.status !== "pending") throw new AdminApiError("conflict", 409, "That request was already decided.")
    if (status === "approved" && !state.users.some((u) => u.email === row.email)) invite(row.email, row.name)
    row.status = status
    row.decided_at = stamp()
    row.decided_by_email = FIXTURE_SELF.email
    log(status === "approved" ? "request_approved" : "request_rejected", row.email)
    return row
  }

  const api: AdminApi = {
    overview: () =>
      wait((): AdminOverview => {
        const t = now()
        const activeWithin = (days: number) =>
          state.users.filter((u) => u.last_sign_in_at && t - Date.parse(u.last_sign_in_at) <= days * DAY).length
        return {
          users_total: state.users.length,
          active_7d: activeWithin(7),
          active_30d: activeWithin(30),
          onboarding_completed: state.users.filter((u) => u.onboarding_completed).length,
          pending_requests: state.requests.filter((r) => r.status === "pending").length,
          feedback_7d: state.feedback.filter((f) => t - Date.parse(f.created_at) <= 7 * DAY).length,
          funnel: [
            { step: "start", index: 0, viewed: 18, completed: 16 },
            { step: "about", index: 1, viewed: 16, completed: 14 },
            { step: "who", index: 2, viewed: 14, completed: 11 },
            { step: "pick", index: 3, viewed: 11, completed: 9 },
          ],
          access_open: state.settings.access_open,
        }
      }),

    listRequests: (status) =>
      wait(() => {
        const rows = state.requests.filter((r) => !status || r.status === status)
        // Pending first, then newest first.
        return [...rows].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || byNewest(a, b))
      }),
    approveRequest: (id) => wait(() => decide(id, "approved")),
    rejectRequest: (id) => wait(() => decide(id, "rejected")),

    listUsers: (query: AdminUserQuery = {}) =>
      wait(() => {
        const q = query.query?.trim().toLowerCase() ?? ""
        const rows = state.users
          .filter((u) => !query.status || u.status === query.status)
          .filter((u) => !q || u.email.includes(q) || u.name.toLowerCase().includes(q))
          .sort(byNewest)
        return paginate(rows, query.page)
      }),
    inviteUser: (email) =>
      wait(() => {
        const row = invite(email)
        log("user_invited", row.email)
        return row
      }),
    resendInvite: (id) =>
      wait(() => {
        const row = findUser(id)
        if (row.status !== "invited") throw new AdminApiError("conflict", 409, "Only invited people can get the invite again.")
        row.invited_at = stamp()
        log("invite_resent", row.email)
      }),
    disableUser: (id) =>
      wait(() => {
        const row = findUser(id)
        guardSelf(row)
        const from = row.status
        row.status = "disabled"
        log("user_disabled", row.email, { from, to: "disabled" })
        return row
      }),
    enableUser: (id) =>
      wait(() => {
        const row = findUser(id)
        const to = row.last_sign_in_at ? "active" : "invited"
        row.status = to
        log("user_enabled", row.email, { from: "disabled", to })
        return row
      }),
    sendPasswordReset: (id) =>
      wait(() => {
        const row = findUser(id)
        if (row.status === "invited") throw new AdminApiError("conflict", 409, "They haven't set a password yet — resend the invite.")
        log("password_reset_sent", row.email)
      }),
    deleteUser: (id, confirmEmail) =>
      wait(() => {
        const row = findUser(id)
        guardSelf(row)
        if (confirmEmail.trim().toLowerCase() !== row.email) throw new AdminApiError("invalid", 400, "The email doesn't match.")
        if (row.is_admin && state.users.filter((u) => u.is_admin).length <= 1) {
          throw new AdminApiError("last_admin", 409, "The last admin can't be removed.")
        }
        state.users = state.users.filter((u) => u.id !== id)
        log("user_deleted", row.email)
      }),
    grantAdmin: (id) =>
      wait(() => {
        const row = findUser(id)
        if (row.is_admin) throw new AdminApiError("conflict", 409, "Already an admin.")
        row.is_admin = true
        log("admin_granted", row.email)
        return row
      }),
    revokeAdmin: (id) =>
      wait(() => {
        const row = findUser(id)
        guardSelf(row)
        if (!row.is_admin) throw new AdminApiError("conflict", 409, "Not an admin.")
        if (state.users.filter((u) => u.is_admin).length <= 1) throw new AdminApiError("last_admin", 409, "The last admin can't be removed.")
        row.is_admin = false
        log("admin_revoked", row.email)
        return row
      }),

    removeProfilePhoto: (id) =>
      wait(() => {
        const row = findUser(id)
        if (row.photo_url) {
          row.photo_url = null
          log("profile_photo_removed", row.email)
        }
        return row
      }),

    listFeedback: (page) => wait(() => paginate([...state.feedback].sort(byNewest), page)),
    listAudit: (page) => wait(() => paginate([...state.audit].sort(byNewest), page)),

    getSettings: () => wait(() => state.settings),
    updateSettings: (patch) =>
      wait(() => {
        if (typeof patch.access_open === "boolean" && patch.access_open !== state.settings.access_open) {
          state.settings = { ...state.settings, access_open: patch.access_open }
          log("settings_updated", null, { access_open: patch.access_open })
        }
        return state.settings
      }),
  }

  const mfa: MfaClient = {
    listFactors: () => wait(() => state.factors),
    enroll: () =>
      wait(() => {
        state.pendingFactor = nextId("sample-factor")
        return { factorId: state.pendingFactor, qrCode: SAMPLE_QR, secret: "SAMPLESECRETNOTREAL234567" }
      }),
    verify: (factorId, code) =>
      wait(() => {
        // Any 6 digits work except 000000, which shows the wrong-code error.
        if (!/^\d{6}$/.test(code) || code === "000000") throw new MfaError("mfa_verification_failed")
        if (factorId === state.pendingFactor) {
          state.factors.push({ id: factorId, name: `Authenticator (sample ${state.factors.length + 1})`, created_at: stamp(), last_used_at: stamp() })
          state.pendingFactor = null
        } else if (!state.factors.some((f) => f.id === factorId)) {
          throw new MfaError("mfa_factor_not_found")
        }
      }),
    unenroll: (factorId) =>
      wait(() => {
        if (factorId === state.pendingFactor) state.pendingFactor = null
        else state.factors = state.factors.filter((f) => f.id !== factorId)
      }),
  }

  return { api, mfa, self: { ...FIXTURE_SELF } }
}

/** A stand-in "QR code" that says SAMPLE — it doesn't encode anything and can't be scanned. */
const SAMPLE_QR = `data:image/svg+xml;utf-8,${encodeURIComponent(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges">',
    '<rect width="29" height="29" fill="#fff"/>',
    ...[
      [0, 0],
      [22, 0],
      [0, 22],
    ].map(
      ([x, y]) =>
        `<rect x="${x}" y="${y}" width="7" height="7" fill="#111"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#111"/>`
    ),
    '<text x="14.5" y="16" font-size="4" text-anchor="middle" font-family="sans-serif" fill="#111">SAMPLE</text>',
    "</svg>",
  ].join("")
)}`
