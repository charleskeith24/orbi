import { describe, expect, it } from "vitest"
import {
  cleanStoredLinks,
  isStoredLinks,
  isStoredLinkValue,
  normalizeProfileLink,
  profileLinkHref,
  profileLinkText,
} from "./links"
import { avatarOwner, isAvatarPath, newAvatarPath } from "./photo-path"

describe("normalizeProfileLink", () => {
  it("stores handles without @", () => {
    expect(normalizeProfileLink("instagram", " @ana.travels ")).toEqual({ ok: true, link: { platform: "instagram", value: "ana.travels" } })
    expect(normalizeProfileLink("tiktok", "ana_travels")).toEqual({ ok: true, link: { platform: "tiktok", value: "ana_travels" } })
    expect(normalizeProfileLink("linkedin", "ana-reyes-123")).toEqual({ ok: true, link: { platform: "linkedin", value: "ana-reyes-123" } })
  })

  it("reads a scheme, www. or a path as a URL and adds https://", () => {
    expect(normalizeProfileLink("instagram", "instagram.com/ana")).toEqual({ ok: true, link: { platform: "instagram", value: "https://instagram.com/ana" } })
    expect(normalizeProfileLink("youtube", "www.youtube.com/@ana")).toEqual({ ok: true, link: { platform: "youtube", value: "https://www.youtube.com/@ana" } })
    expect(normalizeProfileLink("facebook", "HTTPS://facebook.com/profile.php?id=1")).toEqual({
      ok: true,
      link: { platform: "facebook", value: "https://facebook.com/profile.php?id=1" },
    })
    expect(normalizeProfileLink("website", "ana.example.com")).toEqual({ ok: true, link: { platform: "website", value: "https://ana.example.com" } })
    expect(normalizeProfileLink("website", "http://ana.example.com/about")).toEqual({ ok: true, link: { platform: "website", value: "http://ana.example.com/about" } })
  })

  it("explains what's wrong", () => {
    expect(normalizeProfileLink("x", "   ")).toEqual({ ok: false, error: "empty" })
    expect(normalizeProfileLink("x", "ana reyes")).toEqual({ ok: false, error: "handle" })
    expect(normalizeProfileLink("x", "ana!")).toEqual({ ok: false, error: "handle" })
    expect(normalizeProfileLink("x", "a".repeat(65))).toEqual({ ok: false, error: "too_long" })
    expect(normalizeProfileLink("website", "not a site")).toEqual({ ok: false, error: "url" })
    expect(normalizeProfileLink("website", "localhost")).toEqual({ ok: false, error: "url" })
    expect(normalizeProfileLink("website", "javascript:alert(1)")).toEqual({ ok: false, error: "url" })
    expect(normalizeProfileLink("tiktok", "ftp://files.example.com/x")).toEqual({ ok: false, error: "url" })
    expect(normalizeProfileLink("website", "https://example.com/a b")).toEqual({ ok: false, error: "url" })
    expect(normalizeProfileLink("website", `https://example.com/${"a".repeat(200)}`)).toEqual({ ok: false, error: "too_long" })
  })

  it("always produces something the database CHECK accepts", () => {
    const inputs: [Parameters<typeof normalizeProfileLink>[0], string][] = [
      ["instagram", "@ana"],
      ["x", "https://x.com/ana"],
      ["website", "ana.example.com/links?utm=1"],
      ["threads", "www.threads.net/@ana"],
    ]
    for (const [platform, raw] of inputs) {
      const result = normalizeProfileLink(platform, raw)
      expect(result.ok, raw).toBe(true)
      if (result.ok) expect(isStoredLinkValue(platform, result.link.value), raw).toBe(true)
    }
  })
})

