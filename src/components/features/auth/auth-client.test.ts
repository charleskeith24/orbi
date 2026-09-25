import { describe, expect, it } from "vitest"
import { describeAuthError, isNoAccountError } from "@/components/features/auth/auth-client"

describe("isNoAccountError", () => {
  it("reads Supabase's answers for an email without an account as 'no account'", () => {
    expect(isNoAccountError({ code: "otp_disabled", message: "Signups not allowed for otp" })).toBe(true)
    expect(isNoAccountError({ code: "signup_disabled", message: "Signups not allowed for this instance" })).toBe(true)
  })

  it("leaves real failures to the error message", () => {
    for (const code of ["over_email_send_rate_limit", "email_address_invalid", "email_provider_disabled", "invalid_credentials"]) {
      expect(isNoAccountError({ code })).toBe(false)
    }
    expect(isNoAccountError({ message: "Failed to fetch" })).toBe(false)
    expect(isNoAccountError(null)).toBe(false)
  })
})

describe("describeAuthError", () => {
  it("never tells a visitor to turn sign-ups on: the waitlist is the only way in", () => {
    for (const lang of ["en", "tl"] as const) {
      for (const code of ["signup_disabled", "otp_disabled"]) {
        const text = describeAuthError({ code }, lang)
        expect(text).not.toMatch(/enable|supabase/i)
        expect(text).toMatch(/request access|mag-request ng access/i)
      }
    }
  })
})
