/**
 * The browser implementation (`supabase-api.ts`) end to end against the real migrations in PGlite: table reads
 * and writes through the PostgREST-like stand-in (src/lib/circles/testing/pglite-client.ts) and Storage through
 * src/lib/profiles/testing/pglite-storage.ts — so every call is decided by row-level security and the avatars
 * bucket's policies, as in production.
 */
import type { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createPgliteSupabaseWithStorage } from "@/lib/profiles/testing/pglite-storage"
import type { EncodedPhoto, ProfilesApi } from "@/lib/profiles/types"
import { createAuthUser, createSupabaseTestDb } from "@/lib/supabase/testing/pglite"
import { createSupabaseProfilesApi, MY_PROFILE_COLUMNS } from "./supabase-api"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 })

const ANA = "a0000000-0000-4000-8000-0000000000a1"
const MIKA = "b0000000-0000-4000-8000-0000000000b1"
const OLLY = "d0000000-0000-4000-8000-0000000000d1"

let db: PGlite
let ana: ProfilesApi
let mika: ProfilesApi
let olly: ProfilesApi

const webp = (bytes = 3_000): EncodedPhoto => {
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/webp" })
  return { blob, type: "image/webp", size: blob.size }
}
const objects = async (folder: string) =>
  (await db.query<{ name: string }>("select name from storage.objects where bucket_id = 'avatars' and name like $1 order by name", [`${folder}/%`])).rows.map((r) => r.name)

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  await createAuthUser(db, { id: ANA, email: "ana@example.com", fullName: "Ana" })
  await createAuthUser(db, { id: MIKA, email: "mika@example.com" })
  await createAuthUser(db, { id: OLLY, email: "olly@example.com" })
  const client = (id: string) => createSupabaseProfilesApi(createPgliteSupabaseWithStorage(db, id), id, { now: () => 1_000_000 })
  ana = client(ANA)
  mika = client(MIKA)
  olly = client(OLLY)
  // Ana and Mika share a circle; Olly doesn't.
  const anaDb = createPgliteSupabaseWithStorage(db, ANA)
  const { data } = (await anaDb.rpc("create_circle", { p_name: "Barkada", p_display_name: "Ana" })) as { data: { invite_code: string }[] }
  await createPgliteSupabaseWithStorage(db, MIKA).rpc("join_circle", { p_code: data[0].invite_code, p_display_name: "Mika" })
}, 180_000)

afterAll(async () => {
  await db?.close()
})

describe("createSupabaseProfilesApi against the migration", () => {
  it("never selects the email", () => {
    expect(MY_PROFILE_COLUMNS.split(",").map((c) => c.trim())).not.toContain("email")
  })

  it("reads and saves your own profile", async () => {
    expect(await ana.getMyProfile()).toEqual({ id: ANA, display_name: "Ana", avatar_path: null, headline: "", location: "", links: [], show_niche: false })
    const saved = await ana.updateMyProfile({
      display_name: "Ana Reyes",
      headline: "Budget travel for students",
      location: "Cebu City",
      links: [{ platform: "instagram", value: "ana.travels" }],
    })
    expect(saved).toMatchObject({ display_name: "Ana Reyes", headline: "Budget travel for students", links: [{ platform: "instagram", value: "ana.travels" }] })
    await expect(ana.updateMyProfile({ headline: "h".repeat(161) })).rejects.toMatchObject({ code: "invalid" })
  })

  it("uploads a photo into your own folder and replaces it cleanly", async () => {
    const first = await ana.setPhoto(webp())
    expect(first.avatar_path).toMatch(new RegExp(`^${ANA}/[0-9a-f]{32}\\.webp$`))
    expect(await objects(ANA)).toEqual([first.avatar_path])
    const second = await ana.setPhoto(webp(4_000))
    expect(second.avatar_path).not.toBe(first.avatar_path)
    // The old file is deleted with the change.
    expect(await objects(ANA)).toEqual([second.avatar_path])
  })

  it("refuses a file over the bucket's limit, leaving the profile as it was", async () => {
    const before = await ana.getMyProfile()
    await expect(ana.setPhoto(webp(1_100_000))).rejects.toMatchObject({ code: "invalid" })
    expect(await ana.getMyProfile()).toEqual(before)
    expect(await objects(ANA)).toEqual([before.avatar_path])
  })

  it("shows the profile and photo to a circle-mate, and nothing to a stranger", async () => {
    const me = await ana.getMyProfile()
    const [seen] = await mika.getProfiles([ANA, OLLY])
    expect(seen).toMatchObject({ id: ANA, display_name: "Ana Reyes", avatar_path: me.avatar_path, headline: "Budget travel for students" })
    expect(JSON.stringify(seen)).not.toContain("@example.com")
    expect(await mika.photoUrls([me.avatar_path!])).toEqual({
      [me.avatar_path!]: { url: expect.stringContaining(`/object/sign/avatars/${me.avatar_path}`), expiresAt: 1_000_000 + 3_600_000 },
    })
    expect(await olly.getProfiles([ANA, MIKA])).toEqual([])
    expect(await olly.photoUrls([me.avatar_path!])).toEqual({})
  })

  it("never lets someone else write into your folder", async () => {
    const storage = createPgliteSupabaseWithStorage(db, MIKA).storage.from("avatars")
    const { error } = await storage.upload(`${ANA}/${"f".repeat(32)}.webp`, new Blob([new Uint8Array(10)], { type: "image/webp" }), { contentType: "image/webp" })
    expect(error).toMatchObject({ message: expect.stringMatching(/row-level security/) })
    const me = await ana.getMyProfile()
    expect(await createPgliteSupabaseWithStorage(db, MIKA).storage.from("avatars").remove([me.avatar_path!])).toMatchObject({ data: [] })
    expect(await objects(ANA)).toEqual([me.avatar_path])
  })

  it("removes the photo: back to initials, and the file is deleted", async () => {
    const removed = await ana.removePhoto()
    expect(removed.avatar_path).toBeNull()
    expect(await objects(ANA)).toEqual([])
    expect(await mika.getProfiles([ANA])).toMatchObject([{ avatar_path: null }])
  })
})
