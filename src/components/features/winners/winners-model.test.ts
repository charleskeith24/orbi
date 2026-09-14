import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import { draftsFromOutput, hookCategoryForAngle, ideaSignature, type ReplicationOutput } from "./replication-model"
import { detectionBasis, formatRatio, formatTimes, minComparisonPosts, thresholdSteps } from "./winners-model"

const settings = buildRow(
  "app_settings",
  { winner_metric: "views", winner_window: 20, winner_min_sample: 3, tier_good: 1.5, tier_winner: 2, tier_breakout: 3 },
  "",
  new Date(0)
)

describe("detection rule", () => {
  it("explains the current settings in plain language", () => {
    expect(detectionBasis(settings)).toBe("Compared with the average views of the last 20 posts on the same platform")
    expect(thresholdSteps(settings).map((s) => s.label)).toEqual(["Good ≥ 1.5×", "Winner ≥ 2×", "Breakout ≥ 3×"])
    expect(detectionBasis({ winner_metric: "composite", winner_window: 10 })).toMatch(/blending views, engagement rate/)
  })

  it("caps the minimum sample at the window size", () => {
    expect(minComparisonPosts({ winner_window: 20, winner_min_sample: 3 })).toBe(3)
    expect(minComparisonPosts({ winner_window: 2, winner_min_sample: 5 })).toBe(2)
  })

  it("formats multiples", () => {
    expect(formatTimes(1.25)).toBe("1.25×")
    expect(formatRatio(2.43)).toBe("2.4×")
    expect(formatRatio(null)).toBe("—")
  })
})

describe("replication drafts", () => {
  const idea = (title: string) => ({ title: ` ${title} `, hook: `${title} hook`, angle: "Story" })
  const output: ReplicationOutput = {
    why_it_worked: "It worked.",
    variations: [1, 2, 3, 4, 5].map((i) => idea(`Variation ${i}`)),
    follow_ups: [1, 2, 3].map((i) => idea(`Follow-up ${i}`)),
    hooks: [1, 2, 3].map((i) => idea(`Hook ${i}`)),
    part_2: idea("Part 2"),
    contrarian_version: idea("Contrarian"),
    advanced_version: idea("Advanced"),
    beginner_version: idea("Beginner"),
    story_version: idea("Story"),
  }

  it("flattens every group into editable drafts with unique keys", () => {
    const drafts = draftsFromOutput(output)
    expect(drafts).toHaveLength(16)
    expect(new Set(drafts.map((d) => d.key)).size).toBe(16)
    expect(drafts[0]).toMatchObject({ group: "variations", title: "Variation 1" })
  })

  it("matches saved ideas by title and hook, and angles to hook styles", () => {
    expect(ideaSignature({ title: " Same  title", hook: "Hook A" })).toBe(ideaSignature({ title: "same title", hook: "hook a" }))
    expect(ideaSignature({ title: "Same", hook: "A" })).not.toBe(ideaSignature({ title: "Same", hook: "B" }))
    expect(hookCategoryForAngle("Contrarian")).toBe("contrarian")
    expect(hookCategoryForAngle("Framework")).toBeNull()
  })
})
