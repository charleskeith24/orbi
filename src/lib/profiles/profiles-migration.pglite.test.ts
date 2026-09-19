/**
 * supabase/migrations/20260920000000_profiles.sql on a real Postgres engine (PGlite), on top of every earlier
 * migration and the stubs of Supabase's auth and storage schemas (src/lib/supabase/testing/pglite.ts).
 *
 * Proves the privacy rules that live in the database (docs/PROFILES.md): only the owner reads public.users
 * (it holds the email); get_profiles() returns the safe columns for yourself and circle-mates and nothing for
 * anyone else, never the email, and the niche only when opted in; the CHECK limits; and the avatars bucket's
 * storage policies (write in your own folder, read yourself and connected people).
 * Not proven here: the Storage API itself (file bytes, size and mime limits, signed URLs).
 */
import type { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createAuthUser, createSupabaseTestDb, type RequestRole } from "@/lib/supabase/testing/pglite"
import { isStoredLinks } from "./links"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 })

const ANA = "a0000000-0000-4000-8000-0000000000a1"
const MIKA = "b0000000-0000-4000-8000-0000000000b1"
const JUN = "c0000000-0000-4000-8000-0000000000c1"
const STRANGER = "d0000000-0000-4000-8000-0000000000d1"

const photo = (userId: string, name = "0123456789abcdef0123456789abcdef") => `${userId}/${name}.webp`

let db: PGlite
let circleId: string

async function as<T = Record<string, unknown>>(role: RequestRole, userId: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    const jwt = JSON.stringify({ ...(userId ? { sub: userId } : {}), role })
    await tx.query("select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)", [role, jwt])
    return (await tx.query<T>(sql, params)).rows
  })
}
const user = <T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []) => as<T>("authenticated", userId, sql, params)
/** The migration owner (the SQL editor): sees everything, for setup and assertions. */
const owner = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows
const profilesFor = (viewer: string, ids: string[]) => user(viewer, "select * from public.get_profiles($1::uuid[])", [ids])

beforeAll(async () => {
  ;({ db } = await createSupabaseTestDb())
  await createAuthUser(db, { id: ANA, email: "ana@example.com", fullName: "Ana Reyes" })
  await createAuthUser(db, { id: MIKA, email: "mika@example.com", fullName: "Mika" })
  await createAuthUser(db, { id: JUN, email: "jun@example.com" })
  await createAuthUser(db, { id: STRANGER, email: "stranger@example.com", fullName: "Stranger" })
  // Ana and Mika share a circle; Jun and the stranger don't share one with anybody (yet).
  const [created] = await user<{ circle_id: string; invite_code: string }>(ANA, "select * from public.create_circle('Barkada', 'Ana')")
  circleId = created.circle_id
  await user(MIKA, "select * from public.join_circle($1, 'Mika')", [created.invite_code])
  // Brand HQ rows, for the opt-in niche.
  await owner("insert into public.brand_profiles (user_id, name, niche, main_platforms) values ($1, 'Ana', 'Budget travel for Filipino students', '{tiktok,instagram}')", [ANA])
  await owner("insert into public.brand_profiles (user_id, name, niche, main_platforms) values ($1, 'Mika', 'Ipon tips for first-jobbers', '{youtube}')", [MIKA])
}, 180_000)

afterAll(async () => {
  await db?.close()
})

