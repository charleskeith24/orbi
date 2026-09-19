/**
 * supabase/migrations/20260918000000_admin.sql on a real Postgres engine (PGlite), on top of every earlier
 * migration and the stub of Supabase's auth schema (src/lib/supabase/testing/pglite.ts).
 *
 * Proves the security rules that live in the database: the admin role can't be self-granted, the
 * waitlist is invisible to anon and signed-in users, the audit log is append-only, admin read access
 * needs 2-step verification (aal2), and the server-only functions do what the routes rely on.
 */
import type { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PUBLISHED_STAGES } from "@/lib/constants"
import { createAuthUser, createSupabaseTestDb, type RequestRole } from "@/lib/supabase/testing/pglite"
import { ADMIN_AUDIT_ACTIONS } from "./types"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 })

const ADMIN = "a0000000-0000-4000-8000-0000000000a1"
const USER = "b0000000-0000-4000-8000-0000000000b1"
const OTHER = "c0000000-0000-4000-8000-0000000000c1"

let db: PGlite

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  await createAuthUser(db, { id: ADMIN, email: "owner@example.com", fullName: "Olive Owner" })
  await createAuthUser(db, { id: USER, email: "creator@example.com", fullName: "Cris Creator" })
  await createAuthUser(db, { id: OTHER, email: "other@example.com" })
  // The first admin, the way docs/ADMIN.md says: one line in the SQL editor (runs as the owner).
  await db.exec(`insert into public.admin_users (user_id) select id from auth.users where email = 'owner@example.com'`)
}, 180_000)

afterAll(async () => {
  await db?.close()
})

/** Runs one statement in its own transaction as `role`, with JWT claims like PostgREST sets them. */
async function as<T = Record<string, unknown>>(
  role: RequestRole,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
  claims: Record<string, unknown> = {}
): Promise<T[]> {
  return db.transaction(async (tx) => {
    const jwt = JSON.stringify({ ...(userId ? { sub: userId } : {}), role, ...claims })
    await tx.query("select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)", [role, jwt])
    return (await tx.query<T>(sql, params)).rows
  })
}
const aal2 = { aal: "aal2" }
const aal1 = { aal: "aal1" }
const service = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => as<T>("service_role", null, sql, params)

async function submit(email: string, name = "Ana", maxPerHour = 30): Promise<string> {
  const rows = await service<{ result: string }>("select public.submit_access_request($1, $2, 'Food vlogs', '', $3) as result", [email, name, maxPerHour])
  return rows[0].result
}

