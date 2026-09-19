import { createElement, Fragment } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { fillTemplate } from "@/components/features/auth/legal-links"
import { authMessages } from "@/components/features/auth/messages"
import { RequestAccessForm } from "@/components/features/auth/request-access-form"
import { accessRequestSchema } from "@/lib/admin/access-request"

const render = (nodes: React.ReactNode) => renderToStaticMarkup(createElement(Fragment, null, nodes))

describe("fillTemplate", () => {
  it("puts nodes where the placeholders are and keeps the text around them", () => {
    const html = render(fillTemplate("I agree to the {terms} and the {privacy}", { terms: createElement("b", null, "T"), privacy: createElement("i", null, "P") }))
    expect(html).toBe("I agree to the <b>T</b> and the <i>P</i>")
  })

  it("leaves unknown placeholders visible", () => {
    expect(render(fillTemplate("Email {email} or {other}", { email: "x" }))).toBe("Email x or {other}")
  })
})

describe("request-access consent", () => {
  it("names both the Terms and the Privacy notice in every language", () => {
    for (const lang of ["en", "tl"] as const) {
      expect(authMessages[lang].consent_label).toContain("{terms}")
      expect(authMessages[lang].consent_label).toContain("{privacy}")
    }
  })

  it("links the checkbox label to /terms and /privacy in a new tab", () => {
    const html = renderToStaticMarkup(createElement(RequestAccessForm, { state: "open" }))
    const label = /<label for="request-consent"[^>]*>(.*?)<\/label>/.exec(html)?.[1] ?? ""
    const links = [...label.matchAll(/<a ([^>]*)>([^<]*)<\/a>/g)].map(([, attrs, text]) => ({
      text,
      href: /href="([^"]*)"/.exec(attrs)?.[1],
      newTab: attrs.includes('target="_blank"') && attrs.includes('rel="noopener"'),
    }))
    expect(label.startsWith("I agree to the <a")).toBe(true)
    expect(links).toEqual([
      { text: "Terms", href: "/terms", newTab: true },
      { text: "Privacy notice", href: "/privacy", newTab: true },
    ])
    // Footer: Terms next to Privacy.
    expect(html).toMatch(/href="\/terms"[^>]*>Terms<\/a>.*href="\/privacy"[^>]*>Privacy<\/a>/)
  })

  it("still requires consent to be exactly true", () => {
    const base = { name: "Mika", email: "mika@example.com" }
    expect(accessRequestSchema.safeParse({ ...base, consent: true }).success).toBe(true)
    expect(accessRequestSchema.safeParse({ ...base, consent: false }).success).toBe(false)
    expect(accessRequestSchema.safeParse(base).success).toBe(false)
  })
})