describe("public.users: only its owner reads it", () => {
  it("shows each person only their own row (it holds the email)", async () => {
    expect(await user(ANA, "select id, email from public.users")).toEqual([{ id: ANA, email: "ana@example.com" }])
    expect(await user(MIKA, "select id from public.users where id = $1", [ANA])).toEqual([])
    expect(await user(STRANGER, "select count(*)::int as n from public.users")).toEqual([{ n: 1 }])
    await expect(as("anon", null, "select * from public.users")).rejects.toThrow(/permission denied/)
  })

  it("adds the profile columns with empty defaults", async () => {
    expect(await owner("select full_name, avatar_url, headline, location, links, show_niche from public.users where id = $1", [JUN])).toEqual([
      { full_name: "", avatar_url: null, headline: "", location: "", links: [], show_niche: false },
    ])
  })

  it("lets people update their own profile columns, never someone else's row or their email", async () => {
    const links = [
      { platform: "tiktok", value: "ana.travels" },
      { platform: "website", value: "https://ana.example.com" },
    ]
    expect(
      await user(
        ANA,
        "update public.users set headline = $1, location = 'Cebu City', links = $2::jsonb, show_niche = true, avatar_url = $3 where id = $4 returning id",
        ["Budget travel for students", JSON.stringify(links), photo(ANA), ANA]
      )
    ).toEqual([{ id: ANA }])
    expect(await owner("select headline, location, links, show_niche, avatar_url from public.users where id = $1", [ANA])).toEqual([
      { headline: "Budget travel for students", location: "Cebu City", links, show_niche: true, avatar_url: photo(ANA) },
    ])
    // Someone else's row: invisible, so nothing changes.
    expect(await user(STRANGER, "update public.users set headline = 'hacked' where id = $1 returning id", [ANA])).toEqual([])
    expect(await owner("select headline from public.users where id = $1", [ANA])).toEqual([{ headline: "Budget travel for students" }])
    // Email and id are not profile columns.
    await expect(user(ANA, "update public.users set email = 'other@example.com' where id = $1", [ANA])).rejects.toThrow(/permission denied/)
    await expect(user(ANA, "update public.users set id = $1 where id = $2", [STRANGER, ANA])).rejects.toThrow(/permission denied/)
  })
})

describe("public.users: CHECK limits", () => {
  const update = (sql: string, params: unknown[] = []) => user(JUN, `update public.users set ${sql} where id = '${JUN}'`, params)

  it("limits the display name to one trimmed line of 80 characters", async () => {
    await update("full_name = $1", ["x".repeat(80)])
    await expect(update("full_name = $1", ["x".repeat(81)])).rejects.toThrow(/users_full_name_check/)
    await expect(update("full_name = $1", [" Jun"])).rejects.toThrow(/users_full_name_check/)
    await expect(update("full_name = $1", ["Jun\nDela Cruz"])).rejects.toThrow(/users_full_name_check/)
    await update("full_name = 'Jun'")
  })

  it("limits the headline to 160 and the location to 80 characters, one line each", async () => {
    await update("headline = $1, location = $2", ["h".repeat(160), "l".repeat(80)])
    await expect(update("headline = $1", ["h".repeat(161)])).rejects.toThrow(/users_headline_check/)
    await expect(update("headline = $1", ["two\nlines"])).rejects.toThrow(/users_headline_check/)
    await expect(update("headline = $1", ["trailing "])).rejects.toThrow(/users_headline_check/)
    await expect(update("location = $1", ["l".repeat(81)])).rejects.toThrow(/users_location_check/)
    await expect(update("location = $1", ["Quezon\tCity"])).rejects.toThrow(/users_location_check/)
    await update("headline = '', location = ''")
  })

  it("accepts up to 6 valid links and rejects everything else", async () => {
    const ok = [
      { platform: "instagram", value: "jun.dc" },
      { platform: "youtube", value: "https://www.youtube.com/@jundc" },
      { platform: "x", value: "jun_dc" },
      { platform: "linkedin", value: "jun-dela-cruz" },
      { platform: "facebook", value: "https://facebook.com/profile.php?id=123" },
      { platform: "website", value: "http://jun.example.com/about" },
    ]
    await update("links = $1::jsonb", [JSON.stringify(ok)])
    const bad: unknown[] = [
      [...ok, { platform: "threads", value: "jun" }], // 7 entries
      { platform: "x", value: "jun" }, // not an array
      [{ platform: "myspace", value: "jun" }], // unknown platform
      [{ platform: "website", value: "jun.example.com" }], // a website needs a URL
      [{ platform: "x", value: "@jun" }], // handles are stored without "@"
      [{ platform: "x", value: "jun dc" }], // spaces
      [{ platform: "x", value: "j".repeat(65) }], // handle too long
      [{ platform: "website", value: `https://example.com/${"a".repeat(190)}` }], // URL too long
      [{ platform: "website", value: "javascript:alert(1)" }], // not http(s)
      [{ platform: "tiktok", value: "https://tiktok.com/@jun <script>" }], // spaces and brackets
      [{ platform: "x", value: "jun", note: "extra key" }],
      [{ platform: "x" }],
      [{ platform: "x", value: 42 }],
      ["jun"],
    ]
    for (const links of bad) {
      await expect(update("links = $1::jsonb", [JSON.stringify(links)]), JSON.stringify(links)).rejects.toThrow(/users_links_check/)
    }
    await update("links = '[]'::jsonb")
  })

  it("agrees with the app's link rules (src/lib/profiles/links.ts)", async () => {
    const values = [
      "ana",
      "ana.travels",
      "@ana",
      "a b",
      "j".repeat(64),
      "j".repeat(65),
      "https://x.com/ana",
      "http://ana.example.com/about?x=1",
      "HTTPS://x.com/ana",
      "ftp://x.com/ana",
      "javascript:alert(1)",
      `https://example.com/${"a".repeat(180)}`,
      `https://example.com/${"a".repeat(181)}`,
      'https://x.com/"ana"',
      "https://x.com/<b>",
      "",
    ]
    for (const platform of ["x", "website"] as const) {
      for (const value of values) {
        const links = [{ platform, value }]
        const [{ v }] = await owner<{ v: boolean }>("select public.profile_links_valid($1::jsonb) as v", [JSON.stringify(links)])
        expect(isStoredLinks(links), `${platform}: ${value}`).toBe(v)
      }
    }
  })

  it("stores only a photo path inside the person's own avatars folder", async () => {
    await update("avatar_url = $1", [photo(JUN)])
    await update("avatar_url = $1", [`${JUN}/0123456789abcdef.jpg`])
    for (const bad of [photo(ANA), "https://example.com/me.png", `${JUN}/short.webp`, `${JUN}/0123456789abcdef.png`, `${JUN}/../0123456789abcdef.webp`]) {
      await expect(update("avatar_url = $1", [bad]), bad).rejects.toThrow(/users_avatar_url_check/)
    }
    await update("avatar_url = null")
  })
})

