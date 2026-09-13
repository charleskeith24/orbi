import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import type { Story } from "@/lib/types"
import { diffWords, type DiffPart } from "./script-diff"
import {
  alignSections,
  captionWithHashtags,
  countWords,
  defaultScriptFormat,
  defaultTabForStage,
  keywordsOf,
  normalizeHashtag,
  parseTab,
  quickStartPlatform,
  relatedStories,
  spokenLabel,
  spokenSeconds,
  starterSections,
  wordsIn,
} from "./studio-utils"

const NOW = new Date("2026-09-13T08:00:00Z")

describe("workspace tabs", () => {
  it("accepts known tabs only", () => {
    expect(parseTab("script")).toBe("script")
    expect(parseTab("performance")).toBe("performance")
    expect(parseTab("nope")).toBeNull()
    expect(parseTab(null)).toBeNull()
  })

  it("opens where the work is", () => {
    expect(defaultTabForStage("idea")).toBe("brief")
    expect(defaultTabForStage("brief")).toBe("brief")
    expect(defaultTabForStage("scripting")).toBe("script")
    expect(defaultTabForStage("scheduled")).toBe("script")
    expect(defaultTabForStage("published")).toBe("performance")
    expect(defaultTabForStage("repurpose")).toBe("performance")
  })
})

describe("script text", () => {
  it("counts words, not punctuation", () => {
    expect(countWords("Posting more won't fix it — posting with a system will.")).toBe(10)
    expect(countWords("   ")).toBe(0)
    expect(wordsIn([{ key: "hook", label: "Hook", content: "One two" }, { key: "cta", label: "CTA", content: "three" }])).toBe(3)
  })

  it("estimates spoken time at ~150 words per minute", () => {
    expect(spokenSeconds(150)).toBe(60)
    expect(spokenSeconds(75)).toBe(30)
    expect(spokenLabel(150)).toBe("≈ 1:00")
  })

  it("maps saved sections onto the format and keeps unknown ones at the end", () => {
    const aligned = alignSections("short_video", [
      { key: "cta", label: "CTA", content: "Follow for part 2" },
      { key: "extra", label: "Extra", content: "Bonus" },
    ])
    expect(aligned.map((s) => s.key)).toEqual(["hook", "context", "value", "example", "takeaway", "cta", "extra"])
    expect(aligned[5].content).toBe("Follow for part 2")
    expect(aligned[0].content).toBe("")
  })

  it("starts a blank script with the item's hook and the brief's CTA", () => {
    const carousel = starterSections("carousel", { hook: "Stop fixing your ads." }, { cta: "Save this for your next launch." })
    expect(carousel[0]).toMatchObject({ key: "slide_1", content: "Stop fixing your ads." })
    expect(carousel[6]).toMatchObject({ key: "slide_7", content: "Save this for your next launch." })
    expect(carousel.slice(1, 6).every((s) => s.content === "")).toBe(true)
  })

  it("normalises hashtags and appends them to the caption", () => {
    expect(normalizeHashtag(" growth hacks ")).toBe("#growthhacks")
    expect(normalizeHashtag("##ads")).toBe("#ads")
    expect(normalizeHashtag("#")).toBe("")
    expect(captionWithHashtags("Offer first.", ["ads", "#growth", ""])).toBe("Offer first.\n\n#ads #growth")
    expect(captionWithHashtags("", [])).toBe("")
  })
})

