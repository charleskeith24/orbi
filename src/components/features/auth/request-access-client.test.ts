import { describe, expect, it, vi } from "vitest"
import { normalizeLink, submitAccessRequest } from "./request-access-client"

const input = { name: "Ana", email: "ana@example.com", about: "", link: "", consent: true as const, website: "" }

const respond = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status })) as unknown as typeof fetch

describe("submitAccessRequest", () => {
  it("posts the form as JSON to the public endpoint", async () => {
    const fetchImpl = respond(201, { ok: true })
    await expect(submitAccessRequest(input, fetchImpl)).resolves.toEqual({ status: "ok" })
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe("/api/access-requests")
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" })
    expect(JSON.parse(init.body)).toEqual(input)
  })

  it("reads closed, rate limits and field errors", async () => {
    await expect(submitAccessRequest(input, respond(403, { error: "closed", message: "Closed" }))).resolves.toEqual({ status: "closed" })
    await expect(submitAccessRequest(input, respond(429, { error: "rate_limited" }))).resolves.toEqual({ status: "rate_limited" })
    await expect(submitAccessRequest(input, respond(400, { error: "invalid", fields: { link: "link_invalid" } }))).resolves.toEqual({
      status: "invalid",
      fields: { link: "link_invalid" },
    })
    await expect(submitAccessRequest(input, respond(500, { error: "server_error" }))).resolves.toEqual({ status: "error" })
    await expect(submitAccessRequest(input, respond(403, { error: "bad_origin" }))).resolves.toEqual({ status: "error" })
  })

  it("never throws on a network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    }) as unknown as typeof fetch
    await expect(submitAccessRequest(input, fetchImpl)).resolves.toEqual({ status: "offline" })
  })
})

describe("normalizeLink", () => {
  it("adds https:// to bare domains only", () => {
    expect(normalizeLink("instagram.com/ana")).toBe("https://instagram.com/ana")
    expect(normalizeLink(" www.tiktok.com/@ana ")).toBe("https://www.tiktok.com/@ana")
    expect(normalizeLink("https://example.com")).toBe("https://example.com")
    expect(normalizeLink("http://example.com")).toBe("http://example.com")
    expect(normalizeLink("@ana on tiktok")).toBe("@ana on tiktok")
    expect(normalizeLink("")).toBe("")
  })
})
