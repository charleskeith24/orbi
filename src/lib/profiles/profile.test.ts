import { describe, expect, it } from "vitest"
import { cleanLine, draftFromProfile, isDraftDirty, patchFromDraft, profileName, validateProfileDraft, type ProfileDraft } from "./profile"
import { emptyProfile, publicViewOf, toProfileError, type MyProfile } from "./types"

const ME: MyProfile = {
  ...emptyProfile("me"),
  display_name: "Ana Reyes",
  headline: "Budget travel for students",
  links: [{ platform: "tiktok", value: "ana.travels" }],
}

const draft = (patch: Partial<ProfileDraft> = {}): ProfileDraft => ({ ...draftFromProfile(ME), ...patch })

describe("validateProfileDraft", () => {
  it("accepts the limits and rejects one character more", () => {
    expect(validateProfileDraft(draft({ display_name: "n".repeat(80), headline: "h".repeat(160), location: "l".repeat(80) }))).toEqual({})
    expect(validateProfileDraft(draft({ display_name: "n".repeat(81), headline: "h".repeat(161), location: "l".repeat(81) }))).toEqual({
      display_name: "too_long",
      headline: "too_long",
      location: "too_long",
    })
  })

  it("measures after trimming", () => {
    expect(validateProfileDraft(draft({ headline: `  ${"h".repeat(160)}  ` }))).toEqual({})
  })

  it("reports link errors by row and ignores empty rows", () => {
    const links = [
      { key: "a", platform: "x" as const, value: "ana reyes" },
      { key: "b", platform: "website" as const, value: "" },
      { key: "c", platform: "website" as const, value: "nope" },
      { key: "d", platform: "instagram" as const, value: "@ana" },
    ]
    expect(validateProfileDraft(draft({ links }))).toEqual({ links: { a: "handle", c: "url" } })
  })
})

describe("patchFromDraft", () => {
  it("cleans text, normalizes links and drops empty rows", () => {
    expect(
      patchFromDraft(
        draft({
          display_name: "  Ana\tReyes ",
          location: " Cebu City ",
          links: [
            { key: "a", platform: "instagram", value: "@ana" },
            { key: "b", platform: "x", value: "  " },
            { key: "c", platform: "website", value: "ana.example.com" },
          ],
          show_niche: true,
        })
      )
    ).toEqual({
      display_name: "Ana Reyes",
      headline: "Budget travel for students",
      location: "Cebu City",
      links: [
        { platform: "instagram", value: "ana" },
        { platform: "website", value: "https://ana.example.com" },
      ],
      show_niche: true,
    })
  })

  it("is null while there are errors", () => {
    expect(patchFromDraft(draft({ headline: "h".repeat(161) }))).toBeNull()
  })
})

describe("isDraftDirty", () => {
  it("is false for the saved profile and for whitespace-only differences", () => {
    expect(isDraftDirty(draft(), ME)).toBe(false)
    expect(isDraftDirty(draft({ display_name: " Ana Reyes " }), ME)).toBe(false)
  })

  it("is true for real changes, invalid edits and new empty rows", () => {
    expect(isDraftDirty(draft({ location: "Cebu" }), ME)).toBe(true)
    expect(isDraftDirty(draft({ show_niche: true }), ME)).toBe(true)
    expect(isDraftDirty(draft({ headline: "h".repeat(200) }), ME)).toBe(true)
    expect(isDraftDirty(draft({ links: [...draft().links, { key: "n", platform: "x", value: "" }] }), ME)).toBe(true)
  })
})

describe("helpers", () => {
  it("cleanLine turns control characters into spaces", () => {
    expect(cleanLine(" a\nb\u0000c ")).toBe("a b c")
  })

  it("profileName falls back when the profile has no name", () => {
    expect(profileName("  ", "ana")).toBe("ana")
    expect(profileName("Ana", "ana")).toBe("Ana")
    expect(profileName(null, "ana")).toBe("ana")
  })

  it("publicViewOf shows the niche only when opted in", () => {
    const brand = { niche: "Budget travel", main_platforms: ["tiktok" as const, "instagram" as const] }
    expect(publicViewOf(ME, brand)).toMatchObject({ niche: null, main_platform: null })
    expect(publicViewOf({ ...ME, show_niche: true }, brand)).toMatchObject({ niche: "Budget travel", main_platform: "tiktok" })
    expect(publicViewOf({ ...ME, show_niche: true }, { niche: " ", main_platforms: [] })).toMatchObject({ niche: null, main_platform: null })
    expect(publicViewOf(ME, brand)).not.toHaveProperty("email")
  })

  it("toProfileError maps failures to codes", () => {
    expect(toProfileError({ code: "23514", message: "violates check constraint" }).code).toBe("invalid")
    expect(toProfileError(new TypeError("Failed to fetch")).code).toBe("network")
    expect(toProfileError(Object.assign(new Error("quota"), { name: "QuotaExceededError" })).code).toBe("storage_full")
    expect(toProfileError({ statusCode: "413", message: "Payload too large" }).code).toBe("invalid")
    expect(toProfileError("weird").code).toBe("unknown")
  })
})
