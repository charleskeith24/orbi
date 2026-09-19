import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import { IS_ADMIN_CACHE_KEY, resolveIsAdmin } from "./use-is-admin"

function fake(rpc: () => Promise<{ data: unknown; error: unknown }>, userId: string | null = "u1") {
  const client = {
    auth: { getSession: vi.fn(async () => ({ data: { session: userId ? { user: { id: userId } } : null } })) },
    rpc: vi.fn(rpc),
  }
  return client as unknown as SupabaseClient & { rpc: ReturnType<typeof vi.fn> }
}

function memoryStorage() {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map }
}

describe("resolveIsAdmin", () => {
  it("asks is_admin() once per session and caches the answer per user", async () => {
    const storage = memoryStorage()
    const supabase = fake(async () => ({ data: true, error: null }))
    expect(await resolveIsAdmin(supabase, storage)).toBe(true)
    expect(await resolveIsAdmin(supabase, storage)).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storage.map.get(IS_ADMIN_CACHE_KEY)!)).toEqual({ u: "u1", a: true })
    // Another account in the same tab asks again.
    const other = fake(async () => ({ data: false, error: null }), "u2")
    expect(await resolveIsAdmin(other, storage)).toBe(false)
    expect(other.rpc).toHaveBeenCalledTimes(1)
  })

  it("treats errors and signed-out sessions as not admin, without caching", async () => {
    const storage = memoryStorage()
    const failing = fake(async () => ({ data: null, error: { message: "permission denied" } }))
    expect(await resolveIsAdmin(failing, storage)).toBe(false)
    expect(storage.map.size).toBe(0)
    const signedOut = fake(async () => ({ data: true, error: null }), null)
    expect(await resolveIsAdmin(signedOut, storage)).toBe(false)
    expect(signedOut.rpc).not.toHaveBeenCalled()
  })
})
