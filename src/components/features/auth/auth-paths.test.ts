import { describe, expect, it } from "vitest"
import {
  decideProxyAction,
  firstParam,
  isAuthPage,
  loginPathFor,
  safeNextPath,
} from "@/components/features/auth/auth-paths"

describe("safeNextPath", () => {
  it("keeps same-origin relative paths with their query", () => {
    expect(safeNextPath("/ideas")).toBe("/ideas")
    expect(safeNextPath("/studio/123?tab=script")).toBe("/studio/123?tab=script")
    expect(safeNextPath("/")).toBe("/")
  })

  it("rejects open redirects and malformed values", () => {
    for (const value of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "evil.com",
      "javascript:alert(1)",
      "/\t/evil.com",
      "/\n/evil.com",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(value)).toBe("/")
    }
  })

  it("never sends a sign-in back to an auth page or handler", () => {
    expect(safeNextPath("/login")).toBe("/")
    expect(safeNextPath("/signup?next=/ideas")).toBe("/")
    expect(safeNextPath("/auth/callback?code=1")).toBe("/")
    expect(safeNextPath("/auth/signout")).toBe("/")
  })

  it("uses the provided fallback", () => {
    expect(safeNextPath("//evil.com", "/today")).toBe("/today")
  })
})

describe("route helpers", () => {
  it("recognises auth pages without matching lookalikes", () => {
    expect(isAuthPage("/login")).toBe(true)
    expect(isAuthPage("/signup")).toBe(true)
    expect(isAuthPage("/login-help")).toBe(false)
  })

  it("builds login paths that remember the destination", () => {
    expect(loginPathFor("/")).toBe("/login")
    expect(loginPathFor("/ideas", "?open=abc")).toBe("/login?next=%2Fideas%3Fopen%3Dabc")
  })

  it("reads the first search param value", () => {
    expect(firstParam(["/a", "/b"])).toBe("/a")
    expect(firstParam("/a")).toBe("/a")
    expect(firstParam(undefined)).toBeUndefined()
  })
})

describe("decideProxyAction", () => {
  it("lets signed-in users through and bounces them off auth pages", () => {
    expect(decideProxyAction("/ideas", "", true)).toEqual({ action: "continue" })
    expect(decideProxyAction("/api/ai", "", true)).toEqual({ action: "continue" })
    expect(decideProxyAction("/login", "", true)).toEqual({ action: "redirect", location: "/" })
    expect(decideProxyAction("/login", "?next=%2Fpipeline", true)).toEqual({ action: "redirect", location: "/pipeline" })
    expect(decideProxyAction("/signup", "?next=//evil.com", true)).toEqual({ action: "redirect", location: "/" })
  })

  it("sends anonymous visitors to sign in, and rejects anonymous API calls", () => {
    expect(decideProxyAction("/", "", false)).toEqual({ action: "redirect", location: "/login" })
    expect(decideProxyAction("/onboarding", "", false)).toEqual({ action: "redirect", location: "/login?next=%2Fonboarding" })
    expect(decideProxyAction("/api/ai", "", false)).toEqual({ action: "unauthorized" })
  })

  it("keeps auth pages and handlers public", () => {
    expect(decideProxyAction("/login", "?next=/ideas", false)).toEqual({ action: "continue" })
    expect(decideProxyAction("/signup", "", false)).toEqual({ action: "continue" })
    expect(decideProxyAction("/auth/callback", "?code=x", false)).toEqual({ action: "continue" })
    expect(decideProxyAction("/auth/signout", "", true)).toEqual({ action: "continue" })
  })
})
