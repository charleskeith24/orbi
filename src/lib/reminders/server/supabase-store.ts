/**
 * The cron job's data access with the service-role key (bypasses row-level security, so every query
 * filters by user explicitly). Server only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { PUBLISHED_STAGES } from "@/lib/constants"
import { SUPABASE_URL } from "@/lib/supabase/config"
import type { ReminderStore, StoredPushSubscription, UserSchedule } from "../cron"
import type { ReminderItem, ReminderSlot } from "../schedule"

const PAGE = 1000
const USER_CHUNK = 100

/**
 * The columns the job reads. The service_role grants in supabase/migrations/20260925000000_server_grants.sql are
 * exactly these; server-grants.pglite.test.ts runs them, so a new column here fails the test until it's granted.
 */
export const SETTINGS_COLUMNS = [
  "user_id",
  "timezone",
  "week_starts_on",
  "weekly_post_target",
  "ui_language",
  "reminders_daily_enabled",
  "reminders_daily_time",
  "reminders_slot_enabled",
  "reminders_slot_lead_minutes",
  "reminders_review_enabled",
  "reminders_review_day",
  "reminders_review_time",
].join(", ")
export const SUBSCRIPTION_COLUMNS = "id, user_id, endpoint, p256dh, auth, created_at, failure_count"
export const CALENDAR_COLUMNS = "id, user_id, day_of_week, label, platforms, time, is_active, sort_order"
export const ITEM_COLUMNS = "id, user_id, title, stage, scheduled_at, due_date, published_at"

export function createServiceClient(secretKey: string, url = SUPABASE_URL): SupabaseClient {
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`[reminders] ${what}: ${error?.message ?? "unknown error"}`)
}

export function createSupabaseReminderStore(supabase: SupabaseClient): ReminderStore {
  return {
    async listSubscriptions() {
      const rows: StoredPushSubscription[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("push_subscriptions")
          .select(SUBSCRIPTION_COLUMNS)
          .order("id")
          .range(from, from + PAGE - 1)
        if (error) fail("list subscriptions", error)
        rows.push(...((data ?? []) as StoredPushSubscription[]))
        if (!data || data.length < PAGE) return rows
      }
    },

    async loadSchedules(userIds) {
      const out = new Map<string, UserSchedule>()
      for (const ids of chunks(userIds, USER_CHUNK)) {
        const [settings, slots] = await Promise.all([
          supabase.from("app_settings").select(SETTINGS_COLUMNS).in("user_id", ids),
          supabase
            .from("content_calendar")
            .select(CALENDAR_COLUMNS)
            .in("user_id", ids)
            .eq("is_active", true),
        ])
        if (settings.error) fail("load settings", settings.error)
        if (slots.error) fail("load posting schedule", slots.error)
        const slotRows = (slots.data ?? []) as unknown as (ReminderSlot & { user_id: string })[]
        for (const row of (settings.data ?? []) as unknown as (UserSchedule["settings"] & { user_id: string })[]) {
          if (out.has(row.user_id)) continue
          out.set(row.user_id, { settings: row, slots: slotRows.filter((slot) => slot.user_id === row.user_id) })
        }
      }
      return out
    },

    async loadItems(userIds, publishedSince) {
      const out = new Map<string, ReminderItem[]>()
      const published = `(${PUBLISHED_STAGES.join(",")})`
      for (const ids of chunks(userIds, USER_CHUNK)) {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("content_items")
            .select(ITEM_COLUMNS)
            .in("user_id", ids)
            .or(`stage.not.in.${published},published_at.gte.${publishedSince.toISOString()}`)
            .order("id")
            .range(from, from + PAGE - 1)
          if (error) fail("load content", error)
          for (const row of (data ?? []) as (ReminderItem & { user_id: string })[]) {
            out.set(row.user_id, [...(out.get(row.user_id) ?? []), row])
          }
          if (!data || data.length < PAGE) break
        }
      }
      return out
    },

    async claim(subscriptionId, key) {
      const { data, error } = await supabase.rpc("claim_push_reminder", { p_subscription_id: subscriptionId, p_key: key })
      if (error) fail("claim reminder", error)
      return data === true
    },

    async release(subscriptionId, key) {
      const { error } = await supabase.rpc("release_push_reminder", { p_subscription_id: subscriptionId, p_key: key })
      if (error) fail("release reminder", error)
    },

    async recordSuccess(subscriptionId, at) {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ last_sent_at: at.toISOString(), failure_count: 0, last_error: "" })
        .eq("id", subscriptionId)
      if (error) fail("record delivery", error)
    },

    async recordFailure(subscriptionId, failureCount, message) {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ failure_count: failureCount, last_error: message.slice(0, 300) })
        .eq("id", subscriptionId)
      if (error) fail("record failure", error)
    },

    async remove(subscriptionId) {
      const { error } = await supabase.from("push_subscriptions").delete().eq("id", subscriptionId)
      if (error) fail("remove subscription", error)
    },
  }
}
