import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { contactEmailForPage, parseContactEmail, PREVIEW_CONTACT_EMAIL } from "./contact-email"
import { PrivacyView } from "./privacy-view"
import { TermsView } from "../terms/terms-view"

const params = (query: Record<string, string> = {}) => Promise.resolve(query)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("parseContactEmail", () => {
  it("accepts a plain address, trimmed, with or without mailto:", () => {
    expect(parseContactEmail("team@orbi.example")).toBe("team@orbi.example")
    expect(parseContactEmail("  hello@example.com \n")).toBe("hello@example.com")
    expect(parseContactEmail("mailto:hello@example.com")).toBe("hello@example.com")
  })

  it("treats unset, empty and malformed values as not configured", () => {
    for (const value of [undefined, null, "", "   ", "hello", "hello@", "@example.com", "a b@example.com", "x@example", "<x@example.com>"]) {
      expect(parseContactEmail(value), String(value)).toBeNull()
    }
    expect(parseContactEmail(`${"a".repeat(250)}@example.com`)).toBeNull()
  })
})

describe("CONTACT_EMAIL", () => {
  it("reads NEXT_PUBLIC_CONTACT_EMAIL", async () => {
    vi.resetModules()
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", " team@orbi.example ")
    expect((await import("./contact-email")).CONTACT_EMAIL).toBe("team@orbi.example")
    vi.resetModules()
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "")
    expect((await import("./contact-email")).CONTACT_EMAIL).toBeNull()
  })
})

describe("contactEmailForPage", () => {
  it("uses the configured address", async () => {
    expect(await contactEmailForPage(params(), "team@orbi.example", "production")).toBe("team@orbi.example")
    expect(await contactEmailForPage(params({ preview: "contact" }), "team@orbi.example", "development")).toBe("team@orbi.example")
  })

  it("shows the preview address only in development and only when asked", async () => {
    expect(await contactEmailForPage(params({ preview: "contact" }), null, "development")).toBe(PREVIEW_CONTACT_EMAIL)
    expect(await contactEmailForPage(params(), null, "development")).toBeNull()
    expect(await contactEmailForPage(params({ preview: "other" }), null, "development")).toBeNull()
  })

  it("never reads the query in production", async () => {
    const searchParams = { then: vi.fn() } as unknown as Promise<Record<string, string>>
    expect(await contactEmailForPage(searchParams, null, "production")).toBeNull()
    expect((searchParams as unknown as { then: ReturnType<typeof vi.fn> }).then).not.toHaveBeenCalled()
  })
})

describe("legal pages with and without a contact email", () => {
  const views = [
    ["privacy", PrivacyView],
    ["terms", TermsView],
  ] as const

  for (const [name, View] of views) {
    it(`/${name} shows mailto: links when an address is configured`, () => {
      const html = renderToStaticMarkup(createElement(View, { showRequestAccess: true, contactEmail: "team@orbi.example" }))
      // Contact block, account deletion and access-request removal (people without an account).
      expect(html.match(/href="mailto:team@orbi.example"/g)).toHaveLength(3)
      expect(html).toContain("Email us at <a")
      expect(html).toContain("to have your request removed")
      expect(html).not.toContain("No contact email is set up")
      expect(html).toContain('href="/signup"')
    })

    it(`/${name} says honestly that no contact email is set up, and points to Feedback`, () => {
      const html = renderToStaticMarkup(createElement(View, { showRequestAccess: false, contactEmail: null }))
      expect(html).not.toContain("mailto:")
      expect(html).toContain("No contact email is set up for this site yet")
      expect(html).toContain("Feedback button")
      expect(html).not.toContain('href="/signup"')
    })
  }

  it("links the two pages to each other", () => {
    const privacy = renderToStaticMarkup(createElement(PrivacyView, { showRequestAccess: false, contactEmail: null }))
    const terms = renderToStaticMarkup(createElement(TermsView, { showRequestAccess: false, contactEmail: null }))
    expect(privacy).toContain('href="/terms"')
    expect(terms).toContain('href="/privacy"')
    expect(terms).toContain("Republic of the Philippines")
    expect(terms).toContain("not a prediction of views or virality")
  })
})
