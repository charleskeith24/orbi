/** `public.ai_keys` (20260926000000_ai_keys.sql) on Postgres: server only, one key per account, gone with it. */
import type { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createAuthUser, createSupabaseTestDb, readMigrations, withRole, type RequestRole } from "@/lib/supabase/testing/pglite"

const A = "a1000000-0000-4000-8000-0000000000a1"
const B = "b1000000-0000-4000-8000-0000000000b2"
let db: PGlite

const as = (role: RequestRole, user: string | null, sql: string, params: unknown[] = []) =>
  withRole(db, role, user, async (tx) => (await tx.query(sql, params)).rows)

const insertKey = (user: string, provider = "gemini", ciphertext = "v1.aXY.Ym9keQ.dGFn") =>
  as("service_role", null, "insert into public.ai_keys (user_id, provider, model, key_hint, key_ciphertext) values ($1, $2, 'gemini-2.5-flash', 'abcd', $3)", [user, provider, ciphertext])

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  await createAuthUser(db, { id: A, email: "a@example.com" })
  await createAuthUser(db, { id: B, email: "b@example.com" })
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe("ai_keys", () => {
  it("lets the server store, read, change and forget a key", async () => {
    await insertKey(A)
    expect(await as("service_role", null, "select provider, model, key_hint from public.ai_keys where user_id = $1", [A])).toEqual([
      { provider: "gemini", model: "gemini-2.5-flash", key_hint: "abcd" },
    ])
    await as("service_role", null, "update public.ai_keys set model = 'gemini-2.5-pro' where user_id = $1", [A])
    await as("service_role", null, "delete from public.ai_keys where user_id = $1", [A])
    expect(await as("service_role", null, "select 1 from public.ai_keys where user_id = $1", [A])).toEqual([])
  })

  it("keeps every signed-in person out — even of their own row", async () => {
    await insertKey(A)
    for (const [role, user] of [["authenticated", A], ["authenticated", B], ["anon", null]] as const) {
      await expect(as(role, user, "select key_ciphertext from public.ai_keys")).rejects.toThrow(/permission denied/)
      await expect(as(role, user, "select key_hint from public.ai_keys where user_id = $1", [A])).rejects.toThrow(/permission denied/)
      await expect(as(role, user, "delete from public.ai_keys where user_id = $1", [A])).rejects.toThrow(/permission denied/)
    }
    await expect(
      as("authenticated", B, "insert into public.ai_keys (user_id, provider, model, key_ciphertext) values ($1, 'openai', 'gpt-5', 'v1.x.y.z')", [B])
    ).rejects.toThrow(/permission denied/)
    await as("service_role", null, "delete from public.ai_keys where user_id = $1", [A])
  })

  it("holds one key per account, from a known provider, in the encrypted format", async () => {
    await insertKey(B)
    await expect(insertKey(B)).rejects.toThrow(/duplicate key|ai_keys_pkey/)
    await expect(insertKey(A, "mistral")).rejects.toThrow(/check constraint/)
    await expect(insertKey(A, "openai", "sk-plain-text-key")).rejects.toThrow(/check constraint/)
    await as("service_role", null, "delete from public.ai_keys where user_id = $1", [B])
  })

  it("keeps the server's access when the server-grants migration runs again later", async () => {
    const grants = readMigrations().find((m) => m.file === "20260925000000_server_grants.sql")!
    await db.exec(grants.sql)
    await insertKey(A)
    expect(await as("service_role", null, "select provider from public.ai_keys where user_id = $1", [A])).toEqual([{ provider: "gemini" }])
    await as("service_role", null, "delete from public.ai_keys where user_id = $1", [A])
  })

  it("stamps updated_at and goes away with the account", async () => {
    await insertKey(B)
    await db.exec(`update public.ai_keys set updated_at = now() - interval '1 day' where user_id = '${B}'`)
    await as("service_role", null, "update public.ai_keys set model = 'gemini-2.5-pro' where user_id = $1", [B])
    const [row] = (await as("service_role", null, "select updated_at > now() - interval '1 minute' as fresh from public.ai_keys where user_id = $1", [B])) as { fresh: boolean }[]
    expect(row.fresh).toBe(true)
    await db.exec(`delete from auth.users where id = '${B}'`)
    expect(await as("service_role", null, "select 1 from public.ai_keys where user_id = $1", [B])).toEqual([])
  })
})
