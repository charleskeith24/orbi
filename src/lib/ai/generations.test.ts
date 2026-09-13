import { describe, expect, it } from "vitest"
import { GENERATION_LIMITS, staleGenerationIds } from "./generations"

const at = (minute: number) => new Date(Date.UTC(2026, 8, 1, 0, minute)).toISOString()
const rows = (task: string, count: number, startMinute = 0) =>
  Array.from({ length: count }, (_, n) => ({ id: `${task}-${String(n).padStart(4, "0")}`, task, created_at: at(startMinute + n) }))

describe("staleGenerationIds", () => {
  it("keeps the newest 200 non-strategist rows and never touches strategist rows below their own limit", () => {
    const strategist = rows("strategist_chat", 10, 0) // the oldest rows in the table
    const other = rows("generate_ideas", 250, 100)
    const stale = staleGenerationIds([...strategist, ...other])
    expect(stale).toHaveLength(50)
    expect(stale.every((id) => id.startsWith("generate_ideas"))).toBe(true)
    // The 50 oldest idea rows go.
    expect(new Set(stale)).toEqual(new Set(other.slice(0, 50).map((r) => r.id)))
  })

  it("heavy use of other tasks can't prune a strategist conversation", () => {
    const strategist = rows("strategist_chat", 5, 0)
    const stale = staleGenerationIds([...strategist, ...rows("generate_script", 600, 10), ...rows("capture_idea", 400, 700)])
    expect(stale).toHaveLength(800)
    expect(stale.some((id) => id.startsWith("strategist_chat"))).toBe(false)
  })

  it("keeps the newest 300 strategist_chat rows", () => {
    const strategist = rows("strategist_chat", 350, 0)
    const stale = staleGenerationIds([...strategist, ...rows("score_content", 150, 1000)])
    expect(stale).toEqual(expect.arrayContaining(strategist.slice(0, 50).map((r) => r.id)))
    expect(stale).toHaveLength(50)
  })

  it("is stable when rows share a timestamp and honours custom limits", () => {
    const same = Array.from({ length: 5 }, (_, n) => ({ id: `r${n}`, task: "generate_hooks", created_at: at(0) }))
    expect(staleGenerationIds(same, { default: 2, strategist_chat: 1 })).toEqual(["r2", "r1", "r0"])
    expect(GENERATION_LIMITS).toEqual({ default: 200, strategist_chat: 300 })
  })
})
