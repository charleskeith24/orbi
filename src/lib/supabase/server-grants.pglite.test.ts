/**
 * The server's secret key (service_role) on a database without default privileges — a new hosted project.
 * Every query the server makes must work (supabase/migrations/20260925000000_server_grants.sql), and a creator's
 * words must stay out of reach: service_role bypasses row-level security, so its grants are the only limit.
 */
import type { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PUBLISHED_STAGES } from "@/lib/constants"
import {
  CALENDAR_COLUMNS,
  ITEM_COLUMNS,
  SETTINGS_COLUMNS,
  SUBSCRIPTION_COLUMNS,
} from "@/lib/reminders/server/supabase-store"
import { createAuthUser, createSupabaseTestDb, insertJson, withRole, type JsonRow } from "@/lib/supabase/testing/pglite"

const A = "a0000000-0000-4000-8000-0000000000a1"
const B = "b0000000-0000-4000-8000-0000000000b2"
let db: PGlite
let subscriptionId = ""

const asService = <T extends JsonRow = JsonRow>(sql: string, params: unknown[] = []) =>
  withRole(db, "service_role", null, async (tx) => (await tx.query<T>(sql, params)).rows)
const affected = (sql: string, params: unknown[] = []) =>
  withRole(db, "service_role", null, async (tx) => (await tx.query(sql, params)).affectedRows ?? 0)

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  await createAuthUser(db, { id: A, email: "mika@example.com", fullName: "Mika Santos" })
  await createAuthUser(db, { id: B, email: "jo@example.com" })
  // Workspace rows, written as their owner would (superuser here: the fixture, not the test subject).
  await insertJson(db, "brand_profiles", [{ user_id: A, brand_name: "Kapihan Roasters", onboarding_completed: true }])
  await insertJson(db, "content_ideas", [{ user_id: A, title: "Why I stopped pricing by the hour" }])
  await insertJson(db, "content_items", [{ user_id: A, title: "Pricing talk", stage: PUBLISHED_STAGES[0] }])
  await insertJson(db, "content_calendar", [{ user_id: A, day_of_week: 2, label: "Tuesday tips" }])
  await insertJson(db, "app_settings", [{ user_id: A }])
  await insertJson(db, "feedback", [{ user_id: A, kind: "idea", message: "Love the pipeline", page: "/pipeline" }])
  await insertJson(db, "usage_events", [
    { user_id: A, name: "onboarding_step_viewed", props: { step: "start", index: 0 } },
    { user_id: A, name: "onboarding_step_completed", props: { step: "start", index: 0 } },
  ])
  await db.query("update public.users set headline = 'Barista turned coach', location = 'Cebu' where id = $1", [A])
  const push = await db.query<{ id: string }>(
    "insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example.com/1', 'key', 'auth') returning id",
    [A]
  )
  subscriptionId = push.rows[0].id
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe("service_role runs every server query", () => {
  it("Admin → Overview: finished setups, the onboarding funnel and this week's feedback", async () => {
    expect(await asService("select count(*)::int as n from (select id from public.brand_profiles where onboarding_completed = true) s")).toEqual([{ n: 1 }])
    const funnel = await asService("select * from public.admin_onboarding_funnel()")
    expect(funnel).toEqual([{ step: "start", step_index: 0, viewed: 1, completed: 1 }])
    expect(await asService("select count(*)::int as n from public.feedback where created_at >= now() - interval '7 days'")).toEqual([{ n: 1 }])
  })

  it("Admin → Users: counts per account, names and photo paths", async () => {
    const stats = await asService("select * from public.admin_user_stats($1::uuid[], $2::text[]) order by user_id", [[A, B], [...PUBLISHED_STAGES]])
    expect(stats).toEqual([
      { user_id: A, onboarding_completed: true, ideas: 1, content_items: 1, published: 1 },
      { user_id: B, onboarding_completed: false, ideas: 0, content_items: 0, published: 0 },
    ])
    expect(await asService("select id, full_name, avatar_url from public.users where id = any($1::uuid[]) order by id", [[A]])).toHaveLength(1)
    expect(await asService("select id, full_name, avatar_url from public.users order by id limit 50")).toHaveLength(2)
  })

  it("Admin → Feedback: every field, with the sender's email", async () => {
    const rows = await asService("select id, user_id, kind, message, page, ui_language, viewport, created_at from public.feedback order by created_at desc, id desc limit 51")
    expect(rows).toHaveLength(1)
    expect(await asService("select id, email from public.users where id = any($1::uuid[])", [[A]])).toEqual([{ id: A, email: "mika@example.com" }])
  })

  it("Admin → Users → remove photo (moderation)", async () => {
    expect(await asService("select avatar_url from public.users where id = $1", [A])).toHaveLength(1)
    expect(await affected("update public.users set avatar_url = null where id = $1", [A])).toBe(1)
  })

  it("the Request access form stores a request, and checks the email against existing accounts", async () => {
    const stored = await asService<{ result: string }>("select public.submit_access_request($1, $2, 'Food vlogs', '', 30) as result", ["new@example.com", "New"])
    expect(stored).toHaveLength(1)
    const existing = await asService<{ result: string }>("select public.submit_access_request($1, $2, '', '', 30) as result", ["mika@example.com", "Mika"])
    expect(existing).toHaveLength(1)
    expect(await asService("select count(*)::int as n from public.access_requests where email = 'mika@example.com'")).toEqual([{ n: 0 }])
  })

  it("the reminders job: its columns, delivery bookkeeping and stale devices", async () => {
    expect(await asService(`select ${SUBSCRIPTION_COLUMNS} from public.push_subscriptions`)).toHaveLength(1)
    expect(await asService(`select ${SETTINGS_COLUMNS} from public.app_settings where user_id = any($1::uuid[])`, [[A]])).toHaveLength(1)
    expect(await asService(`select ${CALENDAR_COLUMNS} from public.content_calendar where user_id = any($1::uuid[])`, [[A]])).toHaveLength(1)
    expect(await asService(`select ${ITEM_COLUMNS} from public.content_items where user_id = any($1::uuid[])`, [[A]])).toHaveLength(1)
    expect(await asService<{ ok: boolean }>("select public.claim_push_reminder($1, 'daily:2026-09-25') as ok", [subscriptionId])).toEqual([{ ok: true }])
    await asService("select public.release_push_reminder($1, 'daily:2026-09-25')", [subscriptionId])
    expect(await affected("update public.push_subscriptions set last_sent_at = now(), failure_count = 0, last_error = '' where id = $1", [subscriptionId])).toBe(1)
    expect(await affected("update public.push_subscriptions set failure_count = 3, last_error = 'Gone' where id = $1", [subscriptionId])).toBe(1)
    expect(await affected("delete from public.push_subscriptions where id = $1", [subscriptionId])).toBe(1)
  })
})

