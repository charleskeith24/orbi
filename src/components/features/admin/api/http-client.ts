/**
 * The admin UI's data client over HTTP — follows the route table in `src/lib/admin/types.ts` exactly.
 * Same-origin, never cached; failures throw `AdminApiError` with the contract's error code.
 * Browsers add the `Origin` header the server checks on every mutation.
 */
import type {
  AccessRequest,
  AccessRequestStatus,
  AdminApi,
  AdminAuditEntry,
  AdminFeedback,
  AdminOverview,
  AdminSettings,
  AdminUserQuery,
  AdminUserRow,
  Page,
} from "@/lib/admin/types"
import { AdminApiError, codeForResponse, toAdminError } from "./errors"

type Method = "GET" | "POST" | "PATCH" | "DELETE"

const BASE = "/api/admin"
const seg = (id: string) => encodeURIComponent(id)

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue
    query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `${path}?${text}` : path
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "")
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function createHttpAdminApi(fetchImpl: typeof fetch = (...args) => fetch(...args)): AdminApi {
  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetchImpl(path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw toAdminError(error)
    }
    const data = await readJson(response)
    if (!response.ok) {
      const message = data && typeof data === "object" ? (data as { message?: unknown }).message : undefined
      throw new AdminApiError(codeForResponse(response.status, data), response.status, typeof message === "string" ? message : undefined)
    }
    return data as T
  }

  return {
    overview: () => request<AdminOverview>("GET", `${BASE}/overview`),
    listRequests: (status?: AccessRequestStatus) => request<AccessRequest[]>("GET", withQuery(`${BASE}/requests`, { status })),
    approveRequest: (id) => request<AccessRequest>("POST", `${BASE}/requests/${seg(id)}/approve`),
    rejectRequest: (id) => request<AccessRequest>("POST", `${BASE}/requests/${seg(id)}/reject`),
    listUsers: (query: AdminUserQuery = {}) =>
      request<Page<AdminUserRow>>(
        "GET",
        withQuery(`${BASE}/users`, { page: query.page, query: query.query?.trim(), status: query.status })
      ),
    inviteUser: (email) => request<AdminUserRow>("POST", `${BASE}/users/invite`, { email }),
    resendInvite: async (id) => {
      await request<{ ok: true }>("POST", `${BASE}/users/${seg(id)}/resend-invite`)
    },
    disableUser: (id) => request<AdminUserRow>("POST", `${BASE}/users/${seg(id)}/disable`),
    enableUser: (id) => request<AdminUserRow>("POST", `${BASE}/users/${seg(id)}/enable`),
    sendPasswordReset: async (id) => {
      await request<{ ok: true }>("POST", `${BASE}/users/${seg(id)}/reset-password`)
    },
    deleteUser: async (id, confirmEmail) => {
      await request<{ ok: true }>("DELETE", `${BASE}/users/${seg(id)}`, { confirm_email: confirmEmail })
    },
    grantAdmin: (id) => request<AdminUserRow>("POST", `${BASE}/users/${seg(id)}/admin`),
    revokeAdmin: (id) => request<AdminUserRow>("DELETE", `${BASE}/users/${seg(id)}/admin`),
    removeProfilePhoto: (id) => request<AdminUserRow>("DELETE", `${BASE}/users/${seg(id)}/photo`),
    listFeedback: (page?: number) => request<Page<AdminFeedback>>("GET", withQuery(`${BASE}/feedback`, { page })),
    listAudit: (page?: number) => request<Page<AdminAuditEntry>>("GET", withQuery(`${BASE}/audit`, { page })),
    getSettings: () => request<AdminSettings>("GET", `${BASE}/settings`),
    updateSettings: (patch: Partial<AdminSettings>) => request<AdminSettings>("PATCH", `${BASE}/settings`, patch),
  }
}
