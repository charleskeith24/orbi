/**
 * supabase/migrations/20260919000000_circles.sql on a real Postgres engine (PGlite), on top of every earlier
 * migration and the stub of Supabase's auth schema (src/lib/supabase/testing/pglite.ts).
 *
 * Proves the privacy rules that live in the database (docs/CIRCLES.md): members read only their own
 * circles, each member writes only their own check-ins, asks, interests and contact, contacts are readable
 * only through circle_contact() after an accepted interest, invite codes are stored hashed, and neither
 * anon nor the server's secret key (admins) can read circle content.
 */
import type { PGlite } from "@electric-sql/pglite"
import { createHash } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { COLLAB_TYPE_IDS } from "@/lib/constants"
import { createAuthUser, createSupabaseTestDb, type RequestRole } from "@/lib/supabase/testing/pglite"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 })

const OWNER = "a0000000-0000-4000-8000-0000000000a1"
const MIKA = "b0000000-0000-4000-8000-0000000000b1"
const JUN = "c0000000-0000-4000-8000-0000000000c1"
const OUTSIDER = "d0000000-0000-4000-8000-0000000000d1"

const TABLES = ["circles", "circle_members", "circle_contacts", "circle_checkins", "circle_asks", "circle_ask_interests"] as const
const FUNCTIONS = [
  "is_circle_member",
  "create_circle",
  "preview_invite",
  "join_circle",
  "rotate_invite",
  "remove_member",
  "leave_circle",
  "accept_interest",
  "set_circle_contact",
  "circle_contact",
] as const

let db: PGlite

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  for (const [id, email] of [
    [OWNER, "owner@example.com"],
    [MIKA, "mika@example.com"],
    [JUN, "jun@example.com"],
    [OUTSIDER, "outsider@example.com"],
  ]) {
    await createAuthUser(db, { id, email })
  }
}, 180_000)

afterAll(async () => {
  await db?.close()
})

/** Runs one statement in its own transaction as `role`, with JWT claims like PostgREST sets them. */
async function as<T = Record<string, unknown>>(role: RequestRole, userId: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    const jwt = JSON.stringify({ ...(userId ? { sub: userId } : {}), role })
    await tx.query("select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)", [role, jwt])
    return (await tx.query<T>(sql, params)).rows
  })
}
const user = <T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []) => as<T>("authenticated", userId, sql, params)
/** The migration owner (the SQL editor): sees everything, for assertions only. */
const owner = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows

async function createCircle(userId: string, name: string, display: string): Promise<{ circle_id: string; invite_code: string }> {
  const [row] = await user<{ circle_id: string; invite_code: string }>(userId, "select * from public.create_circle($1, $2)", [name, display])
  return row
}
async function join(userId: string, code: string, display: string): Promise<{ circle_id: string; joined: boolean }> {
  const [row] = await user<{ circle_id: string; joined: boolean }>(userId, "select * from public.join_circle($1, $2)", [code, display])
  return row
}
const count = async (sql: string, params: unknown[] = []) => (await owner<{ n: number }>(`select count(*)::int as n from ${sql}`, params))[0].n
const sha256 = (code: string) => createHash("sha256").update(code, "utf8").digest("hex")
/** Monday of the current week, in the database's calendar (the check-in window is relative to it). */
async function mondayOffset(weeks: number): Promise<string> {
  const [row] = await owner<{ d: string }>(`select (date_trunc('week', current_date)::date + ($1::int * 7))::text as d`, [weeks])
  return row.d
}