describe("defaultScriptFormat", () => {
  const formats = [buildRow("content_formats", { name: "Carousel", script_format: "carousel" }, "u", NOW)]

  it("prefers the latest current script", () => {
    const item = buildRow("content_items", { platform: "linkedin", format_id: formats[0].id }, "u", NOW)
    const scripts = [
      { ...buildRow("content_scripts", { content_item_id: item.id, format: "x_thread", is_current: true }, "u", NOW), updated_at: "2026-09-01T00:00:00.000Z" },
      { ...buildRow("content_scripts", { content_item_id: item.id, format: "newsletter", is_current: true }, "u", NOW), updated_at: "2026-09-05T00:00:00.000Z" },
    ]
    expect(defaultScriptFormat({ content_scripts: scripts, content_formats: formats }, item)).toBe("newsletter")
  })

  it("falls back to the item's format, then the platform's usual structure", () => {
    const withFormat = buildRow("content_items", { platform: "linkedin", format_id: formats[0].id }, "u", NOW)
    const bare = buildRow("content_items", { platform: "linkedin" }, "u", NOW)
    expect(defaultScriptFormat({ content_scripts: [], content_formats: formats }, withFormat)).toBe("carousel")
    expect(defaultScriptFormat({ content_scripts: [], content_formats: formats }, bare)).toBe("linkedin_post")
  })
})

describe("quickStartPlatform", () => {
  it("lands short video on TikTok / Reels first", () => {
    expect(quickStartPlatform("short_video", ["facebook", "tiktok", "instagram"])).toBe("tiktok")
    expect(quickStartPlatform("short_video", ["facebook"])).toBe("facebook")
    expect(quickStartPlatform("short_video", [])).toBe("tiktok")
  })

  it("keeps platform-native formats on their platform", () => {
    expect(quickStartPlatform("linkedin_post", ["facebook"])).toBe("linkedin")
    expect(quickStartPlatform("facebook_post", ["tiktok"])).toBe("facebook")
    expect(quickStartPlatform("carousel", ["facebook", "instagram"])).toBe("instagram")
  })
})

describe("relatedStories", () => {
  const story = (values: Partial<Story>) => buildRow("stories", values, "u", NOW)
  const stories = [
    story({ title: "The offer rewrite that tripled conversion", keywords: ["offer", "pricing"], lesson: "Fix what you sell before how you sell it." }),
    story({ title: "A year of lessons", lesson: "Time matters more than you think." }),
    story({ title: "Hiring our first editor", keywords: ["hiring", "team"], lesson: "Hire for taste." }),
    story({ title: "Ads that never scaled", lesson: "Creative testing without an offer is guessing." }),
  ]

  it("ranks stories by shared, rare keywords (tagged keywords count double)", () => {
    const item = buildRow("content_items", { title: "Fix your offer before you touch ads" }, "u", NOW)
    const related = relatedStories(stories, item, null)
    expect(related[0].story.title).toBe("The offer rewrite that tripled conversion")
    expect(related[0].matches).toContain("offer")
    expect(related.some((r) => r.story.title === "A year of lessons")).toBe(false)
    expect(related.some((r) => r.story.title === "Hiring our first editor")).toBe(false)
  })

  it("ignores filler words", () => {
    const item = buildRow("content_items", { title: "What a year it has been" }, "u", NOW)
    expect(relatedStories(stories, item, null)).toEqual([])
    expect([...keywordsOf("The ads were never the problem")]).toEqual(["ads", "problem"])
  })
})

describe("diffWords", () => {
  const side = (parts: DiffPart[], drop: DiffPart["type"]) =>
    parts
      .filter((p) => p.type !== drop)
      .map((p) => p.text)
      .join("")

  it("reconstructs both versions from the parts", () => {
    const before = "We ended our contract with our largest client."
    const after = "I fired our biggest client. Revenue dropped 22%."
    const parts = diffWords(before, after)
    expect(side(parts, "add")).toBe(before)
    expect(side(parts, "del")).toBe(after)
    expect(parts.some((p) => p.type === "same" && p.text.includes("our"))).toBe(true)
  })

  it("returns one unchanged part for identical text", () => {
    expect(diffWords("Same text", "Same text")).toEqual([{ type: "same", text: "Same text" }])
  })

  it("falls back to lines for very long texts and still reconstructs them", () => {
    const before = Array.from({ length: 700 }, (_, i) => `word${i}`).join(" ")
    const after = `${before}\nOne more line.`
    const parts = diffWords(before, after)
    expect(side(parts, "add")).toBe(before)
    expect(side(parts, "del")).toBe(after)
  })
})
