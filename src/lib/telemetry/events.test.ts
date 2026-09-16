import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  EVENT_PROPS,
  isUsageEventName,
  moduleForPath,
  normalizePath,
  parseUsageEvent,
  sanitizeProps,
  USAGE_EVENT_NAMES,
} from "./events"

const NOW = new Date("2026-09-14T10:00:00.000Z")
const UUID = "5f0c2b1e-8a4d-4c3b-9e7f-1a2b3c4d5e6f"

describe("sanitizeProps", () => {
  it("keeps whitelisted enum tokens, small integers and booleans", () => {
    expect(sanitizeProps("content_created", { platform: "tiktok", stage: "brief", from_idea: true })).toEqual({
      platform: "tiktok",
      stage: "brief",
      from_idea: true,
    })
    expect(sanitizeProps("onboarding_completed", { mode: "first", lang: "taglish", pillars: 4, ideas: 12 })).toEqual({
      mode: "first",
      lang: "taglish",
      pillars: 4,
      ideas: 12,
    })
  })

  it("drops keys that are not whitelisted for the event", () => {
    expect(sanitizeProps("page_viewed", { module: "ideas", title: "my_secret_idea", step: "hilig" })).toEqual({ module: "ideas" })
  })

  it("never lets free text through", () => {
    const props = sanitizeProps("idea_captured", { source: "How I paid off 200k in debt" })
    expect(props).toEqual({})
    expect(sanitizeProps("content_created", { platform: "TikTok", stage: "a".repeat(41), from_idea: "yes" })).toEqual({})
    expect(sanitizeProps("page_viewed", { module: "juan@example.com" })).toEqual({})
  })

  it("drops negative, fractional, huge and non-finite numbers and nested values", () => {
    expect(sanitizeProps("onboarding_completed", { pillars: -1, ideas: 1.5 })).toEqual({})
    expect(sanitizeProps("onboarding_completed", { pillars: 1_000_000, ideas: Number.NaN })).toEqual({})
    expect(sanitizeProps("content_created", { platform: { name: "x" }, stage: ["brief"] })).toEqual({})
  })

  it("accepts only plain objects", () => {
    expect(sanitizeProps("page_viewed", null)).toEqual({})
    expect(sanitizeProps("page_viewed", ["ideas"])).toEqual({})
    expect(sanitizeProps("page_viewed", "ideas")).toEqual({})
  })

  it("has a whitelist for every event", () => {
    for (const name of USAGE_EVENT_NAMES) expect(EVENT_PROPS[name].length).toBeGreaterThan(0)
  })
})

describe("normalizePath", () => {
  it("replaces ids and strips query strings and hashes", () => {
    expect(normalizePath(`/studio/${UUID}?open=abc#top`)).toBe("/studio/[id]")
    expect(normalizePath(`/campaigns/${UUID}`)).toBe("/campaigns/[id]")
    expect(normalizePath("/ideas?open=123&q=secret")).toBe("/ideas")
  })

  it("keeps page names and the root", () => {
    expect(normalizePath("/")).toBe("/")
    expect(normalizePath("")).toBe("/")
    expect(normalizePath("/money/media-kit")).toBe("/money/media-kit")
    expect(normalizePath("/ideas/hooks/")).toBe("/ideas/hooks")
  })

  it("treats long or digit-bearing tokens and odd characters as ids", () => {
    expect(normalizePath("/share/abc12345")).toBe("/share/[id]")
    expect(normalizePath(`/x/${"a".repeat(41)}`)).toBe("/x/[id]")
    expect(normalizePath("/%F0%9F%98%80")).toBe("/[id]")
  })

  it("caps the length", () => {
    expect(normalizePath(`/${"ab/".repeat(200)}`).length).toBeLessThanOrEqual(200)
  })
})

describe("moduleForPath", () => {
  it("maps paths to their top-level module", () => {
    expect(moduleForPath("/")).toBe("home")
    expect(moduleForPath("/ideas/hooks")).toBe("ideas")
    expect(moduleForPath("/money/media-kit")).toBe("money")
    expect(moduleForPath(`/studio/${UUID}`)).toBe("studio")
    expect(moduleForPath("/audience/problems?open=1")).toBe("audience")
  })
})

describe("parseUsageEvent", () => {
  it("accepts a valid event and sanitises it", () => {
    expect(
      parseUsageEvent(
        { name: "page_viewed", props: { module: "ideas", note: "private" }, path: `/studio/${UUID}?q=x`, session_id: "abc_123", occurred_at: "2026-09-14T09:59:00.000Z" },
        NOW
      )
    ).toEqual({ name: "page_viewed", props: { module: "ideas" }, path: "/studio/[id]", session_id: "abc_123", occurred_at: "2026-09-14T09:59:00.000Z" })
  })

  it("drops unknown names and non-objects", () => {
    expect(parseUsageEvent({ name: "typed_text", props: {} }, NOW)).toBeNull()
    expect(parseUsageEvent("page_viewed", NOW)).toBeNull()
    expect(parseUsageEvent(null, NOW)).toBeNull()
    expect(parseUsageEvent([{ name: "page_viewed" }], NOW)).toBeNull()
  })

  it("clamps timestamps outside the last 7 days (or in the future) to now", () => {
    const old = parseUsageEvent({ name: "page_viewed", occurred_at: "2026-08-01T00:00:00.000Z" }, NOW)
    const future = parseUsageEvent({ name: "page_viewed", occurred_at: "2026-09-15T00:00:00.000Z" }, NOW)
    const garbage = parseUsageEvent({ name: "page_viewed", occurred_at: "yesterday" }, NOW)
    for (const event of [old, future, garbage]) expect(event?.occurred_at).toBe(NOW.toISOString())
  })

  it("blanks invalid session ids and non-string paths", () => {
    const event = parseUsageEvent({ name: "metrics_logged", session_id: "has spaces!", path: 42 }, NOW)
    expect(event).toMatchObject({ session_id: "", path: "" })
  })

  it("recognises event names", () => {
    expect(isUsageEventName("post_published")).toBe(true)
    expect(isUsageEventName("POST_PUBLISHED")).toBe(false)
    expect(isUsageEventName(1)).toBe(false)
  })
})

describe("migration parity", () => {
  it("usage_events.name CHECK lists exactly USAGE_EVENT_NAMES", () => {
    const sql = readFileSync(new URL("../../../supabase/migrations/20260914000100_beta.sql", import.meta.url), "utf8")
    const check = /name text not null check \(\s*name in \(([^)]*)\)/.exec(sql)
    expect(check).not.toBeNull()
    const names = [...(check?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
    expect(names).toEqual([...USAGE_EVENT_NAMES])
  })
})
