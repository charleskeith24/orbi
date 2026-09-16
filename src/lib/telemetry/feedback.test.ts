import { describe, expect, it } from "vitest"
import { feedbackPage, parseFeedback, viewportFor } from "./feedback"

describe("parseFeedback", () => {
  it("accepts a report, trims the message and fills defaults", () => {
    expect(parseFeedback({ kind: "bug", message: "  Save does nothing  " })).toEqual({
      ok: true,
      value: { kind: "bug", message: "Save does nothing", page: "", ui_language: "en", viewport: "" },
    })
  })

  it("strips the query string and hash from the page", () => {
    const result = parseFeedback({ kind: "confusing", message: "Hmm", page: "/ideas?open=abc#x", ui_language: "tl", viewport: "mobile" })
    expect(result).toEqual({ ok: true, value: { kind: "confusing", message: "Hmm", page: "/ideas", ui_language: "tl", viewport: "mobile" } })
  })

  it("rejects unknown kinds, empty or whitespace-only and over-long messages", () => {
    expect(parseFeedback({ kind: "rant", message: "x" })).toMatchObject({ ok: false, field: "kind" })
    expect(parseFeedback({ kind: "idea", message: "   " })).toMatchObject({ ok: false, field: "message" })
    expect(parseFeedback({ kind: "idea", message: "x".repeat(4001) })).toMatchObject({ ok: false, field: "message" })
    expect(parseFeedback({ kind: "idea", message: "x".repeat(4000) })).toMatchObject({ ok: true })
  })

  it("rejects bad languages and viewports, and non-object bodies", () => {
    expect(parseFeedback({ kind: "idea", message: "x", ui_language: "fr" })).toMatchObject({ ok: false, field: "ui_language" })
    expect(parseFeedback({ kind: "idea", message: "x", viewport: "watch" })).toMatchObject({ ok: false, field: "viewport" })
    expect(parseFeedback(null)).toMatchObject({ ok: false })
    expect(parseFeedback("bug")).toMatchObject({ ok: false })
  })
})

describe("helpers", () => {
  it("buckets viewport widths like the app's breakpoints", () => {
    expect(viewportFor(390)).toBe("mobile")
    expect(viewportFor(767)).toBe("mobile")
    expect(viewportFor(768)).toBe("tablet")
    expect(viewportFor(1023)).toBe("tablet")
    expect(viewportFor(1440)).toBe("desktop")
  })

  it("reduces a location to its path", () => {
    expect(feedbackPage("/studio/abc?tab=script")).toBe("/studio/abc")
    expect(feedbackPage("")).toBe("/")
    expect(feedbackPage(`/${"a".repeat(400)}`)).toHaveLength(300)
  })
})
