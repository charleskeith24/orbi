/**
 * supabase/migrations/20260914000200_push.sql on a real Postgres engine (PGlite).
 *
 * Self-contained like the beta migration test: the Supabase stub from the shared harness
 * (auth schema, anon/authenticated/service_role, default privileges) plus `public.set_updated_at()`,
 * then this migration alone. The full chain is covered by src/lib/data/schema.pglite.test.ts.
 */
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { SUPABASE_STUB_SQL, withRole } from "@/lib/supabase/testing/pglite"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 })

const MIGRATION = readFileSync(new URL("../../../supabase/migrations/20260914000200_push.sql", import.meta.url), "utf8")
/** What 20260925000000_server_grants.sql gives the reminders job on push_subscriptions (new projects have no defaults). */
const SERVER_GRANTS = readFileSync(new URL("../../../supabase/migrations/20260925000000_server_grants.sql", import.meta.url), "utf8")
  .split(";")
  .filter((statement) => /^\s*grant\b[^;]*public\.push_subscriptions/m.test(statement.replace(/^\s*--.*$/gm, "")))
  .join(";\n")
const U1 = "11111111-1111-4111-8111-111111111111"
const U2 = "22222222-2222-4222-8222-222222222222"
const EP1 = "https://fcm.googleapis.com/fcm/send/device-one"
const EP2 = "https://web.push.apple.com/device-two"

let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB_SQL)
  await db.exec(`
    create function public.set_updated_at() returns trigger language plpgsql
      as $$ begin new.updated_at = now(); return new; end; $$;
  `)
  await db.exec(MIGRATION)
  await db.exec(`${SERVER_GRANTS};`)
  await db.exec(`insert into auth.users (id, email) values ('${U1}', 'a@test.local'), ('${U2}', 'b@test.local')`)
})

afterAll(async () => {
  await db?.close()
})

type Row = { id: string; user_id: string; endpoint: string; sent_keys: string[]; created_at: string; failure_count: number; last_error: string }

const save = (user: string, endpoint: string, p256dh = "key", auth = "secret") =>
  withRole(db, "authenticated", user, async (tx) => {
    const result = await tx.query<{ id: string }>("select public.save_push_subscription($1, $2, $3, 'Test UA') as id", [endpoint, p256dh, auth])
    return result.rows[0].id
  })

const asUser = <T,>(user: string, sql: string, params: unknown[] = []) =>
  withRole(db, "authenticated", user, async (tx) => (await tx.query<T>(sql, params)).rows)

const asService = <T,>(sql: string, params: unknown[] = []) =>
  withRole(db, "service_role", null, async (tx) => (await tx.query<T>(sql, params)).rows)