describe("the sign-up triggers", () => {
  it("clean the display name and never take a photo from sign-up metadata", async () => {
    const id = "e0000000-0000-4000-8000-0000000000e1"
    await owner("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'long@example.com', $2::jsonb)", [
      id,
      JSON.stringify({ full_name: `  ${"N".repeat(100)}\n`, avatar_url: "https://images.example.com/me.png" }),
    ])
    expect(await owner("select full_name, avatar_url from public.users where id = $1", [id])).toEqual([{ full_name: "N".repeat(80), avatar_url: null }])
    await owner("delete from auth.users where id = $1", [id])
  })

  it("keep a display name the person set, filling it from metadata only while empty", async () => {
    const id = "e0000000-0000-4000-8000-0000000000e2"
    await owner("insert into auth.users (id, email) values ($1, 'late@example.com')", [id])
    await owner("update auth.users set raw_user_meta_data = $2::jsonb where id = $1", [id, JSON.stringify({ full_name: "From metadata" })])
    expect(await owner("select full_name from public.users where id = $1", [id])).toEqual([{ full_name: "From metadata" }])
    await as("authenticated", id, "update public.users set full_name = 'My own name' where id = $1", [id])
    await owner("update auth.users set email = 'late2@example.com', raw_user_meta_data = $2::jsonb where id = $1", [id, JSON.stringify({ full_name: "Other", avatar_url: "https://x.example/p.png" })])
    expect(await owner("select email, full_name, avatar_url from public.users where id = $1", [id])).toEqual([
      { email: "late2@example.com", full_name: "My own name", avatar_url: null },
    ])
    await owner("delete from auth.users where id = $1", [id])
  })
})

