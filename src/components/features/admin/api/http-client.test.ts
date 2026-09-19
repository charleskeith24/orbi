import { describe, expect, it, vi } from "vitest"
import { AdminApiError, codeForResponse, describeAdminError, toAdminError } from "./errors"
import { createHttpAdminApi } from "./http-client"

interface Call {
  url: string
  init: RequestInit
}

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const impl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init }
    calls.push(call)
    return respond(call)
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("HTTP admin client — routes", () => {
  it("follows the route table (methods, paths, bodies)", async () => {
    const { impl, calls } = fakeFetch(() => json(200, { ok: true }))
    const api = createHttpAdminApi(impl)

    await api.overview()
    await api.listRequests()
    await api.listRequests("pending")
    await api.approveRequest("r/1")
    await api.rejectRequest("r1")
    await api.listUsers({ page: 2, query: "  bea ", status: "invited" })
    await api.listUsers()
    await api.inviteUser("new@example.com")
    await api.resendInvite("u1")
    await api.disableUser("u1")
    await api.enableUser("u1")
    await api.sendPasswordReset("u1")
    await api.deleteUser("u1", "u1@example.com")
    await api.grantAdmin("u1")
    await api.revokeAdmin("u1")
    await api.listFeedback(3)
    await api.listAudit()
    await api.getSettings()
    await api.updateSettings({ access_open: false })

    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      "GET /api/admin/overview",
      "GET /api/admin/requests",
      "GET /api/admin/requests?status=pending",
      "POST /api/admin/requests/r%2F1/approve",
      "POST /api/admin/requests/r1/reject",
      "GET /api/admin/users?page=2&query=bea&status=invited",
      "GET /api/admin/users",
      "POST /api/admin/users/invite",
      "POST /api/admin/users/u1/resend-invite",
      "POST /api/admin/users/u1/disable",
      "POST /api/admin/users/u1/enable",
      "POST /api/admin/users/u1/reset-password",
      "DELETE /api/admin/users/u1",
      "POST /api/admin/users/u1/admin",
      "DELETE /api/admin/users/u1/admin",
      "GET /api/admin/feedback?page=3",
      "GET /api/admin/audit",
      "GET /api/admin/settings",
      "PATCH /api/admin/settings",
    ])
    const body = (i: number) => (calls[i].init.body ? JSON.parse(String(calls[i].init.body)) : undefined)
    expect(body(7)).toEqual({ email: "new@example.com" })
    expect(body(12)).toEqual({ confirm_email: "u1@example.com" })
    expect(body(18)).toEqual({ access_open: false })
    expect(body(0)).toBeUndefined()
    for (const call of calls) {
      expect(call.init.credentials).toBe("same-origin")
      expect(call.init.cache).toBe("no-store")
    }
    expect((calls[7].init.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
  })

  it("returns parsed bodies and void for { ok: true } routes", async () => {
    const row = { id: "u1", email: "a@example.com" }
    const { impl } = fakeFetch((call) => (call.url.endsWith("/disable") ? json(200, row) : json(200, { ok: true })))
    const api = createHttpAdminApi(impl)
    await expect(api.disableUser("u1")).resolves.toEqual(row)
    await expect(api.resendInvite("u1")).resolves.toBeUndefined()
    await expect(api.deleteUser("u1", "a@example.com")).resolves.toBeUndefined()
  })
})

describe("HTTP admin client — errors", () => {
  it.each([
    [409, { error: "self_action", message: "Not yourself." }, "self_action"],
    [409, { error: "last_admin", message: "Last admin." }, "last_admin"],
    [403, { error: "mfa_required", message: "MFA." }, "mfa_required"],
    [403, { error: "bad_origin", message: "Origin." }, "bad_origin"],
    [403, { error: "closed", message: "Closed." }, "closed"],
    [404, { error: "not_found", message: "Nope." }, "not_found"],
    [501, { error: "not_configured", message: "Local." }, "not_configured"],
    [429, { error: "rate_limited", message: "Slow down." }, "rate_limited"],
  ])("maps %i %j to %s", async (status, body, code) => {
    const { impl } = fakeFetch(() => json(status, body))
    const error = await createHttpAdminApi(impl)
      .overview()
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AdminApiError)
    expect(error).toMatchObject({ code, status, message: body.message })
  })

  it("falls back to the status when the body isn't a contract error", async () => {
    const statuses: [number, string][] = [
      [400, "invalid"],
      [401, "unauthorized"],
      [404, "not_found"],
      [409, "conflict"],
      [429, "rate_limited"],
      [500, "server_error"],
      [502, "server_error"],
      [501, "not_configured"],
      [418, "unknown"],
    ]
    for (const [status, code] of statuses) {
      const { impl } = fakeFetch(() => new Response("<html>oops</html>", { status }))
      await expect(createHttpAdminApi(impl).getSettings()).rejects.toMatchObject({ code, status })
    }
    expect(codeForResponse(403, { error: "made_up" })).toBe("unknown")
  })

  it("turns a failed fetch into a network error", async () => {
    const impl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    }) as unknown as typeof fetch
    await expect(createHttpAdminApi(impl).listAudit(1)).rejects.toMatchObject({ code: "network", status: 0 })
  })

  it("describes every code in English and Taglish", () => {
    expect(describeAdminError(new AdminApiError("last_admin", 409))).toBe("You're the last admin. Make someone else an admin first.")
    expect(describeAdminError(new AdminApiError("self_action", 409), "tl")).toBe("Hindi mo 'yan puwedeng gawin sa sarili mong account.")
    expect(describeAdminError(new TypeError("Failed to fetch"))).toBe("Couldn't reach the server. Check your connection.")
    expect(describeAdminError("weird")).toBe("Something went wrong. Try again.")
    expect(toAdminError(new AdminApiError("closed", 403)).code).toBe("closed")
  })
})
