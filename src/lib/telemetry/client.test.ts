import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createTelemetry, type SendResult, type TelemetryOptions } from "./client"
import type { UsageEventRow } from "./events"

let enabled = true
let sent: UsageEventRow[][] = []
let results: SendResult[] = []
let clock = new Date("2026-09-14T10:00:00.000Z")

function setup(overrides: Partial<TelemetryOptions> = {}) {
  return createTelemetry({
    send: vi.fn(async (events: UsageEventRow[]) => {
      sent.push(events)
      return results.shift() ?? "ok"
    }),
    isEnabled: () => enabled,
    getPath: () => "/ideas",
    getSessionId: () => "session_1",
    now: () => clock,
    batchSize: 3,
    flushDelayMs: 1000,
    ...overrides,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  enabled = true
  sent = []
  results = []
  clock = new Date("2026-09-14T10:00:00.000Z")
})

afterEach(() => {
  vi.useRealTimers()
})

describe("opt-in", () => {
  it("does nothing when disabled (local mode or not opted in)", async () => {
    enabled = false
    const telemetry = setup()
    expect(telemetry.track("idea_captured", { source: "quick_capture" })).toBe(false)
    expect(telemetry.pending()).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(sent).toEqual([])
  })

  it("drops queued events instead of sending them once the user opts out", async () => {
    const telemetry = setup()
    telemetry.track("idea_captured", { source: "quick_capture" })
    enabled = false
    await telemetry.flush()
    expect(sent).toEqual([])
    expect(telemetry.pending()).toBe(0)
  })

  it("clear() empties the queue and cancels the timer", async () => {
    const telemetry = setup()
    telemetry.track("idea_captured", { source: "quick_capture" })
    telemetry.clear()
    await vi.advanceTimersByTimeAsync(5000)
    expect(sent).toEqual([])
  })
})

describe("batching", () => {
  it("sends a full batch right away", async () => {
    const telemetry = setup()
    telemetry.track("idea_captured", { source: "quick_capture" })
    telemetry.track("content_created", { platform: "tiktok", stage: "brief", from_idea: true })
    expect(sent).toHaveLength(0)
    telemetry.track("metrics_logged", { platform: "tiktok" })
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toHaveLength(1)
    expect(sent[0].map((e) => e.name)).toEqual(["idea_captured", "content_created", "metrics_logged"])
    expect(telemetry.pending()).toBe(0)
  })

  it("sends a partial batch after the delay", async () => {
    const telemetry = setup()
    telemetry.track("idea_captured", { source: "quick_capture" })
    await vi.advanceTimersByTimeAsync(999)
    expect(sent).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(sent).toHaveLength(1)
  })

  it("flush() sends everything in batches (page hide)", async () => {
    const telemetry = setup({ batchSize: 2 })
    enabled = true
    for (let i = 0; i < 5; i++) {
      clock = new Date(clock.getTime() + 10)
      telemetry.track("idea_captured", { source: "quick_capture" })
    }
    await telemetry.flush({ keepalive: true })
    expect(sent.map((batch) => batch.length)).toEqual([2, 2, 1])
    expect(telemetry.pending()).toBe(0)
  })

  it("serialises concurrent flushes without sending an event twice", async () => {
    const telemetry = setup({ batchSize: 10 })
    telemetry.track("idea_captured", { source: "quick_capture" })
    telemetry.track("metrics_logged", { platform: "youtube" })
    await Promise.all([telemetry.flush(), telemetry.flush(), telemetry.flush()])
    expect(sent.flat()).toHaveLength(2)
  })

  it("stamps the event with the path, session and time, and sanitises it", async () => {
    const telemetry = setup()
    telemetry.track("idea_captured", { source: "quick_capture", title: "Secret idea" } as never, { path: "/studio/5f0c2b1e-8a4d-4c3b-9e7f-1a2b3c4d5e6f?x=1" })
    await telemetry.flush()
    expect(sent[0][0]).toEqual({
      name: "idea_captured",
      props: { source: "quick_capture" },
      path: "/studio/[id]",
      session_id: "session_1",
      occurred_at: "2026-09-14T10:00:00.000Z",
    })
  })

  it("keeps only the newest events beyond maxQueue", async () => {
    results = ["retry"]
    const telemetry = setup({ batchSize: 50, maxQueue: 3 })
    for (const platform of ["facebook", "instagram", "tiktok", "youtube", "linkedin"]) telemetry.track("metrics_logged", { platform })
    expect(telemetry.pending()).toBe(3)
    await telemetry.flush()
    expect(sent[0].map((e) => e.props.platform)).toEqual(["tiktok", "youtube", "linkedin"])
  })
})

describe("failures", () => {
  it("keeps events and retries with backoff after a retryable failure", async () => {
    results = ["retry", "ok"]
    const telemetry = setup()
    telemetry.track("idea_captured", { source: "quick_capture" })
    await telemetry.flush()
    expect(sent).toHaveLength(1)
    expect(telemetry.pending()).toBe(1)
    await vi.advanceTimersByTimeAsync(1999)
    expect(sent).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(sent).toHaveLength(2)
    expect(telemetry.pending()).toBe(0)
  })

  it("treats a thrown send (network error) as retryable", async () => {
    const telemetry = setup({
      send: async () => {
        throw new TypeError("Failed to fetch")
      },
    })
    telemetry.track("idea_captured", { source: "quick_capture" })
    await telemetry.flush()
    expect(telemetry.pending()).toBe(1)
  })

  it("drops a batch the server rejects", async () => {
    results = ["drop"]
    const telemetry = setup()
    telemetry.track("idea_captured", { source: "quick_capture" })
    await telemetry.flush()
    expect(telemetry.pending()).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(sent).toHaveLength(1)
  })
})

describe("view dedupe", () => {
  it("counts identical view events close together once", async () => {
    const telemetry = setup({ batchSize: 10 })
    expect(telemetry.track("page_viewed", { module: "ideas" })).toBe(true)
    expect(telemetry.track("page_viewed", { module: "ideas" })).toBe(false)
    clock = new Date(clock.getTime() + 1600)
    expect(telemetry.track("page_viewed", { module: "ideas" })).toBe(true)
    expect(telemetry.track("page_viewed", { module: "today" }, { path: "/today" })).toBe(true)
    expect(telemetry.pending()).toBe(3)
  })

  it("never dedupes actions", () => {
    const telemetry = setup({ batchSize: 10 })
    expect(telemetry.track("idea_captured", { source: "quick_capture" })).toBe(true)
    expect(telemetry.track("idea_captured", { source: "quick_capture" })).toBe(true)
    expect(telemetry.pending()).toBe(2)
  })
})