describe("stored links", () => {
  it("checks the whole value like the CHECK does", () => {
    expect(isStoredLinks([])).toBe(true)
    expect(isStoredLinks([{ platform: "x", value: "ana" }])).toBe(true)
    expect(isStoredLinks(Array.from({ length: 7 }, () => ({ platform: "x", value: "ana" })))).toBe(false)
    expect(isStoredLinks([{ platform: "website", value: "ana" }])).toBe(false)
    expect(isStoredLinks([{ platform: "x", value: "@ana" }])).toBe(false)
    expect(isStoredLinks([{ platform: "x", value: "ana", extra: 1 }])).toBe(false)
    expect(isStoredLinks({ platform: "x", value: "ana" })).toBe(false)
  })

  it("drops anything invalid from an old or edited local profile", () => {
    expect(
      cleanStoredLinks([
        { platform: "x", value: "ana" },
        { platform: "myspace", value: "ana" },
        { platform: "website", value: "javascript:alert(1)" },
        null,
        "x",
        { platform: "website", value: "https://ana.example.com" },
      ])
    ).toEqual([
      { platform: "x", value: "ana" },
      { platform: "website", value: "https://ana.example.com" },
    ])
    expect(cleanStoredLinks("nope")).toEqual([])
  })
})

describe("showing links", () => {
  it("opens handles on the platform and URLs as they are", () => {
    expect(profileLinkHref({ platform: "tiktok", value: "ana" })).toBe("https://www.tiktok.com/@ana")
    expect(profileLinkHref({ platform: "instagram", value: "ana.travels" })).toBe("https://www.instagram.com/ana.travels")
    expect(profileLinkHref({ platform: "youtube", value: "ana" })).toBe("https://www.youtube.com/@ana")
    expect(profileLinkHref({ platform: "linkedin", value: "ana-r" })).toBe("https://www.linkedin.com/in/ana-r")
    expect(profileLinkHref({ platform: "x", value: "ana" })).toBe("https://x.com/ana")
    expect(profileLinkHref({ platform: "threads", value: "ana" })).toBe("https://www.threads.net/@ana")
    expect(profileLinkHref({ platform: "facebook", value: "ana.r" })).toBe("https://www.facebook.com/ana.r")
    expect(profileLinkHref({ platform: "website", value: "https://ana.example.com" })).toBe("https://ana.example.com")
  })

  it("never opens anything that isn't http(s)", () => {
    expect(profileLinkHref({ platform: "website", value: "javascript:alert(1)" })).toBeNull()
    expect(profileLinkHref({ platform: "website", value: "ana" })).toBeNull()
    expect(profileLinkHref({ platform: "x", value: "a b" })).toBeNull()
  })

  it("reads as @handle, a plain name or a URL without its scheme", () => {
    expect(profileLinkText({ platform: "tiktok", value: "ana" })).toBe("@ana")
    expect(profileLinkText({ platform: "facebook", value: "ana.r" })).toBe("ana.r")
    expect(profileLinkText({ platform: "linkedin", value: "ana-r" })).toBe("ana-r")
    expect(profileLinkText({ platform: "website", value: "https://ana.example.com/" })).toBe("ana.example.com")
  })
})

describe("photo paths", () => {
  const USER = "a0000000-0000-4000-8000-0000000000a1"

  it("are a fresh random name in the owner's folder", () => {
    const a = newAvatarPath(USER, "image/webp")
    const b = newAvatarPath(USER, "image/jpeg")
    expect(a).toMatch(new RegExp(`^${USER}/[0-9a-f]{32}\\.webp$`))
    expect(b).toMatch(new RegExp(`^${USER}/[0-9a-f]{32}\\.jpg$`))
    expect(a.slice(0, -5)).not.toBe(b.slice(0, -4))
    expect(isAvatarPath(a, USER)).toBe(true)
    expect(avatarOwner(a)).toBe(USER)
  })

  it("reject anything else", () => {
    expect(isAvatarPath(`${USER}/short.webp`, USER)).toBe(false)
    expect(isAvatarPath(`other/${"a".repeat(32)}.webp`, USER)).toBe(false)
    expect(isAvatarPath(null, USER)).toBe(false)
    expect(avatarOwner(`${USER}/x/${"a".repeat(32)}.webp`)).toBeNull()
    expect(avatarOwner("https://example.com/a.webp")).toBeNull()
  })
})
