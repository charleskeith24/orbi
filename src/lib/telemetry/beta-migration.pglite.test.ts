/**
 * supabase/migrations/20260914000100_beta.sql on a real Postgres engine (PGlite).
 *
 * Self-contained: a stub Supabase `auth` schema (auth.users, auth.uid() from a session setting,
 * anon/authenticated roles) plus `public.set_updated_at()`, then the beta migration alone — so it
 * doesn't depend on the init migration, which is edited in parallel. The full migration chain is
 * covered by src/lib/data/*.pglite.test.ts.
 */
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { USAGE_EVENT_NAMES } from "./events"

const MIGRATION = readFileSync(new URL("../../../supabase/migrations/20260914000100_beta.sql", import.meta.url), "utf8")
const U1 = "11111111-1111-4111-8111-111111111111"
const U2 = "22222222-2222-4222-8222-222222222222"

let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to authenticated;
    create function public.set_updated_at() returns trigger language plpgsql
      as $$ begin new.updated_at = now(); return new; end; $$;
  `)
  await db.exec(MIGRATION)
  await db.exec(`insert into auth.users (id, email) values ('${U1}', 'a@test.local'), ('${U2}', 'b@test.local')`)
}, 60_000)

afterAll(async () => {
  await db?.close()
})

/** Runs SQL as a signed-in user (role authenticated, auth.uid() = user). */
async function asUser<T>(user: string, sql: string): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
  try {
    return (await db.query<T>(sql)).rows
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);")
  }
}

describe("feedback", () => {
  it("defaults user_id to the caller and status to new", async () => {
    const rows = await asUser<{ user_id: string; status: string; ui_language: string }>(
      U1,
      `insert into public.feedback (kind, message, page) values ('bug', 'Save does nothing', '/ideas') returning user_id, status, ui_language`
    )
    expect(rows).toEqual([{ user_id: U1, status: "new", ui_language: "en" }])
  })

  it("isolates users: each sees only their own rows", async () => {
    await asUser(U2, `insert into public.feedback (kind, message) values ('praise', 'Love the Taglish')`)
    const own = await asUser<{ message: string }>(U1, `select message from public.feedback`)
    expect(own.map((r) => r.message)).toEqual(["Save does nothing"])
    const other = await asUser<{ message: string }>(U2, `select message from public.feedback`)
    expect(other.map((r) => r.message)).toEqual(["Love the Taglish"])
  })

  it("refuses rows for another user", async () => {
    await expect(asUser(U1, `insert into public.feedback (user_id, kind, message) values ('${U2}', 'bug', 'x')`)).rejects.toThrow(/row-level security/)
  })

  it("does not let testers edit or delete feedback", async () => {
    await expect(asUser(U1, `update public.feedback set status = 'done'`)).rejects.toThrow(/permission denied/)
    await expect(asUser(U1, `delete from public.feedback`)).rejects.toThrow(/permission denied/)
  })

  it("enforces the CHECK lists and lengths", async () => {
    await expect(asUser(U1, `insert into public.feedback (kind, message) values ('rant', 'x')`)).rejects.toThrow(/feedback_kind_check/)
    await expect(asUser(U1, `insert into public.feedback (kind, message) values ('idea', '')`)).rejects.toThrow(/feedback_message_check/)
    await expect(asUser(U1, `insert into public.feedback (kind, message) values ('idea', repeat('x', 4001))`)).rejects.toThrow(/feedback_message_check/)
    await expect(asUser(U1, `insert into public.feedback (kind, message, viewport) values ('idea', 'x', 'watch')`)).rejects.toThrow(/feedback_viewport_check/)
  })

  it("stamps updated_at when the owner triages in the dashboard", async () => {
    const [before] = (await db.query<{ updated_at: Date }>(`select updated_at from public.feedback where user_id = '${U1}'`)).rows
    await new Promise((resolve) => setTimeout(resolve, 5))
    await db.exec(`update public.feedback set status = 'reviewed' where user_id = '${U1}'`)
    const [after] = (await db.query<{ updated_at: Date }>(`select updated_at from public.feedback where user_id = '${U1}'`)).rows
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime())
  })
})

describe("usage_events", () => {
  it("accepts every event name the app sends", async () => {
    for (const name of USAGE_EVENT_NAMES) {
      await asUser(U1, `insert into public.usage_events (name, props, path) values ('${name}', '{}', '/')`)
    }
    const rows = await asUser<{ n: number }>(U1, `select count(*)::int as n from public.usage_events`)
    expect(rows[0].n).toBe(USAGE_EVENT_NAMES.length)
    const others = await asUser<{ n: number }>(U2, `select count(*)::int as n from public.usage_events`)
    expect(others[0].n).toBe(0)
  })

  it("rejects unknown names, non-object and oversized props", async () => {
    await expect(asUser(U1, `insert into public.usage_events (name) values ('typed_text')`)).rejects.toThrow(/usage_events_name_check/)
    await expect(asUser(U1, `insert into public.usage_events (name, props) values ('page_viewed', '[1]')`)).rejects.toThrow(/usage_events_props_check/)
    await expect(
      asUser(U1, `insert into public.usage_events (name, props) values ('page_viewed', jsonb_build_object('x', repeat('a', 3000)))`)
    ).rejects.toThrow(/usage_events_props_check/)
  })

  it("gives anon no access", async () => {
    await db.exec("set role anon;")
    try {
      await expect(db.query(`insert into public.usage_events (name) values ('page_viewed')`)).rejects.toThrow(/permission denied/)
      await expect(db.query(`select * from public.feedback`)).rejects.toThrow(/permission denied/)
    } finally {
      await db.exec("reset role;")
    }
  })
})

describe("account deletion", () => {
  it("cascades to feedback and usage events", async () => {
    await db.exec(`delete from auth.users where id = '${U1}'`)
    const feedback = await db.query<{ n: number }>(`select count(*)::int as n from public.feedback where user_id = '${U1}'`)
    const events = await db.query<{ n: number }>(`select count(*)::int as n from public.usage_events where user_id = '${U1}'`)
    expect(feedback.rows[0].n).toBe(0)
    expect(events.rows[0].n).toBe(0)
  })
})
