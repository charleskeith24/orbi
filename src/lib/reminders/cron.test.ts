import { describe, expect, it, vi } from "vitest"
import { runReminderCron, type PushSender, type ReminderStore, type StoredPushSubscription, type UserSchedule } from "./cron"
import type { ReminderItem, ReminderSettings } from "./schedule"

const SETTINGS: ReminderSettings & { ui_language: string } = {
  timezone: "Asia/Manila",
  week_starts_on: 1,
  weekly_post_target: 5,
  reminders_daily_enabled: true,
  reminders_daily_time: "08:00",
  reminders_slot_enabled: true,
  reminders_slot_lead_minutes: 30,
  reminders_review_enabled: false,
  reminders_review_day: 0,
  reminders_review_time: "18:00",
  ui_language: "en",
}

const sub = (patch: Partial<StoredPushSubscription>): StoredPushSubscription => ({
  id: "sub-1",
  user_id: "user-1",
  endpoint: "https://push.example/1",
  p256dh: "key",
  auth: "secret",
  created_at: "2026-09-01T00:00:00.000Z",
  failure_count: 0,
  ...patch,
})

/** An in-memory store that behaves like the database functions (claims are once per key). */
function memoryStore(subscriptions: StoredPushSubscription[], schedules: Record<string, UserSchedule>, items: Record<string, ReminderItem[]> = {}) {
  const claimed = new Map<string, Set<string>>()
  const log: string[] = []
  const store: ReminderStore = {
    listSubscriptions: async () => subscriptions.filter((s) => !log.includes(`remove ${s.id}`)),
    loadSchedules: async (ids) => new Map(ids.filter((id) => schedules[id]).map((id) => [id, schedules[id]])),
    loadItems: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, items[id] ?? []]))),
    claim: async (id, key) => {
      const keys = claimed.get(id) ?? new Set()
      claimed.set(id, keys)
      if (keys.has(key)) return false
      keys.add(key)
      return true
    },
    release: async (id, key) => {
      claimed.get(id)?.delete(key)
      log.push(`release ${id} ${key}`)
    },
    recordSuccess: async (id) => void log.push(`success ${id}`),
    recordFailure: async (id, count, error) => void log.push(`failure ${id} ${count} ${error}`),
    remove: async (id) => void log.push(`remove ${id}`),
  }
  return { store, log, claimed }
}

const okSender = () => vi.fn<PushSender>(async () => ({ ok: true }))

// Wednesday 2026-09-16 08:05 in Manila.
const NOW = new Date("2026-09-16T00:05:00.000Z")

describe("runReminderCron", () => {
  it("sends each due reminder to each of the user's devices, once", async () => {
    const { store } = memoryStore(
      [sub({}), sub({ id: "sub-2", endpoint: "https://push.example/2" })],
      { "user-1": { settings: SETTINGS, slots: [] } },
      { "user-1": [{ id: "i1", title: "Carousel", stage: "scheduled", scheduled_at: "2026-09-16T10:00:00.000Z", due_date: null, published_at: null }] }
    )
    const send = okSender()
    const first = await runReminderCron({ store, send, now: NOW })
    expect(first).toEqual({ subscriptions: 2, users: 1, due: 2, sent: 2, skipped: 0, failed: 0, removed: 0 })
    expect(send).toHaveBeenCalledTimes(2)
    const [target, payload, options] = send.mock.calls[0]
    expect(target).toEqual({ endpoint: "https://push.example/1", keys: { p256dh: "key", auth: "secret" } })
    expect(payload).toEqual({ title: "Today in Orbi", body: "1 post scheduled", url: "/today", tag: "orbi-daily:2026-09-16" })
    expect(options.ttlSeconds).toBe(3 * 3600 - 5 * 60)

    // Running again (or concurrently) sends nothing new.
    const again = await runReminderCron({ store, send, now: new Date(NOW.getTime() + 10 * 60_000) })
    expect(again).toMatchObject({ due: 2, sent: 0, skipped: 2 })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("does nothing without subscriptions, and skips users with nothing due without loading their content", async () => {
    const empty = memoryStore([], {})
    expect(await runReminderCron({ store: empty.store, send: okSender(), now: NOW })).toMatchObject({ subscriptions: 0, sent: 0 })

    const quiet = memoryStore([sub({})], { "user-1": { settings: { ...SETTINGS, reminders_daily_enabled: false }, slots: [] } })
    const send = okSender()
    expect(await runReminderCron({ store: quiet.store, send, now: NOW })).toMatchObject({ users: 1, due: 0, sent: 0 })
    expect(quiet.store.loadItems).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("never sends a backlog to a device that subscribed after the reminder was due", async () => {
    const { store } = memoryStore([sub({ created_at: "2026-09-16T00:01:00.000Z" })], { "user-1": { settings: SETTINGS, slots: [] } })
    expect(await runReminderCron({ store, send: okSender(), now: NOW })).toMatchObject({ due: 0, sent: 0 })
  })

  it("writes in the workspace language", async () => {
    const { store } = memoryStore([sub({})], { "user-1": { settings: { ...SETTINGS, ui_language: "tl" }, slots: [] } })
    const send = okSender()
    await runReminderCron({ store, send, now: NOW })
    expect(send.mock.calls[0][1].title).toBe("Today sa Orbi")
  })

  it("deletes subscriptions the push service reports gone", async () => {
    const { store, log } = memoryStore([sub({})], { "user-1": { settings: SETTINGS, slots: [] } })
    const send = vi.fn<PushSender>(async () => ({ ok: false, gone: true, status: 410, message: "expired" }))
    expect(await runReminderCron({ store, send, now: NOW })).toMatchObject({ sent: 0, failed: 1, removed: 1 })
    expect(log).toEqual(["remove sub-1"])
  })

  it("releases the claim after a temporary failure so the next run retries", async () => {
    const { store, log } = memoryStore([sub({ failure_count: 2 })], { "user-1": { settings: SETTINGS, slots: [] } })
    const failing = vi.fn<PushSender>(async () => ({ ok: false, gone: false, status: 503, message: "try later" }))
    expect(await runReminderCron({ store, send: failing, now: NOW })).toMatchObject({ failed: 1, removed: 0 })
    expect(log).toEqual(["release sub-1 daily:2026-09-16", "failure sub-1 3 503 try later"])

    const send = okSender()
    expect(await runReminderCron({ store, send, now: new Date(NOW.getTime() + 15 * 60_000) })).toMatchObject({ sent: 1 })
    expect(log.at(-1)).toBe("success sub-1")
  })

  it("sends slot heads-ups with a link to the post that's ready", async () => {
    const slot = { id: "slot-1", day_of_week: 3, label: "Tips", platforms: ["tiktok" as const], time: "18:30", is_active: true, sort_order: 0 }
    const { store } = memoryStore(
      [sub({})],
      { "user-1": { settings: { ...SETTINGS, reminders_daily_enabled: false }, slots: [slot] } },
      { "user-1": [{ id: "i9", title: "Budget hack", stage: "ready_to_post", scheduled_at: "2026-09-16T10:30:00.000Z", due_date: null, published_at: null }] }
    )
    const send = okSender()
    await runReminderCron({ store, send, now: new Date("2026-09-16T10:02:00.000Z") })
    expect(send.mock.calls.map(([, payload]) => payload)).toEqual([
      { title: "Posting slot in 30 min", body: "Tips · TikTok\nReady: Budget hack", url: "/studio/i9", tag: "orbi-slot:slot-1:2026-09-16" },
    ])
  })
})