describe("…and nothing more: a creator's words stay out of reach", () => {
  const denied = [
    ["idea titles", "select title from public.content_ideas"],
    ["even counting ideas directly", "select count(*) from public.content_ideas"],
    ["every column of a post (captions, notes)", "select * from public.content_items"],
    ["scripts", "select * from public.content_scripts"],
    ["the brand", "select brand_name from public.brand_profiles"],
    ["a profile's headline, location and links", "select headline, location, links, show_niche from public.users"],
    ["raw usage events", "select * from public.usage_events"],
    ["the rest of someone's settings", "select * from public.app_settings"],
    ["team memberships", "select * from public.workspace_members"],
  ] as const

  it.each(denied)("can't read %s", async (_what, sql) => {
    await expect(asService(sql)).rejects.toThrow(/permission denied/)
  })

  it("can't change a name or an email", async () => {
    await expect(affected("update public.users set full_name = 'X' where id = $1", [B])).rejects.toThrow(/permission denied/)
    await expect(affected("update public.users set email = 'x@example.com' where id = $1", [B])).rejects.toThrow(/permission denied/)
  })

  it("gets the counts through security definer functions only the server may call", async () => {
    const rows = await db.query<{ proname: string; prosecdef: boolean }>(
      "select proname, prosecdef from pg_proc where proname in ('admin_user_stats', 'admin_onboarding_funnel') order by proname"
    )
    expect(rows.rows).toEqual([
      { proname: "admin_onboarding_funnel", prosecdef: true },
      { proname: "admin_user_stats", prosecdef: true },
    ])
    await expect(
      withRole(db, "authenticated", A, (tx) => tx.query("select * from public.admin_user_stats($1::uuid[], $2::text[])", [[A], [...PUBLISHED_STAGES]]))
    ).rejects.toThrow(/permission denied/)
  })
})
