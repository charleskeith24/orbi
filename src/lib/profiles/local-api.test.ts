import { describe, expect, it } from "vitest"
import { createProfilesFixture, SAMPLE_PROFILES } from "./fixture-api"
import { FIXTURE_SELF_ID } from "@/lib/circles/fixture-api"
import { createLocalProfilesApi, LOCAL_PROFILE_KEY } from "./local-api"
import type { EncodedPhoto } from "./types"

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

const photo = (bytes = 2_000, type: EncodedPhoto["type"] = "image/webp"): EncodedPhoto => {
  const blob = new Blob([new Uint8Array(bytes).fill(7)], { type })
  return { blob, type, size: blob.size }
}

const SELF = "00000000-0000-4000-8000-000000000001"
const brand = () => ({ niche: "Budget travel", main_platforms: ["tiktok" as const] })

describe("the local profile (this device only)", () => {
  it("starts empty and saves to localStorage", async () => {
    const storage = memoryStorage()
    const api = createLocalProfilesApi({ self: SELF, storage, brand })
    expect(await api.getMyProfile()).toEqual({ id: SELF, display_name: "", avatar_path: null, headline: "", location: "", links: [], show_niche: false })
    const saved = await api.updateMyProfile({ display_name: " Ana ", headline: "Budget travel tips", links: [{ platform: "tiktok", value: "ana" }], show_niche: true })
    expect(saved).toMatchObject({ display_name: "Ana", headline: "Budget travel tips", show_niche: true })
    expect(JSON.parse(storage.data.get(LOCAL_PROFILE_KEY)!)).toMatchObject({ version: 1, display_name: "Ana", photo: null })
    // A fresh client (a reload) reads it back.
    expect(await createLocalProfilesApi({ self: SELF, storage }).getMyProfile()).toEqual(saved)
  })

  it("applies the database's limits", async () => {
    const api = createLocalProfilesApi({ self: SELF, storage: memoryStorage() })
    await expect(api.updateMyProfile({ headline: "h".repeat(161) })).rejects.toMatchObject({ code: "invalid" })
    await expect(api.updateMyProfile({ links: [{ platform: "website", value: "javascript:alert(1)" }] })).rejects.toMatchObject({ code: "invalid" })
  })

  it("keeps a small photo as a data URL, and removes it", async () => {
    const storage = memoryStorage()
    const api = createLocalProfilesApi({ self: SELF, storage })
    const withPhoto = await api.setPhoto(photo())
    expect(withPhoto.avatar_path).toMatch(/^local:[0-9a-f]{16}$/)
    const urls = await api.photoUrls([withPhoto.avatar_path!, "local:0000000000000000"])
    expect(Object.keys(urls)).toEqual([withPhoto.avatar_path])
    expect(urls[withPhoto.avatar_path!]).toEqual({ url: expect.stringMatching(/^data:image\/webp;base64,/), expiresAt: Infinity })
    // A new photo gets a new key, so no cache shows the old one.
    const next = await api.setPhoto(photo(1_000, "image/jpeg"))
    expect(next.avatar_path).not.toBe(withPhoto.avatar_path)
    expect(await api.photoUrls([withPhoto.avatar_path!])).toEqual({})
    const removed = await api.removePhoto()
    expect(removed.avatar_path).toBeNull()
    expect(JSON.parse(storage.data.get(LOCAL_PROFILE_KEY)!).photo).toBeNull()
  })

  it("refuses photos over ~60 KB and anything but WebP or JPEG", async () => {
    const api = createLocalProfilesApi({ self: SELF, storage: memoryStorage() })
    await expect(api.setPhoto(photo(61 * 1024))).rejects.toMatchObject({ code: "too_large" })
    const png = new Blob([new Uint8Array(10)], { type: "image/png" })
    await expect(api.setPhoto({ blob: png, type: "image/png" as never, size: png.size })).rejects.toMatchObject({ code: "not_image" })
  })

  it("reports a full browser storage honestly", async () => {
    const full = { ...memoryStorage(), setItem: () => { throw Object.assign(new Error("The quota has been exceeded."), { name: "QuotaExceededError" }) } }
    const api = createLocalProfilesApi({ self: SELF, storage: full })
    await expect(api.setPhoto(photo())).rejects.toMatchObject({ code: "storage_full" })
    await expect(createLocalProfilesApi({ self: SELF, storage: null }).updateMyProfile({ display_name: "A" })).rejects.toMatchObject({ code: "storage_full" })
  })

  it("survives a hand-edited or corrupt value", async () => {
    const storage = memoryStorage({
      [LOCAL_PROFILE_KEY]: JSON.stringify({ display_name: 42, headline: "x".repeat(300), links: [{ platform: "x", value: "ok" }, { platform: "bad" }], photo: "javascript:1", photo_key: "zz" }),
    })
    const me = await createLocalProfilesApi({ self: SELF, storage }).getMyProfile()
    expect(me).toMatchObject({ display_name: "", links: [{ platform: "x", value: "ok" }], avatar_path: null })
    expect(me.headline).toHaveLength(160)
    expect(await createLocalProfilesApi({ self: SELF, storage: memoryStorage({ [LOCAL_PROFILE_KEY]: "{not json" }) }).getMyProfile()).toMatchObject({ display_name: "" })
  })

  it("answers getProfiles only for yourself, with the niche only when opted in", async () => {
    const api = createLocalProfilesApi({ self: SELF, storage: memoryStorage(), brand })
    expect(await api.getProfiles(["someone-else"])).toEqual([])
    expect(await api.getProfiles([SELF])).toMatchObject([{ id: SELF, niche: null }])
    await api.updateMyProfile({ show_niche: true })
    expect(await api.getProfiles([SELF, "someone-else"])).toMatchObject([{ id: SELF, niche: "Budget travel", main_platform: "tiktok" }])
  })
})

describe("the dev fixture's sample profiles", () => {
  it("answers sample people and your local profile under the Circles fixture's id", async () => {
    const base = createLocalProfilesApi({ self: SELF, storage: memoryStorage() })
    await base.updateMyProfile({ display_name: "Ana" })
    const api = createProfilesFixture({ base, latencyMs: 0 })
    const found = await api.getProfiles([FIXTURE_SELF_ID, "sample-mika", "nobody"])
    expect(found.map((p) => [p.id, p.display_name])).toEqual([
      [FIXTURE_SELF_ID, "Ana"],
      ["sample-mika", SAMPLE_PROFILES[0].display_name],
    ])
    const urls = await api.photoUrls([SAMPLE_PROFILES[0].avatar_path!])
    expect(urls[SAMPLE_PROFILES[0].avatar_path!].url).toMatch(/^data:image\/svg\+xml/)
    // Every sample is labelled.
    for (const sample of SAMPLE_PROFILES) expect(sample.display_name).toMatch(/\(sample\)/)
  })
})
