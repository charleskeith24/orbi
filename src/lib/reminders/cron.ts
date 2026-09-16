/**
 * The push reminder job, independent of Supabase and web-push (both injected), run by
 * GET /api/cron/reminders:
 *
 * 1. every push subscription, grouped by user;
 * 2. each user's reminder settings and active Posting Schedule slots → reminders due now
 *    (`dueReminders`: already due, not stale, not from before the device subscribed);
 * 3. only for users with something due: their open and recently published content, for the text;
 * 4. per device and reminder: claim (atomic, once) → send → record. A temporary failure releases the
 *    claim so the next run retries; a subscription the push service reports gone is deleted.
 *
 * Safe to run every few minutes or several times at once: claims make each delivery happen once.
 */
import { uiLangOf, type UiLang } from "@/lib/i18n/core"
import { describeReminder, dueReminders, type ReminderItem, type ReminderSettings, type ReminderSlot } from "./schedule"

export interface StoredPushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
  failure_count: number
}

export type UserSchedule = { settings: ReminderSettings & { ui_language?: string | null }; slots: ReminderSlot[] }

export interface ReminderStore {
  listSubscriptions(): Promise<StoredPushSubscription[]>
  /** Settings row and active slots per user (users without a settings row are left out). */
  loadSchedules(userIds: string[]): Promise<Map<string, UserSchedule>>
  /** Unpublished items plus items published since `publishedSince`, per user. */
  loadItems(userIds: string[], publishedSince: Date): Promise<Map<string, ReminderItem[]>>
  claim(subscriptionId: string, key: string): Promise<boolean>
  release(subscriptionId: string, key: string): Promise<void>
  recordSuccess(subscriptionId: string, at: Date): Promise<void>
  recordFailure(subscriptionId: string, failureCount: number, error: string): Promise<void>
  remove(subscriptionId: string): Promise<void>
}

/** What the service worker receives (public/sw.js `push` handler). */
export interface PushPayload {
  title: string
  body: string
  /** Same-origin path to open on click. */
  url: string
  tag: string
}

export type PushSendResult = { ok: true } | { ok: false; gone: boolean; status: number | null; message: string }

export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
  options: { ttlSeconds: number }
) => Promise<PushSendResult>

export interface ReminderCronSummary {
  subscriptions: number
  users: number
  due: number
  sent: number
  skipped: number
  failed: number
  removed: number
}

/** The review counts posts published this week — look back a little over a week. */
const PUBLISHED_LOOKBACK_MS = 8 * 24 * 3600_000

export function toPushTarget(row: StoredPushSubscription) {
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }
}

export async function runReminderCron({ store, send, now }: { store: ReminderStore; send: PushSender; now: Date }): Promise<ReminderCronSummary> {
  const summary: ReminderCronSummary = { subscriptions: 0, users: 0, due: 0, sent: 0, skipped: 0, failed: 0, removed: 0 }
  const subscriptions = await store.listSubscriptions()
  summary.subscriptions = subscriptions.length
  if (!subscriptions.length) return summary

  const byUser = new Map<string, StoredPushSubscription[]>()
  for (const row of subscriptions) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row])
  summary.users = byUser.size

  const schedules = await store.loadSchedules([...byUser.keys()])
  const plans = new Map<string, { schedule: UserSchedule; perDevice: Map<string, ReturnType<typeof dueReminders>> }>()
  for (const [userId, rows] of byUser) {
    const schedule = schedules.get(userId)
    if (!schedule) continue
    const perDevice = new Map<string, ReturnType<typeof dueReminders>>()
    for (const row of rows) {
      const created = new Date(row.created_at)
      const due = dueReminders({ settings: schedule.settings, slots: schedule.slots, now, notBefore: Number.isNaN(created.getTime()) ? null : created })
      if (due.length) perDevice.set(row.id, due)
    }
    if (perDevice.size) plans.set(userId, { schedule, perDevice })
  }
  if (!plans.size) return summary

  const items = await store.loadItems([...plans.keys()], new Date(now.getTime() - PUBLISHED_LOOKBACK_MS))
  for (const [userId, { schedule, perDevice }] of plans) {
    const lang: UiLang = uiLangOf(schedule.settings as { ui_language?: string })
    const content = { settings: schedule.settings, slots: schedule.slots, items: items.get(userId) ?? [], lang }
    for (const row of byUser.get(userId) ?? []) {
      const due = perDevice.get(row.id) ?? []
      let failures = row.failure_count
      for (const reminder of due) {
        summary.due++
        if (!(await store.claim(row.id, reminder.key))) {
          summary.skipped++
          continue
        }
        const payload = describeReminder(reminder, content)
        const ttlSeconds = Math.max(60, Math.floor((reminder.expiresAt.getTime() - now.getTime()) / 1000))
        const result = await send(toPushTarget(row), payload, { ttlSeconds })
        if (result.ok) {
          summary.sent++
          failures = 0
          await store.recordSuccess(row.id, now)
          continue
        }
        summary.failed++
        if (result.gone) {
          summary.removed++
          await store.remove(row.id)
          break
        }
        failures++
        await store.release(row.id, reminder.key)
        await store.recordFailure(row.id, failures, `${result.status ?? "error"} ${result.message}`.trim().slice(0, 300))
      }
    }
  }
  return summary
}
