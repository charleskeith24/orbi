import { existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SETTINGS_TAB_KEYS } from "@/components/features/settings/tabs"
import { ALL_PAGES } from "@/lib/navigation"
import { HELP_GROUPS, HELP_TOPICS, helpPageTitle, searchHelp, type HelpText } from "./help-topics"

const texts = (t: HelpText) => [t.title, t.summary, ...(t.steps ?? []), ...(t.tips ?? [])]
const APP = new URL("../../../app/", import.meta.url)

/** A page exists for a path: in the (app) group or at the top level (/privacy, /terms). */
function pageExists(path: string): boolean {
  const dir = path === "/" ? "" : path.slice(1) + "/"
  return existsSync(new URL(`(app)/${dir}page.tsx`, APP)) || existsSync(new URL(`${dir}page.tsx`, APP))
}

describe("Help topics", () => {
  it("have unique kebab-case ids, and every group has at least one", () => {
    const ids = HELP_TOPICS.map((topic) => topic.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    for (const group of HELP_GROUPS) expect(HELP_TOPICS.some((topic) => topic.group === group)).toBe(true)
  })

  it("say the same in English and Taglish: same steps, same tips, nothing empty", () => {
    for (const topic of HELP_TOPICS) {
      expect(topic.tl.steps?.length, topic.id).toBe(topic.en.steps?.length)
      expect(topic.tl.tips?.length, topic.id).toBe(topic.en.tips?.length)
      for (const text of [...texts(topic.en), ...texts(topic.tl)]) expect(text.trim(), topic.id).not.toBe("")
    }
  })

  it("close every **bold** (button and menu names)", () => {
    for (const topic of HELP_TOPICS) {
      for (const text of [...texts(topic.en), ...texts(topic.tl)]) expect(text.split("**").length % 2, `${topic.id}: ${text}`).toBe(1)
    }
  })

  it("give guides steps and questions a one-line answer", () => {
    for (const topic of HELP_TOPICS) {
      if (topic.group === "faq") expect(topic.en.steps, topic.id).toBeUndefined()
      else expect(topic.en.steps?.length, topic.id).toBeGreaterThan(0)
    }
  })

  it("link only to pages that exist, named for their Open button", () => {
    for (const topic of HELP_TOPICS) {
      if (!topic.href) continue
      const url = new URL(topic.href, "https://orbi.test")
      expect(pageExists(url.pathname), topic.href).toBe(true)
      expect(helpPageTitle(topic.href, ALL_PAGES), topic.href).not.toBeNull()
      const tab = url.searchParams.get("tab")
      if (tab) expect(SETTINGS_TAB_KEYS as readonly string[], topic.href).toContain(tab)
    }
  })

  it("mark the features that need an account", () => {
    const online = HELP_TOPICS.filter((topic) => topic.online).map((topic) => topic.id)
    expect(online).toEqual(expect.arrayContaining(["circles", "team"]))
  })
})

describe("helpPageTitle", () => {
  it("names the page, ignoring the query", () => {
    expect(helpPageTitle("/strategy", ALL_PAGES)).toBe("Brand HQ")
    expect(helpPageTitle("/settings?tab=team", ALL_PAGES)).toBe("Settings")
    expect(helpPageTitle("/privacy", ALL_PAGES)).toBe("Privacy notice")
    expect(helpPageTitle("/nowhere", ALL_PAGES)).toBeNull()
  })
})

describe("searchHelp", () => {
  const ids = (query: string) => searchHelp(query).map((topic) => topic.id)

  it("returns every guide for an empty search", () => {
    expect(searchHelp("  ")).toHaveLength(HELP_TOPICS.length)
  })

  it("puts title matches first", () => {
    expect(ids("pipeline")[0]).toBe("pipeline")
    expect(ids("content score views")[0]).toBe("faq-score")
  })

  it("matches steps and keywords in either language", () => {
    expect(ids("bottleneck")).toContain("pipeline")
    expect(ids("kita")).toContain("money")
    expect(ids("brand deal")).toContain("money")
    expect(ids("paano lumipat")).toContain("faq-language")
  })

  it("needs every word, ignores case, accents and bold marks", () => {
    expect(ids("QUICK capture")).toContain("ideas")
    expect(ids("quick zzzz")).toEqual([])
    expect(ids("café")).toEqual(ids("cafe"))
  })
})
