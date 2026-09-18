import { describe, expect, it } from "vitest"
import { buildAnalyticsSnapshot, buildBrandContext } from "@/lib/ai/context"
import { createDemoDatabase } from "@/lib/data/seed"
import type { AiGeneration } from "@/lib/types"
import { consideredContext, mentions } from "./considered-context"
import { dataPrompts, SUGGESTED_PROMPTS, suggestedPrompts } from "./prompts"
import {
  CONTEXT_KEYS,
  historyMessages,
  HISTORY_TURNS,
  parseTurns,
  settledTurns,
  storedTurnInput,
  withSavedIdeas,
} from "./turns"

const NOW = new Date(2026, 8, 13, 10, 0, 0)

function row(overrides: Partial<AiGeneration>): AiGeneration {
  return {
    id: "g1",
    user_id: "demo-user",
    created_at: "2026-09-13T02:00:00.000Z",
    updated_at: "2026-09-13T02:00:00.000Z",
    task: "strategist_chat",
    provider: "offline",
    model: "offline-templates",
    input: null,
    output: null,
    entity_type: null,
    entity_id: null,
    status: "success",
    error: null,
    duration_ms: 12,
    ...overrides,
  }
}

const output = (reply: string) => ({
  reply,
  suggested_ideas: [
    { title: "Idea A", hook: "Hook A", pillar_id: "p1", platform: "tiktok", format: "Short-form Video" },
    { title: "", hook: "dropped — no title" },
  ],
  follow_up_questions: ["Plan my next week", "  "],
})

describe("parseTurns", () => {
  it("reads rewritten rows oldest first and skips failures and other tasks", () => {
    const turns = parseTurns([
      row({ id: "b", created_at: "2026-09-13T03:00:00.000Z", input: storedTurnInput("Second?", []), output: output("Answer 2") }),
      row({
        id: "a",
        input: { ...storedTurnInput("First?", [{ key: "goal", label: "Goal · Leads", detail: "Target: 40" }]), saved: { "0": "idea-1" } },
        output: output("Answer 1"),
      }),
      row({ id: "err", status: "error", input: storedTurnInput("Broken?", []), output: null }),
      row({ id: "other", task: "generate_ideas", output: output("Not a turn") }),
    ])
    expect(turns.map((t) => t.id)).toEqual(["a", "b"])
    expect(turns[0]).toMatchObject({ question: "First?", reply: "Answer 1", saved: { "0": "idea-1" }, followUps: ["Plan my next week"] })
    expect(turns[0].context).toEqual([{ key: "goal", label: "Goal · Leads", detail: "Target: 40", pillar_id: null, platform: null }])
    expect(turns[0].ideas).toEqual([{ title: "Idea A", hook: "Hook A", pillar_id: "p1", platform: "tiktok", format: "Short-form Video" }])
  })

  it("trusts a raw log row's last message only when the logged history wasn't cut short", () => {
    const intact = row({ input: { messages: [{ role: "user", content: "What should I post?" }], snapshot: {} }, output: output("Post this") })
    const cut = row({
      id: "g2",
      input: { messages: [{ role: "user", content: "Q1" }, { role: "assistant", content: "A1" }], snapshot: {} },
      output: output("Later answer"),
    })
    const [first, second] = parseTurns([intact, cut])
    expect(first.question).toBe("What should I post?")
    expect(second.question).toBe("")
  })
})

describe("settledTurns", () => {
  it("hides rows logged after the question in flight was asked", () => {
    const turns = parseTurns([
      row({ id: "old", output: output("Old") }),
      row({ id: "new", created_at: "2026-09-13T05:00:00.000Z", output: output("New") }),
    ])
    expect(settledTurns(turns, "2026-09-13T04:00:00.000Z").map((t) => t.id)).toEqual(["old"])
    expect(settledTurns(turns, null)).toHaveLength(2)
  })
})

