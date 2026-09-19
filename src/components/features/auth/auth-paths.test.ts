import { describe, expect, it } from "vitest"
import {
  decideProxyAction,
  firstParam,
  isAuthPage,
  isPublicPage,
  loginPathFor,
  PUBLIC_PAGES,
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

  it("keeps the privacy notice public, signed in or not", () => {
    expect(decideProxyAction("/privacy", "", false)).toEqual({ action: "continue" })
    expect(decideProxyAction("/privacy", "", true)).toEqual({ action: "continue" })
    expect(decideProxyAction("/privacy-policy", "", false)).toEqual({ action: "redirect", location: "/login?next=%2Fprivacy-policy" })
  })

  it("keeps the terms of use public, signed in or not, without matching lookalikes", () => {
    expect(isPublicPage("/terms")).toBe(true)
    expect(decideProxyAction("/terms", "", false)).toEqual({ action: "continue" })
    expect(decideProxyAction("/terms", "?preview=contact", false)).toEqual({ action: "continue" })
    expect(decideProxyAction("/terms", "", true)).toEqual({ action: "continue" })
    expect(isPublicPage("/terms-of-service")).toBe(false)
    expect(decideProxyAction("/terms-of-service", "", false)).toEqual({ action: "redirect", location: "/login?next=%2Fterms-of-service" })
    expect(decideProxyAction("/api/terms", "", false)).toEqual({ action: "unauthorized" })
  })

  it("lists exactly the legal pages as public", () => {
    expect([...PUBLIC_PAGES].sort()).toEqual(["/privacy", "/terms"])
  })

  it("lets anonymous visitors POST the request-access form, and nothing else under that path", () => {
    expect(decideProxyAction("/api/access-requests", "", false, "POST")).toEqual({ action: "continue" })
    expect(decideProxyAction("/api/access-requests", "", false, "post")).toEqual({ action: "continue" })
    expect(decideProxyAction("/api/access-requests", "", false, "GET")).toEqual({ action: "unauthorized" })
    expect(decideProxyAction("/api/access-requests", "", false)).toEqual({ action: "unauthorized" })
    expect(decideProxyAction("/api/access-requests/123", "", false, "POST")).toEqual({ action: "unauthorized" })
    expect(decideProxyAction("/api/admin/requests", "", false, "GET")).toEqual({ action: "unauthorized" })
    expect(decideProxyAction("/api/admin/requests/1/approve", "", false, "POST")).toEqual({ action: "unauthorized" })
    expect(decideProxyAction("/api/access-requests", "", true, "POST")).toEqual({ action: "continue" })
  })

  it("sends anonymous visitors of the admin area to sign in first", () => {
    expect(decideProxyAction("/admin", "", false)).toEqual({ action: "redirect", location: "/login?next=%2Fadmin" })
    expect(decideProxyAction("/admin/users", "?status=invited", false)).toEqual({
      action: "redirect",
      location: "/login?next=%2Fadmin%2Fusers%3Fstatus%3Dinvited",
    })
  })

  it("keeps auth pages and handlers public", () => {
    expect(decideProxyAction("/login", "?next=/ideas", false)).toEqual({ action: "continue" })
    expect(decideProxyAction("/signup", "", false)).toEqual({ action: "continue" })
    expect(decideProxyAction("/auth/callback", "?code=x", false)).toEqual({ action: "continue" })
    expect(decideProxyAction("/auth/signout", "", true)).toEqual({ action: "continue" })
  })
})