describe("circle tables", () => {
  it("are created with row-level security on", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = any($1) order by 1`,
      [[...TABLES]]
    )
    expect(rows).toHaveLength(TABLES.length)
    expect(rows.every((r) => r.relrowsecurity)).toBe(true)
  })

  it("give anon and the server's secret key (admins) no access at all", async () => {
    for (const table of TABLES) {
      await expect(as("anon", null, `select * from public.${table}`)).rejects.toThrow(/permission denied/)
      await expect(as("service_role", null, `select * from public.${table}`)).rejects.toThrow(/permission denied/)
    }
  })

  it("have no admin policies", async () => {
    const { rows } = await db.query<{ tablename: string; qual: string | null; with_check: string | null }>(
      "select tablename, qual, with_check from pg_policies where schemaname = 'public' and tablename = any($1)",
      [[...TABLES]]
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(`${row.qual ?? ""} ${row.with_check ?? ""}`).not.toMatch(/is_admin|aal/)
  })

  it("keep circle_contacts without grants or policies", async () => {
    const policies = await owner("select policyname from pg_policies where schemaname = 'public' and tablename = 'circle_contacts'")
    expect(policies).toEqual([])
    const grants = await owner(
      "select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'circle_contacts' and grantee in ('anon', 'authenticated', 'service_role')"
    )
    expect(grants).toEqual([])
  })
})

describe("circle functions", () => {
  it("are security definer with an empty search_path", async () => {
    const { rows } = await db.query<{ proname: string; prosecdef: boolean; proconfig: string[] }>(
      "select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1) order by 1",
      [[...FUNCTIONS]]
    )
    expect(rows.map((r) => r.proname).sort()).toEqual([...FUNCTIONS].sort())
    for (const row of rows) expect(row, row.proname).toMatchObject({ prosecdef: true, proconfig: ['search_path=""'] })
  })

  it("are not callable by anon or the secret key", async () => {
    for (const role of ["anon", "service_role"] as const) {
      await expect(as(role, null, "select * from public.create_circle('X', 'Y')")).rejects.toThrow(/permission denied/)
      await expect(as(role, null, "select public.circle_contact(gen_random_uuid(), gen_random_uuid())")).rejects.toThrow(/permission denied/)
      await expect(as(role, null, "select public.is_circle_member(gen_random_uuid())")).rejects.toThrow(/permission denied/)
    }
  })

  it("keep the invite helpers internal", async () => {
    await expect(user(OWNER, "select public.new_circle_invite_code()")).rejects.toThrow(/permission denied/)
    await expect(user(OWNER, "select public.circle_invite_hash('x')")).rejects.toThrow(/permission denied/)
  })
})

describe("create_circle()", () => {
  it("makes the caller the owner and returns a random code, storing only its hash", async () => {
    const created = await createCircle(OWNER, "  Manila money creators ", " Ana ")
    expect(created.invite_code).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const [circle] = await owner<{ name: string; created_by: string; invite_code_hash: string }>(
      "select name, created_by, invite_code_hash from public.circles where id = $1",
      [created.circle_id]
    )
    expect(circle).toEqual({ name: "Manila money creators", created_by: OWNER, invite_code_hash: sha256(created.invite_code) })
    // The plain code is nowhere in the circle's row.
    expect(JSON.stringify(await owner("select * from public.circles where id = $1", [created.circle_id]))).not.toContain(created.invite_code)
    expect(await owner("select user_id, display_name, role from public.circle_members where circle_id = $1", [created.circle_id])).toEqual([
      { user_id: OWNER, display_name: "Ana", role: "owner" },
    ])
    const other = await createCircle(OWNER, "Second", "Ana")
    expect(other.invite_code).not.toBe(created.invite_code)
    await user(OWNER, "select public.leave_circle($1)", [other.circle_id])
  })

  it("validates the names and needs a signed-in user", async () => {
    await expect(createCircle(OWNER, "   ", "Ana")).rejects.toThrow(/invalid_name/)
    await expect(createCircle(OWNER, "x".repeat(61), "Ana")).rejects.toThrow(/invalid_name/)
    await expect(createCircle(OWNER, "Ok", "")).rejects.toThrow(/invalid_display_name/)
    await expect(as("authenticated", null, "select * from public.create_circle('Ok', 'Ana')")).rejects.toThrow(/not_signed_in/)
  })

  it("stops at 10 circles per person", async () => {
    const ids: string[] = []
    for (let i = 0; i < 10; i++) ids.push((await createCircle(OUTSIDER, `Circle ${i}`, "Olly")).circle_id)
    await expect(createCircle(OUTSIDER, "One too many", "Olly")).rejects.toThrow(/too_many_circles/)
    for (const id of ids) expect(await user(OUTSIDER, "select public.leave_circle($1) as r", [id])).toEqual([{ r: "deleted" }])
    expect(await count("public.circle_members where user_id = $1", [OUTSIDER])).toBe(0)
  })
})

describe("joining, reading and the member cap", () => {
  let circle: string
  let code: string

  beforeAll(async () => {
    ;({ circle_id: circle, invite_code: code } = await createCircle(OWNER, "Barkada", "Ana"))
  })

  it("previews an invite without revealing members, check-ins or asks", async () => {
    expect(await user(MIKA, "select * from public.preview_invite($1)", [code])).toEqual([
      { circle_id: circle, name: "Barkada", members: 1, is_member: false, is_full: false },
    ])
    expect(await user(OWNER, "select is_member from public.preview_invite($1)", [code])).toEqual([{ is_member: true }])
    expect(await user(MIKA, "select * from public.preview_invite($1)", ["x".repeat(43)])).toEqual([])
    expect(await user(MIKA, "select * from public.preview_invite($1)", ["not a code"])).toEqual([])
  })

  it("rejects unknown codes", async () => {
    await expect(join(MIKA, "x".repeat(43), "Mika")).rejects.toThrow(/invalid_code/)
    await expect(join(MIKA, "", "Mika")).rejects.toThrow(/invalid_code/)
    await expect(join(MIKA, `${code}x`, "Mika")).rejects.toThrow(/invalid_code/)
  })

  it("joins with a valid code, once", async () => {
    await expect(join(MIKA, code, " ")).rejects.toThrow(/invalid_display_name/)
    expect(await join(MIKA, code, "Mika")).toEqual({ circle_id: circle, joined: true })
    expect(await join(MIKA, code, "Mika again")).toEqual({ circle_id: circle, joined: false })
    expect(await join(JUN, code, "Jun")).toEqual({ circle_id: circle, joined: true })
    expect(await count("public.circle_members where circle_id = $1", [circle])).toBe(3)
    expect(await owner("select role from public.circle_members where circle_id = $1 and user_id = $2", [circle, MIKA])).toEqual([{ role: "member" }])
  })

  it("lets members read their circle and its members, and nobody else", async () => {
    expect(await user(MIKA, "select id, name from public.circles")).toEqual([{ id: circle, name: "Barkada" }])
    expect((await user<{ display_name: string }>(JUN, "select display_name from public.circle_members order by display_name")).map((r) => r.display_name)).toEqual([
      "Ana",
      "Jun",
      "Mika",
    ])
    expect(await user(OUTSIDER, "select id from public.circles")).toEqual([])
    expect(await user(OUTSIDER, "select * from public.circle_members")).toEqual([])
    expect(await user(MIKA, "select public.is_circle_member($1) as v", [circle])).toEqual([{ v: true }])
    expect(await user(OUTSIDER, "select public.is_circle_member($1) as v", [circle])).toEqual([{ v: false }])
  })

  it("never shows members the invite hash", async () => {
    await expect(user(OWNER, "select invite_code_hash from public.circles")).rejects.toThrow(/permission denied/)
    await expect(user(OWNER, "select * from public.circles")).rejects.toThrow(/permission denied/)
  })

  it("doesn't let members add members, change roles or write circles directly", async () => {
    await expect(user(OUTSIDER, "insert into public.circle_members (circle_id, user_id, display_name) values ($1, $2, 'Me')", [circle, OUTSIDER])).rejects.toThrow(
      /permission denied/
    )
    await expect(user(MIKA, "update public.circle_members set role = 'owner' where user_id = $1", [MIKA])).rejects.toThrow(/permission denied/)
    await expect(user(MIKA, "delete from public.circle_members where user_id = $1", [JUN])).rejects.toThrow(/permission denied/)
    await expect(user(OWNER, "update public.circles set name = 'Renamed'")).rejects.toThrow(/permission denied/)
    await expect(user(OWNER, "insert into public.circles (name, invite_code_hash) values ('X', repeat('a', 64))")).rejects.toThrow(/permission denied/)
    await expect(user(OWNER, "delete from public.circles")).rejects.toThrow(/permission denied/)
  })

  it("lets each member rename only themselves", async () => {
    expect(await user(MIKA, "update public.circle_members set display_name = 'Mika R.' where circle_id = $1 returning user_id", [circle])).toEqual([
      { user_id: MIKA },
    ])
    expect(await owner("select display_name from public.circle_members where user_id = $1", [MIKA])).toEqual([{ display_name: "Mika R." }])
    expect(await owner("select display_name from public.circle_members where user_id = $1 and circle_id = $2", [JUN, circle])).toEqual([{ display_name: "Jun" }])
    await expect(user(MIKA, "update public.circle_members set display_name = '' where user_id = $1", [MIKA])).rejects.toThrow(/display_name_check/)
  })

  it("caps a circle at 8 members", async () => {
    const extra: string[] = []
    for (let i = 0; i < 6; i++) {
      const id = `e0000000-0000-4000-8000-00000000000${i}`
      await createAuthUser(db, { id, email: `extra${i}@example.com` })
      extra.push(id)
    }
    for (const id of extra.slice(0, 5)) expect((await join(id, code, "Extra")).joined).toBe(true)
    expect(await count("public.circle_members where circle_id = $1", [circle])).toBe(8)
    expect(await user(extra[5], "select is_full from public.preview_invite($1)", [code])).toEqual([{ is_full: true }])
    await expect(join(extra[5], code, "Ninth")).rejects.toThrow(/circle_full/)
    for (const id of extra) await owner("delete from auth.users where id = $1", [id])
    expect(await count("public.circle_members where circle_id = $1", [circle])).toBe(3)
  })

  it("rotates the invite (owner only): the old link stops working", async () => {
    await expect(user(MIKA, "select public.rotate_invite($1)", [circle])).rejects.toThrow(/not_owner/)
    await expect(user(OUTSIDER, "select public.rotate_invite($1)", [circle])).rejects.toThrow(/not_owner/)
    const [{ code: next }] = await user<{ code: string }>(OWNER, "select public.rotate_invite($1) as code", [circle])
    expect(next).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(next).not.toBe(code)
    await expect(join(OUTSIDER, code, "Olly")).rejects.toThrow(/invalid_code/)
    expect(await user(OUTSIDER, "select * from public.preview_invite($1)", [code])).toEqual([])
    expect(await owner("select invite_code_hash from public.circles where id = $1", [circle])).toEqual([{ invite_code_hash: sha256(next) }])
    code = next
  })

  describe("check-ins", () => {
    it("are written by each member for themselves, one per week", async () => {
      const week = await mondayOffset(0)
      await user(MIKA, "insert into public.circle_checkins (circle_id, week_start, posts, note) values ($1, $2, 3, 'Two Reels, one carousel')", [circle, week])
      // The app's upsert: the same week again updates the row.
      await user(
        MIKA,
        `insert into public.circle_checkins (circle_id, user_id, week_start, posts, note) values ($1, $2, $3, 4, 'Plus a Live')
         on conflict (circle_id, user_id, week_start) do update set posts = excluded.posts, note = excluded.note returning id`,
        [circle, MIKA, week]
      )
      expect(await user(JUN, "select user_id, week_start::text as week_start, posts, note from public.circle_checkins")).toEqual([
        { user_id: MIKA, week_start: week, posts: 4, note: "Plus a Live" },
      ])
      await expect(user(MIKA, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, 1)", [circle, week])).rejects.toThrow(
        /circle_checkins_week_key/
      )
    })

    it("can't be written for someone else, outside your circles, or outside this and last week", async () => {
      const week = await mondayOffset(0)
      await expect(user(MIKA, "insert into public.circle_checkins (circle_id, user_id, week_start, posts) values ($1, $2, $3, 9)", [circle, JUN, week])).rejects.toThrow(
        /row-level security/
      )
      await expect(user(OUTSIDER, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, 1)", [circle, week])).rejects.toThrow(
        /row-level security/
      )
      expect(await user(JUN, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, 2) returning posts", [circle, await mondayOffset(-1)])).toEqual([
        { posts: 2 },
      ])
      await expect(user(JUN, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, 2)", [circle, await mondayOffset(-2)])).rejects.toThrow(
        /row-level security/
      )
      // The policy ends at `current_date + 1`, so a client a day ahead of UTC can still check in for its own week.
      // Next Monday is inside that window when today is Sunday, so the "too far ahead" case uses the week after.
      await expect(user(JUN, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, 2)", [circle, await mondayOffset(2)])).rejects.toThrow(
        /row-level security/
      )
    })

    it("are updated only by their author", async () => {
      expect(await user(JUN, "update public.circle_checkins set posts = 0 where user_id = $1 returning id", [MIKA])).toEqual([])
      expect(await owner("select posts from public.circle_checkins where user_id = $1", [MIKA])).toEqual([{ posts: 4 }])
      expect(await user(MIKA, "update public.circle_checkins set posts = 5 where user_id = $1 returning posts", [MIKA])).toEqual([{ posts: 5 }])
      await expect(user(MIKA, "delete from public.circle_checkins")).rejects.toThrow(/permission denied/)
    })

    it("enforce the field rules", async () => {
      const week = await mondayOffset(0)
      await expect(user(OWNER, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, 51)", [circle, week])).rejects.toThrow(
        /circle_checkins_posts_check/
      )
      await expect(user(OWNER, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, -1)", [circle, week])).rejects.toThrow(
        /circle_checkins_posts_check/
      )
      await expect(
        user(OWNER, "insert into public.circle_checkins (circle_id, week_start, posts, note) values ($1, $2, 1, repeat('x', 281))", [circle, week])
      ).rejects.toThrow(/circle_checkins_note_check/)
      const wednesday = (await owner<{ d: string }>("select (date_trunc('week', current_date)::date + 2)::text as d"))[0].d
      await expect(user(OWNER, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, 1)", [circle, wednesday])).rejects.toThrow(
        /circle_checkins_week_start_check/
      )
      // A Sunday week start is fine (week_starts_on = 0).
      const sunday = (await owner<{ d: string }>("select (date_trunc('week', current_date)::date - 1)::text as d"))[0].d
      expect(await user(OWNER, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, 1) returning posts", [circle, sunday])).toEqual([
        { posts: 1 },
      ])
    })

    it("are invisible outside the circle", async () => {
      expect(await user(OUTSIDER, "select * from public.circle_checkins")).toEqual([])
    })
  })

  describe("asks, interests and contacts", () => {
    let ask: string

    it("lets members post asks as themselves only", async () => {
      ;[{ id: ask }] = await user<{ id: string }>(
        OWNER,
        "insert into public.circle_asks (circle_id, type, text) values ($1, 'joint_live', 'Joint Live on ipon tips for freelancers?') returning id",
        [circle]
      )
      await expect(user(MIKA, "insert into public.circle_asks (circle_id, user_id, type, text) values ($1, $2, 'other', 'x')", [circle, JUN])).rejects.toThrow(
        /row-level security/
      )
      await expect(user(OUTSIDER, "insert into public.circle_asks (circle_id, type, text) values ($1, 'other', 'x')", [circle])).rejects.toThrow(
        /row-level security/
      )
      await expect(user(MIKA, "insert into public.circle_asks (circle_id, type, text, status) values ($1, 'other', 'x', 'closed')", [circle])).rejects.toThrow(
        /row-level security/
      )
      await expect(user(MIKA, "insert into public.circle_asks (circle_id, type, text) values ($1, 'pods', 'x')", [circle])).rejects.toThrow(/circle_asks_type_check/)
      await expect(user(MIKA, "insert into public.circle_asks (circle_id, type, text) values ($1, 'other', '')", [circle])).rejects.toThrow(/circle_asks_text_check/)
      expect(await user(JUN, "select id, user_id, type, status from public.circle_asks")).toEqual([{ id: ask, user_id: OWNER, type: "joint_live", status: "open" }])
      expect(await user(OUTSIDER, "select * from public.circle_asks")).toEqual([])
    })

    it("accepts every collab type", async () => {
      for (const type of COLLAB_TYPE_IDS) {
        const [row] = await user<{ id: string }>(MIKA, "insert into public.circle_asks (circle_id, type, text) values ($1, $2, 'Type check') returning id", [circle, type])
        await owner("delete from public.circle_asks where id = $1", [row.id])
      }
    })

    it("lets only the author edit or close an ask", async () => {
      expect(await user(MIKA, "update public.circle_asks set status = 'closed' where id = $1 returning id", [ask])).toEqual([])
      await expect(user(OWNER, "update public.circle_asks set circle_id = gen_random_uuid() where id = $1", [ask])).rejects.toThrow(/permission denied/)
      await expect(user(OWNER, "delete from public.circle_asks where id = $1", [ask])).rejects.toThrow(/permission denied/)
      expect(await user(OWNER, "update public.circle_asks set text = 'Joint Live on ipon tips?' where id = $1 returning text", [ask])).toEqual([
        { text: "Joint Live on ipon tips?" },
      ])
    })

    it("lets other members say they're interested — not the author, not outsiders, never pre-accepted", async () => {
      await user(MIKA, "insert into public.circle_ask_interests (ask_id, circle_id) values ($1, $2)", [ask, circle])
      await user(JUN, "insert into public.circle_ask_interests (ask_id, circle_id) values ($1, $2)", [ask, circle])
      await expect(user(OWNER, "insert into public.circle_ask_interests (ask_id, circle_id) values ($1, $2)", [ask, circle])).rejects.toThrow(/row-level security/)
      await expect(user(OUTSIDER, "insert into public.circle_ask_interests (ask_id, circle_id) values ($1, $2)", [ask, circle])).rejects.toThrow(
        /row-level security/
      )
      await expect(
        user(MIKA, "insert into public.circle_ask_interests (ask_id, circle_id, user_id) values ($1, $2, $3)", [ask, circle, JUN])
      ).rejects.toThrow(/row-level security|duplicate key/)
      await expect(user(MIKA, "update public.circle_ask_interests set status = 'accepted' where user_id = $1", [MIKA])).rejects.toThrow(/permission denied/)
      expect(await user(OWNER, "select user_id, status from public.circle_ask_interests order by user_id")).toEqual([
        { user_id: MIKA, status: "pending" },
        { user_id: JUN, status: "pending" },
      ])
      expect(await user(OUTSIDER, "select * from public.circle_ask_interests")).toEqual([])
    })

    it("keeps interests in the ask's own circle", async () => {
      const other = await createCircle(MIKA, "Other circle", "Mika")
      const [{ id: junAsk }] = await user<{ id: string }>(JUN, "insert into public.circle_asks (circle_id, type, text) values ($1, 'other', 'Anyone?') returning id", [circle])
      // Mika is in both circles, but the interest must name the ask's own circle.
      await expect(
        user(MIKA, "insert into public.circle_ask_interests (ask_id, circle_id) values ($1, $2)", [junAsk, other.circle_id])
      ).rejects.toThrow(/circle_ask_interests_ask_fkey/)
      await owner("delete from public.circle_asks where id = $1", [junAsk])
      await user(MIKA, "select public.leave_circle($1)", [other.circle_id])
    })

    it("stores contacts only through set_circle_contact, and nobody can select them", async () => {
      await user(MIKA, "select public.set_circle_contact($1, $2)", [circle, "  @mika on IG "])
      await user(OWNER, "select public.set_circle_contact($1, $2)", [circle, "ana@example.com"])
      await user(JUN, "select public.set_circle_contact($1, $2)", [circle, "@jun.tiktok"])
      await expect(user(OUTSIDER, "select public.set_circle_contact($1, $2)", [circle, "@olly"])).rejects.toThrow(/not_member/)
      await expect(user(MIKA, "select public.set_circle_contact($1, $2)", [circle, "x".repeat(201)])).rejects.toThrow(/invalid_contact/)
      for (const who of [OWNER, MIKA, OUTSIDER]) {
        await expect(user(who, "select * from public.circle_contacts")).rejects.toThrow(/permission denied/)
        await expect(user(who, "insert into public.circle_contacts (circle_id, user_id, contact) values ($1, $2, 'x')", [circle, who])).rejects.toThrow(
          /permission denied/
        )
      }
      expect(await owner("select contact from public.circle_contacts where user_id = $1", [MIKA])).toEqual([{ contact: "@mika on IG" }])
    })

    it("shows you your own contact, and nobody else's before acceptance", async () => {
      const contact = (viewer: string, other: string) =>
        user<{ c: string | null }>(viewer, "select public.circle_contact($1, $2) as c", [circle, other]).then((r) => r[0].c)
      expect(await contact(MIKA, MIKA)).toBe("@mika on IG")
      expect(await contact(OWNER, MIKA)).toBeNull()
      expect(await contact(MIKA, OWNER)).toBeNull()
      expect(await contact(JUN, MIKA)).toBeNull()
      expect(await contact(OUTSIDER, MIKA)).toBeNull()
    })

    it("lets only the author accept an interest", async () => {
      await expect(user(MIKA, "select public.accept_interest($1, $2)", [ask, MIKA])).rejects.toThrow(/not_author/)
      await expect(user(JUN, "select public.accept_interest($1, $2)", [ask, MIKA])).rejects.toThrow(/not_author/)
      await expect(user(OWNER, "select public.accept_interest($1, $2)", [ask, OUTSIDER])).rejects.toThrow(/not_found/)
      await user(OWNER, "select public.accept_interest($1, $2)", [ask, MIKA])
      expect(await owner("select user_id, status from public.circle_ask_interests order by user_id")).toEqual([
        { user_id: MIKA, status: "accepted" },
        { user_id: JUN, status: "pending" },
      ])
    })

    it("reveals contacts to both sides of an accepted interest — and only to them", async () => {
      const contact = (viewer: string, other: string) =>
        user<{ c: string | null }>(viewer, "select public.circle_contact($1, $2) as c", [circle, other]).then((r) => r[0].c)
      expect(await contact(OWNER, MIKA)).toBe("@mika on IG")
      expect(await contact(MIKA, OWNER)).toBe("ana@example.com")
      // Jun's interest is still pending; Jun and Mika never linked.
      expect(await contact(OWNER, JUN)).toBeNull()
      expect(await contact(JUN, OWNER)).toBeNull()
      expect(await contact(JUN, MIKA)).toBeNull()
      expect(await contact(MIKA, JUN)).toBeNull()
      expect(await contact(OUTSIDER, MIKA)).toBeNull()
    })

    it("doesn't let an accepted interest be withdrawn, but a pending one can be", async () => {
      expect(await user(MIKA, "delete from public.circle_ask_interests where user_id = $1 returning user_id", [MIKA])).toEqual([])
      expect(await user(MIKA, "delete from public.circle_ask_interests where user_id = $1 returning user_id", [JUN])).toEqual([])
      expect(await user(JUN, "delete from public.circle_ask_interests where user_id = $1 returning user_id", [JUN])).toEqual([{ user_id: JUN }])
      await user(JUN, "insert into public.circle_ask_interests (ask_id, circle_id) values ($1, $2)", [ask, circle])
    })

    it("refuses interest in a closed ask", async () => {
      await user(OWNER, "update public.circle_asks set status = 'closed' where id = $1", [ask])
      await user(JUN, "delete from public.circle_ask_interests where ask_id = $1 and user_id = $2", [ask, JUN])
      await expect(user(JUN, "insert into public.circle_ask_interests (ask_id, circle_id) values ($1, $2)", [ask, circle])).rejects.toThrow(/row-level security/)
    })

    it("clears a contact when it's saved empty", async () => {
      await user(JUN, "select public.set_circle_contact($1, $2)", [circle, "   "])
      expect(await count("public.circle_contacts where user_id = $1", [JUN])).toBe(0)
      await user(JUN, "select public.set_circle_contact($1, $2)", [circle, "@jun.tiktok"])
    })
  })

  describe("removing and leaving", () => {
    it("lets only the owner remove members, never the owner", async () => {
      await expect(user(MIKA, "select public.remove_member($1, $2)", [circle, JUN])).rejects.toThrow(/not_owner/)
      await expect(user(OUTSIDER, "select public.remove_member($1, $2)", [circle, JUN])).rejects.toThrow(/not_owner/)
      await expect(user(OWNER, "select public.remove_member($1, $2)", [circle, OWNER])).rejects.toThrow(/last_owner/)
      await expect(user(OWNER, "select public.remove_member($1, $2)", [circle, OUTSIDER])).rejects.toThrow(/not_member/)
    })

    it("removes everything the removed member wrote in the circle", async () => {
      const [{ id: junAsk }] = await user<{ id: string }>(JUN, "insert into public.circle_asks (circle_id, type, text) values ($1, 'giveaway', 'Giveaway?') returning id", [circle])
      await user(MIKA, "insert into public.circle_ask_interests (ask_id, circle_id) values ($1, $2)", [junAsk, circle])
      await user(OWNER, "select public.remove_member($1, $2)", [circle, JUN])
      expect(await count("public.circle_members where user_id = $1", [JUN])).toBe(0)
      expect(await count("public.circle_checkins where user_id = $1", [JUN])).toBe(0)
      expect(await count("public.circle_asks where user_id = $1", [JUN])).toBe(0)
      expect(await count("public.circle_ask_interests where ask_id = $1", [junAsk])).toBe(0)
      expect(await count("public.circle_contacts where user_id = $1", [JUN])).toBe(0)
      expect(await user(JUN, "select id from public.circles")).toEqual([])
      // Removed members can come back only with the current link.
      expect((await join(JUN, code, "Jun")).joined).toBe(true)
    })

    it("hands the circle to the longest-standing member when the owner leaves", async () => {
      expect(await user(OWNER, "select public.leave_circle($1) as r", [circle])).toEqual([{ r: "left" }])
      expect(await owner("select user_id, role from public.circle_members where circle_id = $1 order by joined_at", [circle])).toEqual([
        { user_id: MIKA, role: "owner" },
        { user_id: JUN, role: "member" },
      ])
      // The old owner's ask, the accepted interest and their contact are gone; Mika's contact is readable by nobody else now.
      expect(await count("public.circle_asks where circle_id = $1", [circle])).toBe(0)
      expect(await user<{ c: string | null }>(OWNER, "select public.circle_contact($1, $2) as c", [circle, MIKA])).toEqual([{ c: null }])
      await expect(user(OWNER, "select public.leave_circle($1)", [circle])).rejects.toThrow(/not_member/)
    })

    it("deletes the circle when the last member leaves", async () => {
      expect(await user(JUN, "select public.leave_circle($1) as r", [circle])).toEqual([{ r: "left" }])
      expect(await user(MIKA, "select public.leave_circle($1) as r", [circle])).toEqual([{ r: "deleted" }])
      expect(await count("public.circles where id = $1", [circle])).toBe(0)
      expect(await count("public.circle_checkins where circle_id = $1", [circle])).toBe(0)
      expect(await count("public.circle_contacts where circle_id = $1", [circle])).toBe(0)
    })
  })
})

describe("account deletion", () => {
  it("removes memberships, hands owned circles over and keeps the circle for the others", async () => {
    const leaver = "f0000000-0000-4000-8000-0000000000f1"
    await createAuthUser(db, { id: leaver, email: "leaver@example.com" })
    const { circle_id, invite_code } = await createCircle(leaver, "Soon without me", "Lea")
    await join(MIKA, invite_code, "Mika")
    await user(leaver, "select public.set_circle_contact($1, 'lea@example.com')", [circle_id])
    await user(leaver, "insert into public.circle_checkins (circle_id, week_start, posts) values ($1, $2, 2)", [circle_id, await mondayOffset(0)])

    await owner("delete from auth.users where id = $1", [leaver])
    expect(await owner("select user_id, role from public.circle_members where circle_id = $1", [circle_id])).toEqual([{ user_id: MIKA, role: "owner" }])
    expect(await owner("select created_by from public.circles where id = $1", [circle_id])).toEqual([{ created_by: null }])
    expect(await count("public.circle_contacts where user_id = $1", [leaver])).toBe(0)
    expect(await count("public.circle_checkins where user_id = $1", [leaver])).toBe(0)
    await user(MIKA, "select public.leave_circle($1)", [circle_id])
  })

  it("deletes a circle whose only member deleted their account", async () => {
    const solo = "f0000000-0000-4000-8000-0000000000f2"
    await createAuthUser(db, { id: solo, email: "solo@example.com" })
    const { circle_id } = await createCircle(solo, "Just me", "Solo")
    await owner("delete from auth.users where id = $1", [solo])
    expect(await count("public.circles where id = $1", [circle_id])).toBe(0)
  })
})