describe("historyMessages", () => {
  it("sends the newest turns as alternating history and ends with the new question", () => {
    const rows = Array.from({ length: HISTORY_TURNS + 3 }, (_, i) =>
      row({
        id: `t${i}`,
        created_at: new Date(Date.UTC(2026, 8, 13, 0, i)).toISOString(),
        input: storedTurnInput(`Question ${i}`, []),
        output: output(`Answer ${i}`),
      })
    )
    const messages = historyMessages(parseTurns(rows), "  Next?  ")
    expect(messages).toHaveLength(HISTORY_TURNS * 2 + 1)
    expect(messages[0]).toEqual({ role: "user", content: "Question 3" })
    expect(messages[1]).toEqual({ role: "assistant", content: "Answer 3" })
    expect(messages[messages.length - 1]).toEqual({ role: "user", content: "Next?" })
  })
})

describe("withSavedIdeas", () => {
  it("records saved ids without dropping the stored turn", () => {
    const input = { ...storedTurnInput("Q?", []), saved: { "0": "a" } }
    expect(withSavedIdeas(input, { "2": "c" })).toEqual({ ...input, saved: { "0": "a", "2": "c" } })
    expect(withSavedIdeas(null, { "1": "b" })).toEqual({ saved: { "1": "b" } })
  })
})

describe("consideredContext", () => {
  const db = createDemoDatabase("demo-user", NOW)
  const context = buildBrandContext(db, NOW)
  const snapshot = buildAnalyticsSnapshot(db, NOW)

  it("covers the spec §57 categories the workspace has data for, in spec order", () => {
    const chips = consideredContext({ context, snapshot, question: "What should I post this week?", reply: "Post a carousel.", ideas: [] })
    const keys = chips.map((chip) => chip.key)
    expect(keys).toEqual(
      expect.arrayContaining(["positioning", "audience", "goal", "platform", "pillar", "performance", "content", "problems", "winners"])
    )
    expect(keys).toEqual([...keys].sort((a, b) => CONTEXT_KEYS.indexOf(a) - CONTEXT_KEYS.indexOf(b)))
    expect(chips.every((chip) => chip.label && chip.detail)).toBe(true)
  })

  it("narrows platform and pillar chips to the ones the question, answer or ideas refer to", () => {
    const pillar = context.pillars[0]
    const chips = consideredContext({
      context,
      snapshot,
      question: `Why is ${pillar.name} underperforming?`,
      reply: "Try the next one on LinkedIn first.",
      ideas: [{ title: "T", hook: "H", pillar_id: null, platform: "tiktok", format: "" }],
    })
    const byKey = Object.fromEntries(chips.map((chip) => [chip.key, chip]))
    expect(byKey.pillar).toMatchObject({ label: pillar.name, pillar_id: pillar.id })
    expect(byKey.platform).toMatchObject({ label: "TikTok +1", platform: "tiktok" })
  })

  it("matches names as whole words only", () => {
    expect(mentions("Why are my educational posts slow?", "Education")).toBe(false)
    expect(mentions("Education is at 0.8× your average", "Education")).toBe(true)
    expect(mentions("Post it on LinkedIn.", "linkedin")).toBe(true)
  })
})

describe("prompts", () => {
  it("offers the seven spec §56 prompts and at most three from the numbers", () => {
    expect(SUGGESTED_PROMPTS).toHaveLength(7)
    const prompts = dataPrompts(buildAnalyticsSnapshot(createDemoDatabase("demo-user", NOW), NOW))
    expect(prompts.length).toBeGreaterThan(0)
    expect(prompts.length).toBeLessThanOrEqual(3)
  })

  it("translates only the chip label — the question sent to the strategist stays English", () => {
    const en = suggestedPrompts("en")
    const tl = suggestedPrompts("tl")
    expect(tl.map((p) => p.text)).toEqual(SUGGESTED_PROMPTS.map((p) => p.text))
    expect(tl.map((p) => p.prefill)).toEqual(en.map((p) => p.prefill))
    expect(en.map((p) => p.label)).toEqual(en.map((p) => p.text))
    expect(tl[0].label).not.toBe(tl[0].text)
    const snapshot = buildAnalyticsSnapshot(createDemoDatabase("demo-user", NOW), NOW)
    expect(dataPrompts(snapshot, "tl").map((p) => p.text)).toEqual(dataPrompts(snapshot).map((p) => p.text))
  })
})
