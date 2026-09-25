import { describe, expect, it } from "vitest"
import { firstRunDestination, FROM_ADMIN } from "@/components/app-shell/first-run-destination"

describe("firstRunDestination", () => {
  it("sends a creator's first run to Quick setup", () => {
    expect(firstRunDestination({ needsOnboarding: true, isAdmin: false, from: null })).toBe("/onboarding")
  })

  it("sends an admin without a creator workspace to Admin, not Quick setup", () => {
    expect(firstRunDestination({ needsOnboarding: true, isAdmin: true, from: null })).toBe("/admin")
  })

  it("opens Quick setup for an admin who came from Admin's 'Back to my workspace'", () => {
    expect(firstRunDestination({ needsOnboarding: true, isAdmin: true, from: FROM_ADMIN })).toBe("/onboarding")
  })

  it("waits while it's still asking whether the account is an admin", () => {
    expect(firstRunDestination({ needsOnboarding: true, isAdmin: null, from: null })).toBeNull()
  })

  it("leaves a set-up workspace alone, admin or not", () => {
    for (const isAdmin of [true, false, null]) {
      expect(firstRunDestination({ needsOnboarding: false, isAdmin, from: null })).toBeNull()
    }
  })
})