describe("admin tables", () => {
  it("are created with row-level security on", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname in ('admin_users', 'access_requests', 'admin_audit_log', 'platform_settings') order by 1`
    )
    expect(rows).toEqual([
      { relname: "access_requests", relrowsecurity: true },
      { relname: "admin_audit_log", relrowsecurity: true },
      { relname: "admin_users", relrowsecurity: true },
      { relname: "platform_settings", relrowsecurity: true },
    ])
  })
})

describe("admin_users: the role can't be self-granted", () => {
  it("refuses inserts, updates and deletes from signed-in users (even an admin) and anon", async () => {
    for (const [role, user] of [
      ["authenticated", USER],
      ["authenticated", ADMIN],
      ["anon", null],
    ] as const) {
      await expect(as(role, user, `insert into public.admin_users (user_id) values ('${USER}')`, [], aal2)).rejects.toThrow(/permission denied/)
      await expect(as(role, user, `update public.admin_users set granted_by = null`, [], aal2)).rejects.toThrow(/permission denied/)
      await expect(as(role, user, `delete from public.admin_users`, [], aal2)).rejects.toThrow(/permission denied/)
      await expect(as(role, user, `select * from public.admin_users`, [], aal2)).rejects.toThrow(/permission denied/)
    }
  })

  it("can't be granted through public.users either (no role column there)", async () => {
    const { rows } = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'users'"
    )
    expect(rows.map((r) => r.column_name)).not.toEqual(expect.arrayContaining(["role"]))
    expect(rows.map((r) => r.column_name).some((c) => /admin|role/.test(c))).toBe(false)
  })

  it("is written by the server (secret key)", async () => {
    await service(`insert into public.admin_users (user_id, granted_by) values ('${OTHER}', '${ADMIN}')`)
    expect(await service<{ n: number }>("select count(*)::int as n from public.admin_users")).toEqual([{ n: 2 }])
    await service(`delete from public.admin_users where user_id = '${OTHER}'`)
  })
})

describe("is_admin()", () => {
  it("is true for an admin and false for everyone else", async () => {
    expect(await as("authenticated", ADMIN, "select public.is_admin() as v")).toEqual([{ v: true }])
    expect(await as("authenticated", USER, "select public.is_admin() as v")).toEqual([{ v: false }])
    expect(await service("select public.is_admin() as v")).toEqual([{ v: false }])
  })

  it("is not callable by anon", async () => {
    await expect(as("anon", null, "select public.is_admin()")).rejects.toThrow(/permission denied/)
  })

  it("is security definer with an empty search_path", async () => {
    const { rows } = await db.query<{ prosecdef: boolean; provolatile: string; proconfig: string[] }>(
      "select prosecdef, provolatile, proconfig from pg_proc where proname = 'is_admin' and pronamespace = 'public'::regnamespace"
    )
    expect(rows).toEqual([{ prosecdef: true, provolatile: "s", proconfig: ['search_path=""'] }])
  })
})

describe("access_requests: server only", () => {
  it("can't be read or written by anon or signed-in users (not even an admin)", async () => {
    for (const [role, user] of [
      ["anon", null],
      ["authenticated", USER],
      ["authenticated", ADMIN],
    ] as const) {
      await expect(as(role, user, "select * from public.access_requests", [], aal2)).rejects.toThrow(/permission denied/)
      await expect(as(role, user, "insert into public.access_requests (email, name) values ('x@y.z', 'X')", [], aal2)).rejects.toThrow(/permission denied/)
      await expect(as(role, user, "select public.submit_access_request('x@y.z', 'X')", [], aal2)).rejects.toThrow(/permission denied/)
    }
  })

  it("stores a new request with a lower-cased email", async () => {
    expect(await submit("  New.Person@Example.COM ", " Ana Santos ")).toBe("created")
    const rows = await service("select email, name, about, link, status, decided_at from public.access_requests")
    expect(rows).toEqual([{ email: "new.person@example.com", name: "Ana Santos", about: "Food vlogs", link: "", status: "pending", decided_at: null }])
  })

  it("keeps at most one pending request per email (duplicates are not stored)", async () => {
    expect(await submit("NEW.person@example.com")).toBe("duplicate")
    await expect(service("insert into public.access_requests (email, name) values ('new.person@example.com', 'Again')")).rejects.toThrow(
      /access_requests_pending_email_key/
    )
    expect(await service("select count(*)::int as n from public.access_requests")).toEqual([{ n: 1 }])
  })

  it("doesn't store requests for emails that already have an account", async () => {
    expect(await submit("Creator@Example.com")).toBe("exists")
    expect(await service("select count(*)::int as n from public.access_requests where email = 'creator@example.com'")).toEqual([{ n: 0 }])
  })

  it("accepts a new request after the earlier one was decided", async () => {
    await service(`update public.access_requests set status = 'rejected', decided_at = now(), decided_by = '${ADMIN}' where email = 'new.person@example.com'`)
    expect(await submit("new.person@example.com")).toBe("created")
  })

  it("stops at the hourly limit", async () => {
    const before = (await service<{ n: number }>("select count(*)::int as n from public.access_requests"))[0].n
    expect(await submit("limit-1@example.com", "L", before + 1)).toBe("created")
    expect(await submit("limit-2@example.com", "L", before + 1)).toBe("rate_limited")
    // Requests older than an hour don't count.
    await db.exec("update public.access_requests set created_at = now() - interval '2 hours'")
    expect(await submit("limit-2@example.com", "L", 1)).toBe("created")
  })

  it("answers closed while the admin has requests switched off", async () => {
    await service("update public.platform_settings set access_open = false")
    expect(await submit("closed@example.com")).toBe("closed")
    await service("update public.platform_settings set access_open = true")
    expect(await submit("closed@example.com")).toBe("created")
  })

  it("enforces the field rules and the decision invariant", async () => {
    await expect(service("insert into public.access_requests (email, name) values ('Upper@Example.com', 'X')")).rejects.toThrow(/access_requests_email_check/)
    await expect(service("insert into public.access_requests (email, name) values ('not-an-email', 'X')")).rejects.toThrow(/access_requests_email_check/)
    await expect(service("insert into public.access_requests (email, name) values ('a@b.c', '')")).rejects.toThrow(/access_requests_name_check/)
    await expect(service("insert into public.access_requests (email, name, about) values ('a@b.c', 'X', repeat('x', 301))")).rejects.toThrow(/access_requests_about_check/)
    await expect(service("insert into public.access_requests (email, name, link) values ('a@b.c', 'X', 'javascript:alert(1)')")).rejects.toThrow(/access_requests_link_check/)
    await expect(service("insert into public.access_requests (email, name, status) values ('a@b.c', 'X', 'approved')")).rejects.toThrow(/access_requests_decision_check/)
    await expect(service("insert into public.access_requests (email, name, status, decided_at) values ('a@b.c', 'X', 'maybe', now())")).rejects.toThrow(/access_requests_status_check/)
  })

  it("can't be deleted through the API (only in the dashboard)", async () => {
    await expect(service("delete from public.access_requests")).rejects.toThrow(/permission denied/)
  })

  it("stores no IP address", async () => {
    const { rows } = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'access_requests'"
    )
    expect(rows.map((r) => r.column_name).some((c) => /ip/.test(c))).toBe(false)
  })
})

describe("platform_settings", () => {
  it("is a singleton the server reads and writes, invisible to users", async () => {
    expect(await service("select access_open from public.platform_settings")).toEqual([{ access_open: true }])
    await expect(service("insert into public.platform_settings (id) values (true)")).rejects.toThrow(/permission denied/)
    await expect(service("delete from public.platform_settings")).rejects.toThrow(/permission denied/)
    // Even the owner (SQL editor) can't add a second row.
    await expect(db.query("insert into public.platform_settings (id) values (false)")).rejects.toThrow(/platform_settings_id_check/)
    await expect(db.query("insert into public.platform_settings (id) values (true)")).rejects.toThrow(/platform_settings_pkey/)
    await expect(as("authenticated", ADMIN, "select * from public.platform_settings", [], aal2)).rejects.toThrow(/permission denied/)
    await expect(as("anon", null, "select * from public.platform_settings")).rejects.toThrow(/permission denied/)
  })
})

describe("admin_audit_log: append-only", () => {
  it("accepts every action the app writes", async () => {
    for (const action of ADMIN_AUDIT_ACTIONS) {
      await service(
        `insert into public.admin_audit_log (admin_id, admin_email, action, target_user_id, target_email, details)
         values ($1, 'owner@example.com', $2, $3, 'creator@example.com', '{"from": "active", "to": "disabled"}')`,
        [ADMIN, action, USER]
      )
    }
    expect(await service("select count(*)::int as n from public.admin_audit_log")).toEqual([{ n: ADMIN_AUDIT_ACTIONS.length }])
    await expect(service(`insert into public.admin_audit_log (admin_id, action) values ('${ADMIN}', 'read_scripts')`)).rejects.toThrow(/admin_audit_log_action_check/)
    await expect(service(`insert into public.admin_audit_log (admin_id, action, details) values ('${ADMIN}', 'user_invited', '[1]')`)).rejects.toThrow(
      /admin_audit_log_details_check/
    )
  })

  it("can't be changed or deleted, not even with the secret key", async () => {
    await expect(service("update public.admin_audit_log set action = 'user_enabled'")).rejects.toThrow(/permission denied/)
    await expect(service("delete from public.admin_audit_log")).rejects.toThrow(/permission denied/)
    await expect(service("truncate public.admin_audit_log")).rejects.toThrow(/permission denied/)
    for (const user of [USER, ADMIN]) {
      await expect(as("authenticated", user, `insert into public.admin_audit_log (admin_id, action) values ('${user}', 'user_invited')`, [], aal2)).rejects.toThrow(
        /permission denied/
      )
      await expect(as("authenticated", user, "update public.admin_audit_log set action = 'user_enabled'", [], aal2)).rejects.toThrow(/permission denied/)
      await expect(as("authenticated", user, "delete from public.admin_audit_log", [], aal2)).rejects.toThrow(/permission denied/)
    }
    await expect(as("anon", null, "select * from public.admin_audit_log")).rejects.toThrow(/permission denied/)
  })

  it("is readable by admins with 2-step verification only", async () => {
    const count = (user: string, claims: Record<string, unknown>) =>
      as<{ n: number }>("authenticated", user, "select count(*)::int as n from public.admin_audit_log", [], claims).then((r) => r[0].n)
    expect(await count(ADMIN, aal2)).toBe(ADMIN_AUDIT_ACTIONS.length)
    expect(await count(ADMIN, aal1)).toBe(0)
    expect(await count(ADMIN, {})).toBe(0)
    expect(await count(USER, aal2)).toBe(0)
  })
})

describe("feedback and usage_events: admin read access", () => {
  beforeAll(async () => {
    await as("authenticated", USER, "insert into public.feedback (kind, message) values ('bug', 'Save does nothing')")
    await as("authenticated", OTHER, "insert into public.feedback (kind, message) values ('idea', 'Dark media kit')")
    await as("authenticated", ADMIN, "insert into public.feedback (kind, message) values ('praise', 'Mine')")
  })

  it("lets an admin at aal2 read every row", async () => {
    const rows = await as<{ message: string }>("authenticated", ADMIN, "select message from public.feedback order by message", [], aal2)
    expect(rows.map((r) => r.message)).toEqual(["Dark media kit", "Mine", "Save does nothing"])
  })

  it("keeps an admin without 2-step verification to their own rows", async () => {
    const rows = await as<{ message: string }>("authenticated", ADMIN, "select message from public.feedback", [], aal1)
    expect(rows.map((r) => r.message)).toEqual(["Mine"])
  })

  it("keeps everyone else to their own rows", async () => {
    const rows = await as<{ message: string }>("authenticated", USER, "select message from public.feedback", [], aal2)
    expect(rows.map((r) => r.message)).toEqual(["Save does nothing"])
  })

  it("does the same for usage events", async () => {
    await as("authenticated", USER, `insert into public.usage_events (name, props) values ('onboarding_step_viewed', '{"step": "about", "index": 1}')`)
    await as("authenticated", OTHER, `insert into public.usage_events (name, props) values ('onboarding_step_viewed', '{"step": "about", "index": 1}')`)
    const count = (user: string, claims: Record<string, unknown>) =>
      as<{ n: number }>("authenticated", user, "select count(*)::int as n from public.usage_events", [], claims).then((r) => r[0].n)
    expect(await count(ADMIN, aal2)).toBe(2)
    expect(await count(ADMIN, aal1)).toBe(0)
    expect(await count(USER, aal2)).toBe(1)
  })
})

describe("revoke_admin()", () => {
  it("never removes the last admin, and serializes removals", async () => {
    expect(await service("select public.revoke_admin($1) as r", [ADMIN])).toEqual([{ r: "last_admin" }])
    expect(await service("select public.revoke_admin($1) as r", [USER])).toEqual([{ r: "not_admin" }])
    await service(`insert into public.admin_users (user_id, granted_by) values ('${USER}', '${ADMIN}')`)
    expect(await service("select public.revoke_admin($1) as r", [USER])).toEqual([{ r: "revoked" }])
    expect(await service<{ user_id: string }>("select user_id from public.admin_users")).toEqual([{ user_id: ADMIN }])
  })

  it("is server-only", async () => {
    await expect(as("authenticated", ADMIN, "select public.revoke_admin($1)", [USER], aal2)).rejects.toThrow(/permission denied/)
  })
})

describe("admin_user_stats(): counts only", () => {
  it("counts ideas, content items and published items per account, and whether setup is done", async () => {
    await as("authenticated", USER, "insert into public.content_ideas (title) values ('Idea one'), ('Idea two')")
    await as("authenticated", USER, "insert into public.content_items (title, stage) values ('Draft', 'scripting'), ('Live', 'published'), ('Again', 'repurpose')")
    await as("authenticated", USER, "insert into public.brand_profiles (onboarding_completed) values (true)")
    const rows = await service("select * from public.admin_user_stats($1::uuid[], $2::text[]) order by ideas desc", [[USER, OTHER], PUBLISHED_STAGES])
    expect(rows).toEqual([
      { user_id: USER, onboarding_completed: true, ideas: 2, content_items: 3, published: 2 },
      { user_id: OTHER, onboarding_completed: false, ideas: 0, content_items: 0, published: 0 },
    ])
  })

  it("returns no text columns", async () => {
    const { rows } = await db.query<{ result: string }>("select pg_get_function_result('public.admin_user_stats(uuid[], text[])'::regprocedure) as result")
    expect(rows[0].result).toBe("TABLE(user_id uuid, onboarding_completed boolean, ideas integer, content_items integer, published integer)")
  })

  it("is server-only", async () => {
    await expect(as("authenticated", ADMIN, "select * from public.admin_user_stats($1::uuid[], $2::text[])", [[USER], PUBLISHED_STAGES], aal2)).rejects.toThrow(
      /permission denied/
    )
  })
})

describe("admin_onboarding_funnel()", () => {
  it("counts distinct people who viewed and completed each step, in step order", async () => {
    const event = (user: string, name: string, step: string, index: number) =>
      as("authenticated", user, "insert into public.usage_events (name, props) values ($1, $2::jsonb)", [name, JSON.stringify({ step, index })])
    await event(USER, "onboarding_step_viewed", "about", 1) // twice: counted once
    await event(USER, "onboarding_step_completed", "about", 1)
    await event(USER, "onboarding_step_viewed", "start", 0)
    await event(OTHER, "onboarding_step_viewed", "start", 0)
    await event(USER, "onboarding_step_completed", "start", 0)
    await event(OTHER, "onboarding_step_completed", "start", 0)
    await as("authenticated", USER, "insert into public.usage_events (name, props) values ('page_viewed', '{\"module\": \"ideas\"}')")
    expect(await service("select * from public.admin_onboarding_funnel()")).toEqual([
      { step: "start", step_index: 0, viewed: 2, completed: 2 },
      { step: "about", step_index: 1, viewed: 2, completed: 1 },
    ])
  })

  it("is server-only", async () => {
    await expect(as("authenticated", ADMIN, "select * from public.admin_onboarding_funnel()", [], aal2)).rejects.toThrow(/permission denied/)
  })
})

describe("account deletion", () => {
  it("removes the admin role, clears decided_by and keeps the audit log", async () => {
    await createAuthUser(db, { id: "d0000000-0000-4000-8000-0000000000d1", email: "second@example.com" })
    const second = "d0000000-0000-4000-8000-0000000000d1"
    await service(`insert into public.admin_users (user_id, granted_by) values ('${second}', '${ADMIN}')`)
    await service(
      `update public.access_requests set status = 'approved', decided_at = now(), decided_by = '${second}', decided_by_email = 'second@example.com' where email = 'closed@example.com'`
    )
    await service(`insert into public.admin_audit_log (admin_id, admin_email, action) values ('${second}', 'second@example.com', 'request_approved')`)

    await db.exec(`delete from auth.users where id = '${second}'`)
    expect(await service(`select count(*)::int as n from public.admin_users where user_id = '${second}'`)).toEqual([{ n: 0 }])
    expect(await service("select decided_by, decided_by_email from public.access_requests where email = 'closed@example.com'")).toEqual([
      { decided_by: null, decided_by_email: "second@example.com" },
    ])
    expect(await service(`select admin_email from public.admin_audit_log where admin_id = '${second}'`)).toEqual([{ admin_email: "second@example.com" }])
  })
})
