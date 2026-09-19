import { describe, expect, it } from "vitest"
import { ALL_PAGES, NAV_SECTIONS, sidebarSections } from "@/lib/navigation"

const SIMPLE = ["Home", "Today", "Ideas", "Content Studio", "Calendar", "Analytics", "Money", "Settings"]
const titles = (sections: typeof NAV_SECTIONS) => sections.flatMap((s) => s.items.map((i) => i.title))

describe("navigation", () => {
  it("marks exactly the everyday modules for Simple mode", () => {
    expect(NAV_SECTIONS.flatMap((s) => s.items.filter((i) => i.simple).map((i) => i.title))).toEqual(SIMPLE)
  })

  it("puts Money under Monetize, after Measure, with its pages in the command palette", () => {
    expect(NAV_SECTIONS.map((s) => s.label)).toEqual([null, "Strategy", "Create", "Organize", "Measure", "Monetize", null])
    const pages = new Map(ALL_PAGES.map((p) => [p.href, p]))
    expect(pages.get("/money")).toMatchObject({ title: "Money", section: "Monetize" })
    for (const href of ["/money/deals", "/money/income", "/money/media-kit"]) expect(pages.get(href)?.section).toBe("Money")
    expect(new Set(ALL_PAGES.map((p) => p.href)).size).toBe(ALL_PAGES.length)
  })

  it("lists Collabs in Organize right after Campaigns, outside Simple mode", () => {
    const organize = NAV_SECTIONS.find((s) => s.label === "Organize")!.items.map((i) => i.title)
    expect(organize.slice(0, 2)).toEqual(["Campaigns", "Collabs"])
    expect(NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === "/collabs")?.simple).toBeUndefined()
    expect(ALL_PAGES.find((p) => p.href === "/collabs")).toMatchObject({ title: "Collabs", section: "Organize" })
  })

  it("lists Circles in Organize right after Collabs, outside Simple mode", () => {
    const organize = NAV_SECTIONS.find((s) => s.label === "Organize")!.items.map((i) => i.title)
    expect(organize.slice(0, 3)).toEqual(["Campaigns", "Collabs", "Circles"])
    expect(NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === "/circles")?.simple).toBeUndefined()
    expect(ALL_PAGES.find((p) => p.href === "/circles")).toMatchObject({ title: "Circles", section: "Organize" })
  })

  it("hides the other modules in Simple mode and counts them", () => {
    const all = titles(NAV_SECTIONS)
    const simple = sidebarSections(NAV_SECTIONS, { simpleMode: true, pathname: "/" })
    expect(titles(simple.sections)).toEqual(SIMPLE)
    expect(simple.hidden).toBe(all.length - SIMPLE.length)
    expect(simple.sections.every((s) => s.items.length > 0)).toBe(true)
    expect(sidebarSections(NAV_SECTIONS, { simpleMode: false, pathname: "/" })).toEqual({ sections: NAV_SECTIONS, hidden: 0 })
  })

  it("keeps the module of the current page visible in Simple mode", () => {
    const onPipeline = sidebarSections(NAV_SECTIONS, { simpleMode: true, pathname: "/pipeline" })
    expect(titles(onPipeline.sections)).toContain("Pipeline")
    const onGoals = sidebarSections(NAV_SECTIONS, { simpleMode: true, pathname: "/strategy/goals" })
    expect(titles(onGoals.sections)).toContain("Strategy")
    expect(onGoals.hidden).toBe(titles(NAV_SECTIONS).length - SIMPLE.length - 1)
  })
})
