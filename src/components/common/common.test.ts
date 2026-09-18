import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { prettyModelName, ProviderBadge } from "@/components/common/ai"
import { TooltipProvider } from "@/components/ui/tooltip"
import { contentDateInfo } from "@/components/common/content-card"
import {
  funnelGoalMessages,
  ideaStatusDescriptionMessages,
  stageDescriptionMessages,
  tierDescriptionMessages,
} from "@/components/common/messages"
import { Markdown, parseMarkdown } from "@/components/common/markdown"
import { parseNumberInput } from "@/components/common/number-field"
import { toneForScore } from "@/components/common/tone"
import { FUNNEL_STAGES, IDEA_STATUSES, PERFORMANCE_TIERS, PIPELINE_STAGES } from "@/lib/constants"

describe("parseNumberInput", () => {
  it("accepts separators, shorthand and percentages", () => {
    expect(parseNumberInput("12,300")).toBe(12300)
    expect(parseNumberInput(" 12 300 ")).toBe(12300)
    expect(parseNumberInput("12.3k")).toBe(12300)
    expect(parseNumberInput("1.2M")).toBe(1_200_000)
    expect(parseNumberInput("7.5%")).toBe(7.5)
    expect(parseNumberInput("-3")).toBe(-3)
    expect(parseNumberInput(".5")).toBe(0.5)
  })
  it("returns null for empty and undefined for garbage", () => {
    expect(parseNumberInput("")).toBeNull()
    expect(parseNumberInput("   ")).toBeNull()
    expect(parseNumberInput("abc")).toBeUndefined()
    expect(parseNumberInput("12k5")).toBeUndefined()
  })
})

describe("parseMarkdown", () => {
  it("splits headings, paragraphs, lists, quotes, code and rules", () => {
    const blocks = parseMarkdown(
      "## Title\nFirst line\nsecond line\n\n- a\n- b\n  - nested\n\n3. three\n4. four\n\n> quoted\n\n```\ncode\n```\n\n---"
    )
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "quote", "code", "hr"])
    expect(blocks[0]).toEqual({ type: "heading", level: 2, text: "Title" })
    expect(blocks[1]).toEqual({ type: "paragraph", lines: ["First line", "second line"] })
    const bullets = blocks[2]
    expect(bullets.type === "list" && bullets.items[1].children[0].text).toBe("nested")
    const numbered = blocks[3]
    expect(numbered.type === "list" && numbered.ordered && numbered.start).toBe(3)
  })
  it("does not treat bold text at line start as a bullet", () => {
    expect(parseMarkdown("**Bold** start").map((b) => b.type)).toEqual(["paragraph"])
  })
})

describe("Markdown", () => {
  const html = (content: string) => renderToStaticMarkup(createElement(Markdown, { content }))

  it("renders inline formatting and safe links", () => {
    const out = html("Use **bold**, *italic*, `code` and [docs](https://example.com).")
    expect(out).toContain("<strong")
    expect(out).toContain("<em>italic</em>")
    expect(out).toContain("<code")
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('rel="noopener noreferrer"')
  })
  it("never produces script tags or non-http links", () => {
    const out = html('<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror="y">')
    expect(out).not.toContain("<script")
    expect(out).not.toContain("<img")
    expect(out).not.toContain('href="javascript')
    expect(out).toContain("&lt;script&gt;")
  })
})

describe("prettyModelName", () => {
  it("formats Claude model ids", () => {
    expect(prettyModelName("claude-opus-5")).toBe("Opus 5")
    expect(prettyModelName("claude-sonnet-4-5-20250929")).toBe("Sonnet 4.5")
    expect(prettyModelName(undefined)).toBe("")
  })
})

describe("ProviderBadge", () => {
  const html = (provider: "anthropic" | "offline" | "manual", model?: string) =>
    renderToStaticMarkup(createElement(TooltipProvider, null, createElement(ProviderBadge, { provider, model })))

  it("names the engine exactly as the contract says", () => {
    expect(html("anthropic", "claude-opus-5")).toContain("Claude Opus 5")
    expect(html("offline")).toContain("Offline templates")
    expect(html("manual")).toContain("Written manually")
  })
})

describe("toneForScore", () => {
  it("follows the Content Health bands", () => {
    expect(toneForScore(85)).toBe("good")
    expect(toneForScore(60)).toBe("warning")
    expect(toneForScore(45)).toBe("serious")
    expect(toneForScore(10)).toBe("critical")
    expect(toneForScore(null)).toBe("neutral")
  })
})

describe("contentDateInfo", () => {
  const now = new Date(2026, 8, 10, 15, 0)
  const base = { published_at: null, scheduled_at: null, due_date: null, stage: "scripting" as const }

  it("flags unpublished work past its due date", () => {
    const info = contentDateInfo({ ...base, due_date: "2026-09-08" }, now)
    expect(info?.overdue).toBe(true)
    expect(info?.label).toBe("Overdue by 2 days")
  })
  it("describes upcoming due and scheduled dates", () => {
    expect(contentDateInfo({ ...base, due_date: "2026-09-11" }, now)?.label).toBe("Due tomorrow")
    expect(contentDateInfo({ ...base, due_date: "2026-09-10" }, now)?.overdue).toBe(false)
    const scheduled = contentDateInfo({ ...base, scheduled_at: new Date(2026, 8, 11, 18).toISOString() }, now)
    expect(scheduled?.label).toBe("Tomorrow")
    expect(scheduled?.overdue).toBe(false)
  })
  it("prefers the publish date and never marks live items overdue", () => {
    const published = contentDateInfo({ ...base, stage: "published", published_at: new Date(2026, 8, 5).toISOString(), due_date: "2026-09-01" }, now)
    expect(published?.label).toBe("5 days ago")
    expect(published?.overdue).toBe(false)
    expect(contentDateInfo({ ...base, stage: "published", due_date: "2026-09-01" }, now)?.overdue).toBe(false)
  })
  it("returns null without any date", () => {
    expect(contentDateInfo(base, now)).toBeNull()
  })
})

describe("contentDateInfo in Taglish", () => {
  const now = new Date(2026, 8, 10, 15, 0)
  const base = { published_at: null, scheduled_at: null, due_date: null, stage: "scripting" as const }

  it("builds its own relative phrases", () => {
    expect(contentDateInfo({ ...base, due_date: "2026-09-08" }, now, "tl")?.label).toBe("Overdue ng 2 araw")
    expect(contentDateInfo({ ...base, due_date: "2026-09-11" }, now, "tl")?.label).toBe("Due bukas")
    const scheduled = contentDateInfo({ ...base, scheduled_at: new Date(2026, 8, 11, 18).toISOString() }, now, "tl")
    expect(scheduled?.label).toBe("Bukas")
    const published = contentDateInfo({ ...base, stage: "published", published_at: new Date(2026, 8, 5).toISOString() }, now, "tl")
    expect(published?.label).toBe("5 araw ang nakalipas")
  })
})

describe("badge helper text", () => {
  // The English tooltips must stay identical to the option descriptions in constants.
  it("mirrors the descriptions in constants", () => {
    expect(stageDescriptionMessages.en).toEqual(Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, s.description])))
    expect(ideaStatusDescriptionMessages.en).toEqual(Object.fromEntries(IDEA_STATUSES.map((s) => [s.id, s.description])))
    expect(tierDescriptionMessages.en).toEqual(Object.fromEntries(Object.values(PERFORMANCE_TIERS).map((t) => [t.id, t.description])))
    expect(funnelGoalMessages.en).toEqual(Object.fromEntries(Object.values(FUNNEL_STAGES).map((f) => [f.id, f.goal])))
  })
})