describe("push_subscriptions", () => {
  it("saves a subscription for the caller and keeps one row per endpoint", async () => {
    const first = await save(U1, EP1)
    const again = await save(U1, EP1, "new-key", "new-secret")
    expect(again).toBe(first)
    const rows = await asUser<Row & { p256dh: string; user_agent: string }>(U1, "select * from public.push_subscriptions")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ user_id: U1, endpoint: EP1, p256dh: "new-key", user_agent: "Test UA", sent_keys: [] })
  })

  it("isolates users: each reads only their own devices", async () => {
    await save(U2, EP2)
    expect((await asUser<Row>(U1, "select endpoint from public.push_subscriptions")).map((r) => r.endpoint)).toEqual([EP1])
    expect((await asUser<Row>(U2, "select endpoint from public.push_subscriptions")).map((r) => r.endpoint)).toEqual([EP2])
  })

  it("refuses rows for another user, updates, and anonymous access", async () => {
    await expect(
      asUser(U1, "insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://x.test/a', 'k', 'a')", [U2])
    ).rejects.toThrow(/row-level security/)
    await expect(asUser(U1, "update public.push_subscriptions set failure_count = 9")).rejects.toThrow(/permission denied/)
    await expect(
      withRole(db, "anon", null, (tx) => tx.query("select * from public.push_subscriptions"))
    ).rejects.toThrow(/permission denied/)
    await expect(
      withRole(db, "anon", null, (tx) => tx.query("select public.save_push_subscription('https://x.test/b', 'k', 'a')"))
    ).rejects.toThrow(/permission denied/)
  })

  it("lets users delete only their own devices", async () => {
    await asUser(U1, "delete from public.push_subscriptions where endpoint = $1", [EP2])
    expect(await asService<Row>("select endpoint from public.push_subscriptions order by endpoint")).toHaveLength(2)
  })

  it("moves an endpoint to the account that subscribes it now, with a fresh history", async () => {
    await asService("update public.push_subscriptions set sent_keys = '{daily:2026-09-16}' where endpoint = $1", [EP1])
    await save(U2, EP1)
    const rows = await asService<Row>("select user_id, sent_keys from public.push_subscriptions where endpoint = $1", [EP1])
    expect(rows).toEqual([{ user_id: U2, sent_keys: [] }])
    expect(await asUser(U1, "select * from public.push_subscriptions")).toEqual([])
    await save(U1, EP1) // and back, for the tests below
  })

  it("enforces the CHECKs", async () => {
    await expect(save(U1, "http://insecure.test/x")).rejects.toThrow(/push_subscriptions_endpoint_check/)
    await expect(save(U1, "https://x.test/empty-key", "")).rejects.toThrow(/push_subscriptions_p256dh_check/)
  })

  it("requires a signed-in caller to save", async () => {
    await expect(
      withRole(db, "authenticated", null, (tx) => tx.query("select public.save_push_subscription('https://x.test/c', 'k', 'a')"))
    ).rejects.toThrow(/not signed in/)
  })
})

describe("claim / release (cron job)", () => {
  const idOf = async (endpoint: string) => (await asService<Row>("select id from public.push_subscriptions where endpoint = $1", [endpoint]))[0].id

  it("claims a reminder once, however often it is asked", async () => {
    const id = await idOf(EP1)
    const claim = async () => (await asService<{ ok: boolean }>("select public.claim_push_reminder($1, 'daily:2026-09-16') as ok", [id]))[0].ok
    expect(await claim()).toBe(true)
    expect(await claim()).toBe(false)
    expect((await asService<Row>("select sent_keys from public.push_subscriptions where id = $1", [id]))[0].sent_keys).toEqual(["daily:2026-09-16"])
  })

  it("releases a claim so a failed send can be retried", async () => {
    const id = await idOf(EP1)
    await asService("select public.release_push_reminder($1, 'daily:2026-09-16')", [id])
    expect((await asService<{ ok: boolean }>("select public.claim_push_reminder($1, 'daily:2026-09-16') as ok", [id]))[0].ok).toBe(true)
  })

  it("keeps only the latest 100 keys", async () => {
    const id = await idOf(EP1)
    for (let i = 0; i < 120; i++) await asService("select public.claim_push_reminder($1, $2)", [id, `slot:s:${i}`])
    const [row] = await asService<Row>("select sent_keys from public.push_subscriptions where id = $1", [id])
    expect(row.sent_keys).toHaveLength(100)
    expect(row.sent_keys.at(-1)).toBe("slot:s:119")
    expect(row.sent_keys[0]).toBe("slot:s:20")
  })

  it("is not callable by users", async () => {
    const id = await idOf(EP1)
    await expect(asUser(U1, "select public.claim_push_reminder($1, 'x')", [id])).rejects.toThrow(/permission denied/)
    await expect(asUser(U1, "select public.release_push_reminder($1, 'x')", [id])).rejects.toThrow(/permission denied/)
  })

  it("stamps updated_at and cascades when the account is deleted", async () => {
    const [before] = await asService<{ updated_at: string }>("select updated_at from public.push_subscriptions where endpoint = $1", [EP2])
    await new Promise((resolve) => setTimeout(resolve, 5))
    await asService("update public.push_subscriptions set failure_count = 1, last_error = '500 push service' where endpoint = $1", [EP2])
    const [after] = await asService<{ updated_at: string }>("select updated_at from public.push_subscriptions where endpoint = $1", [EP2])
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime())
    await db.exec(`delete from auth.users where id = '${U2}'`)
    expect(await asService("select * from public.push_subscriptions where endpoint = $1", [EP2])).toEqual([])
  })
})
