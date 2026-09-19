import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import { cleanCode, createSupabaseMfaClient, describeMfaError, isSixDigitCode, MfaError } from "./mfa-client"

const factor = (id: string, status: "verified" | "unverified", extra = {}) => ({
  id,
  factor_type: "totp",
  status,
  friendly_name: `name ${id}`,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...extra,
})

function fakeSupabase() {
  const verified = factor("f1", "verified", { last_challenged_at: "2026-09-18T00:00:00Z" })
  const stale = factor("f2", "unverified")
  const mfa = {
    listFactors: vi.fn(async () => ({ data: { all: [verified, stale], totp: [verified], phone: [] }, error: null })),
    unenroll: vi.fn(async ({ factorId }: { factorId: string }) => ({ data: { id: factorId }, error: null })),
    enroll: vi.fn(async () => ({ data: { id: "f3", type: "totp", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "ABC", uri: "otpauth://x" } }, error: null })),
    challengeAndVerify: vi.fn(async ({ code }: { code: string }) =>
      code === "123456" ? { data: {}, error: null } : { data: null, error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered", status: 422 } }
    ),
  }
  const client = { auth: { mfa } } as unknown as SupabaseClient
  return { mfa, get: vi.fn(() => client) }
}

describe("Supabase MFA client", () => {
  it("creates the browser client only when a method runs", async () => {
    const { get } = fakeSupabase()
    const client = createSupabaseMfaClient(get)
    expect(get).not.toHaveBeenCalled()
    expect(await client.listFactors()).toEqual([{ id: "f1", name: "name f1", created_at: "2026-09-01T00:00:00Z", last_used_at: "2026-09-18T00:00:00Z" }])
    expect(get).toHaveBeenCalled()
  })

  it("clears unfinished enrollments before starting a new one", async () => {
    const { mfa, get } = fakeSupabase()
    const enrollment = await createSupabaseMfaClient(get, () => new Date("2026-09-18T09:30:00Z")).enroll()
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f2" })
    expect(mfa.unenroll).not.toHaveBeenCalledWith({ factorId: "f1" })
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Orbi admin 2026-09-18 09:30", issuer: "Orbi" })
    expect(enrollment).toEqual({ factorId: "f3", qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "ABC" })
  })

  it("turns a wrong code into a readable error", async () => {
    const { get } = fakeSupabase()
    const client = createSupabaseMfaClient(get)
    await expect(client.verify("f1", "123456")).resolves.toBeUndefined()
    const error = await client.verify("f1", "999999").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MfaError)
    expect(describeMfaError(error)).toMatch(/^That code didn't work/)
    expect(describeMfaError(error, "tl")).toMatch(/^Hindi gumana ang code/)
    expect(describeMfaError(new Error("boom"))).toBe("Something went wrong. Try again.")
  })

  it("cleans and checks codes", () => {
    expect(cleanCode("123 456 7")).toBe("123456")
    expect(isSixDigitCode("123456")).toBe(true)
    expect(isSixDigitCode("12345")).toBe(false)
  })
})
