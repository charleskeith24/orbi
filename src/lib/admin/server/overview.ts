/**
 * SERVER ONLY — Admin → Overview: account totals, activity from `last_sign_in_at`, setup completion, pending
 * requests, recent feedback and the onboarding funnel. Counts only.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminOverview, OnboardingFunnelStep } from "../types"
import { countPendingRequests } from "./requests"
import { readSettings } from "./settings"
import { listAllAuthUsers } from "./users"

const DAY = 86_400_000

interface FunnelRow {
  step: string
  step_index: number | null
  viewed: number
  completed: number
}

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string): Promise<number> {
  const { count: n, error } = await query
  if (error) throw new Error(`[admin] count ${what}: ${error.message}`)
  return n ?? 0
}

/** The onboarding funnel from opt-in usage events (distinct people per step, so it undercounts). */
async function loadFunnel(service: SupabaseClient): Promise<OnboardingFunnelStep[]> {
  const { data, error } = await service.rpc("admin_onboarding_funnel")
  if (error) throw new Error(`[admin] funnel: ${error.message}`)
  return ((data ?? []) as FunnelRow[]).map((row, position) => ({
    step: row.step,
    index: row.step_index ?? position,
    viewed: row.viewed,
    completed: row.completed,
  }))
}

export async function loadOverview(service: SupabaseClient, now: Date): Promise<AdminOverview> {
  const week = new Date(now.getTime() - 7 * DAY)
  const month = new Date(now.getTime() - 30 * DAY)
  const [users, onboarding, pending, feedback, funnel, settings] = await Promise.all([
    listAllAuthUsers(service),
    count(service.from("brand_profiles").select("id", { count: "exact", head: true }).eq("onboarding_completed", true), "finished setups"),
    countPendingRequests(service),
    count(service.from("feedback").select("id", { count: "exact", head: true }).gte("created_at", week.toISOString()), "feedback"),
    loadFunnel(service),
    readSettings(service),
  ])
  const signedInSince = (since: Date) =>
    users.filter((user) => user.last_sign_in_at && new Date(user.last_sign_in_at).getTime() >= since.getTime()).length
  return {
    users_total: users.length,
    active_7d: signedInSince(week),
    active_30d: signedInSince(month),
    onboarding_completed: onboarding,
    pending_requests: pending,
    feedback_7d: feedback,
    funnel,
    access_open: settings.access_open,
  }
}