describe("get_profiles()", () => {
  it("is security definer with an empty search_path, callable only by signed-in users", async () => {
    const rows = await owner<{ proname: string; prosecdef: boolean; proconfig: string[] }>(
      "select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname in ('get_profiles', 'can_see_profile') order by 1"
    )
    expect(rows).toEqual([
      { proname: "can_see_profile", prosecdef: true, proconfig: ['search_path=""'] },
      { proname: "get_profiles", prosecdef: true, proconfig: ['search_path=""'] },
    ])
    for (const role of ["anon", "service_role"] as const) {
      await expect(as(role, null, "select * from public.get_profiles(array[$1]::uuid[])", [ANA])).rejects.toThrow(/permission denied/)
      await expect(as(role, null, "select public.can_see_profile($1)", [ANA])).rejects.toThrow(/permission denied/)
    }
  })

  it("returns your own profile's safe fields — never the email", async () => {
    const [self] = await profilesFor(ANA, [ANA])
    expect(self).toEqual({
      id: ANA,
      display_name: "Ana Reyes",
      avatar_path: photo(ANA),
      headline: "Budget travel for students",
      location: "Cebu City",
      links: [
        { platform: "tiktok", value: "ana.travels" },
        { platform: "website", value: "https://ana.example.com" },
      ],
      niche: "Budget travel for Filipino students",
      main_platform: "tiktok",
    })
    expect(Object.keys(self)).not.toContain("email")
    expect(JSON.stringify(self)).not.toContain("@example.com")
  })

  it("returns a circle-mate's profile, with the niche only when they opted in", async () => {
    await user(MIKA, "update public.users set headline = 'Ipon tips', location = 'Pasig' where id = $1", [MIKA])
    expect(await profilesFor(ANA, [MIKA])).toEqual([
      { id: MIKA, display_name: "Mika", avatar_path: null, headline: "Ipon tips", location: "Pasig", links: [], niche: null, main_platform: null },
    ])
    const [ana] = await profilesFor(MIKA, [ANA])
    expect(ana).toMatchObject({ id: ANA, display_name: "Ana Reyes", niche: "Budget travel for Filipino students", main_platform: "tiktok" })
    await user(ANA, "update public.users set show_niche = false where id = $1", [ANA])
    expect(await profilesFor(MIKA, [ANA])).toMatchObject([{ niche: null, main_platform: null }])
    await user(ANA, "update public.users set show_niche = true where id = $1", [ANA])
  })

  it("returns nothing for people you're not connected to, in either direction", async () => {
    expect(await profilesFor(STRANGER, [ANA, MIKA, JUN])).toEqual([])
    expect(await profilesFor(ANA, [STRANGER, JUN])).toEqual([])
    // Mixed: only the connected ids come back.
    expect((await profilesFor(ANA, [ANA, MIKA, JUN, STRANGER])).map((r) => r.id)).toEqual([ANA, MIKA])
    expect(await user(STRANGER, "select public.can_see_profile($1) as v", [ANA])).toEqual([{ v: false }])
    expect(await user(MIKA, "select public.can_see_profile($1) as v", [ANA])).toEqual([{ v: true }])
    expect(await as("authenticated", null, "select * from public.get_profiles(array[$1]::uuid[])", [ANA])).toEqual([])
  })

  it("never returns the email, whatever is asked", async () => {
    const all = await profilesFor(ANA, [ANA, MIKA, JUN, STRANGER])
    expect(JSON.stringify(all)).not.toMatch(/@example\.com/)
    const columns = await owner<{ name: string }>(
      "select unnest(proargnames) as name from pg_proc where proname = 'get_profiles' and pronamespace = 'public'::regnamespace"
    )
    expect(columns.map((c) => c.name)).not.toContain("email")
  })

  it("stops showing a profile as soon as the circle is left", async () => {
    const [created] = await user<{ circle_id: string; invite_code: string }>(JUN, "select * from public.create_circle('Pair', 'Jun')")
    await user(STRANGER, "select * from public.join_circle($1, 'S')", [created.invite_code])
    expect((await profilesFor(JUN, [STRANGER])).map((r) => r.id)).toEqual([STRANGER])
    await user(STRANGER, "select public.leave_circle($1)", [created.circle_id])
    expect(await profilesFor(JUN, [STRANGER])).toEqual([])
    expect(await profilesFor(STRANGER, [JUN])).toEqual([])
    await user(JUN, "select public.leave_circle($1)", [created.circle_id])
  })

  it("ignores more than 200 ids and an empty or null list", async () => {
    const many = Array.from({ length: 250 }, (_, i) => `f0000000-0000-4000-8000-${String(i).padStart(12, "0")}`)
    expect(await profilesFor(ANA, [...many, ANA])).toEqual([])
    expect((await profilesFor(ANA, [ANA, ...many])).map((r) => r.id)).toEqual([ANA])
    expect(await profilesFor(ANA, [])).toEqual([])
    expect(await user(ANA, "select * from public.get_profiles(null)")).toEqual([])
  })
})

