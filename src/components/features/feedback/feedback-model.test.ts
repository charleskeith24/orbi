import { describe, expect, it, vi } from "vitest"
import { translator } from "@/lib/i18n/core"
import { formatFeedbackText, sendFeedback, type FeedbackPayload } from "./feedback-model"
import { m } from "./messages"

const payload: FeedbackPayload = { kind: "bug", message: "Save does nothing", page: "/ideas", ui_language: "tl", viewport: "mobile" }
const respond = (status: number) => vi.fn<typeof fetch>(async () => new Response("{}", { status }))

describe("sendFeedback", () => {
  it("posts the payload as JSON to /api/feedback", async () => {
    const fetchImpl = respond(201)
    expect(await sendFeedback(payload, fetchImpl)).toBe("ok")
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("/api/feedback")
    expect(init?.method).toBe("POST")
    expect(JSON.parse(String(init?.body))).toEqual(payload)
  })

  it("maps failures to what the dialog can say", async () => {
    expect(await sendFeedback(payload, respond(401))).toBe("signed_out")
    expect(await sendFeedback(payload, respond(500))).toBe("error")
    expect(await sendFeedback(payload, respond(400))).toBe("error")
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch")
    })
    expect(await sendFeedback(payload, offline)).toBe("error")
  })
})

describe("formatFeedbackText", () => {
  it("builds the text copied in local mode, in the UI language", () => {
    const input = { kindLabel: "Bug", message: "Save does nothing", page: "/ideas", lang: "tl", viewport: "mobile", date: new Date(2026, 8, 14, 9, 5) }
    expect(formatFeedbackText(input, translator(m, "en"))).toBe(
      ["Orbi feedback — Bug", "Page: /ideas", "Language: tl · Screen: mobile", "Date: 2026-09-14 09:05", "", "Save does nothing"].join("\n")
    )
    expect(formatFeedbackText({ ...input, kindLabel: "Nakakalito" }, translator(m, "tl")).split("\n")[0]).toBe("Orbi feedback — Nakakalito")
  })
})

describe("messages", () => {
  it("has a non-empty Taglish string with the same placeholders for every key", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort()
    for (const [key, en] of Object.entries(m.en)) {
      const tl = m.tl[key as keyof typeof m.tl]
      expect(tl.trim(), key).not.toBe("")
      expect(placeholders(tl), key).toEqual(placeholders(en))
    }
  })
})