describe("storage: the private avatars bucket", () => {
  const insert = (userId: string, name: string, bucket = "avatars") =>
    user(userId, "insert into storage.objects (bucket_id, name, owner_id) values ($1, $2, $3) returning name", [bucket, name, userId])
  const visible = (userId: string) => user<{ name: string }>(userId, "select name from storage.objects where bucket_id = 'avatars' order by name").then((r) => r.map((x) => x.name))

  it("is private, about 1 MB, WebP and JPEG only", async () => {
    expect(await owner("select id, public, file_size_limit::int as limit, allowed_mime_types from storage.buckets where id = 'avatars'")).toEqual([
      { id: "avatars", public: false, limit: 1048576, allowed_mime_types: ["image/webp", "image/jpeg"] },
    ])
  })

  it("lets people upload only into their own folder, with a random .webp or .jpg name", async () => {
    expect(await insert(ANA, photo(ANA))).toEqual([{ name: photo(ANA) }])
    expect(await insert(MIKA, photo(MIKA, "mikaphoto0123456789"))).toEqual([{ name: photo(MIKA, "mikaphoto0123456789") }])
    expect(await insert(STRANGER, photo(STRANGER, "strangerphoto012345"))).toHaveLength(1)
    for (const [who, name] of [
      [STRANGER, photo(ANA, "sneakyupload0123456")], // someone else's folder
      [ANA, `${ANA}/short.webp`],
      [ANA, `${ANA}/0123456789abcdef0.png`],
      [ANA, `${ANA}/nested/0123456789abcdef.webp`],
      [ANA, "0123456789abcdef.webp"],
    ] as const) {
      await expect(insert(who, name), name).rejects.toThrow(/row-level security/)
    }
    await expect(as("anon", null, "insert into storage.objects (bucket_id, name) values ('avatars', $1)", [photo(ANA, "anonupload0123456789")])).rejects.toThrow(
      /row-level security/
    )
  })

  it("shows a photo to its owner and connected people only", async () => {
    expect(await visible(ANA)).toEqual([photo(ANA), photo(MIKA, "mikaphoto0123456789")].sort())
    expect(await visible(MIKA)).toEqual([photo(ANA), photo(MIKA, "mikaphoto0123456789")].sort())
    expect(await visible(STRANGER)).toEqual([photo(STRANGER, "strangerphoto012345")])
    expect(await visible(JUN)).toEqual([])
    expect(await as("anon", null, "select name from storage.objects")).toEqual([])
  })

  it("lets only the owner replace or delete a photo", async () => {
    expect(await user(MIKA, "update storage.objects set metadata = '{}' where name = $1 returning name", [photo(ANA)])).toEqual([])
    expect(await user(MIKA, "delete from storage.objects where name = $1 returning name", [photo(ANA)])).toEqual([])
    expect(await user(ANA, "update storage.objects set metadata = '{\"size\": 1}' where name = $1 returning name", [photo(ANA)])).toEqual([{ name: photo(ANA) }])
    await expect(user(ANA, "update storage.objects set name = $1 where name = $2", [photo(MIKA, "movedintomika012345"), photo(ANA)])).rejects.toThrow(/row-level security/)
    expect(await user(STRANGER, "delete from storage.objects where name = $1 returning name", [photo(STRANGER, "strangerphoto012345")])).toHaveLength(1)
    expect(await owner("select count(*)::int as n from storage.objects where name = $1", [photo(ANA)])).toEqual([{ n: 1 }])
  })

  it("leaves other buckets alone", async () => {
    const policies = await owner<{ qual: string | null; with_check: string | null }>(
      "select qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects'"
    )
    expect(policies).toHaveLength(4)
    for (const p of policies) expect(`${p.qual ?? ""} ${p.with_check ?? ""}`).toMatch(/bucket_id = 'avatars'/)
  })
})

describe("admin audit", () => {
  it("accepts the profile_photo_removed action", async () => {
    await as("service_role", null, "insert into public.admin_audit_log (admin_id, action, target_user_id) values ($1, 'profile_photo_removed', $2)", [ANA, MIKA])
    expect(await owner("select action from public.admin_audit_log where action = 'profile_photo_removed'")).toEqual([{ action: "profile_photo_removed" }])
  })
})

describe("deleting an account", () => {
  it("removes the profile row with it (the photo files go through the Storage API — see the admin delete route)", async () => {
    await owner("delete from auth.users where id = $1", [STRANGER])
    expect(await owner("select count(*)::int as n from public.users where id = $1", [STRANGER])).toEqual([{ n: 0 }])
    expect(circleId).toBeTruthy()
  })
})
