import { describe, expect, it } from "vitest"
import {
  ALL_PAGES,
  groupItems,
  moduleTabsFor,
  NAV_SECTIONS,
  navModuleFor,
  parseCollapsedGroups,
  sidebarSections,
} from "@/lib/navigation"

const SIMPLE = ["Home", "Today", "Ideas", "Content Studio", "Calendar", "Analytics", "Money", "Settings"]
const titles = (sections: typeof NAV_SECTIONS) => sections.flatMap((s) => s.items.map((i) => i.title))
const group = (key: string) => NAV_SECTIONS.find((s) => s.key === key)!

describe("navigation", () => {
  it("has Home and Today, four groups, then Money and Settings — one link per module", () => {
    expect(NAV_SECTIONS.map((s) => s.label)).toEqual([null, "Plan", "Create", "Grow", "Measure", null])
    expect(titles(NAV_SECTIONS)).toEqual([
      "Home",
      "Today",
      "Brand HQ",
      "Audience",
      "Pillars",
      "Ideas",
      "Content Studio",
      "Pipeline",
      "Calendar",
      "Collabs",
      "Circles",
      "Campaigns",
      "Series",
      "Story Vault",
      "Research",
      "Analytics",
      "Winners",
      "Reports",
      "Experiments",
      "Money",
      "Settings",
    ])
  })

  it("marks exactly the everyday modules for Simple mode", () => {
    expect(NAV_SECTIONS.flatMap((s) => s.items.filter((i) => i.simple).map((i) => i.title))).toEqual(SIMPLE)
  })

  it("gives every sub-page a short tab label, starting with the module's own page", () => {
    for (const item of NAV_SECTIONS.flatMap((s) => s.items)) {
      if (!item.children) continue
      expect(item.children[0].href).toBe(item.href)
      for (const child of item.children) expect(child.tab.length).toBeGreaterThan(0)
    }
    expect(moduleTabsFor("/ideas/hooks")?.tabs.map((t) => t.title)).toEqual(["Idea Bank", "Generator", "Hooks", "Angles"])
    expect(moduleTabsFor("/strategy")?.tabs.map((t) => t.title)).toEqual(["Brand HQ", "Goals", "Platforms", "System"])
    expect(moduleTabsFor("/money/media-kit")?.module.title).toBe("Money")
  })

  it("shows no tabs on modules without sub-pages or on detail pages", () => {
    expect(moduleTabsFor("/pipeline")).toBeNull()
    expect(moduleTabsFor("/")).toBeNull()
    expect(moduleTabsFor("/campaigns/abc")).toBeNull()
    expect(moduleTabsFor("/strategist")).toBeNull()
    expect(navModuleFor("/studio/abc")?.title).toBe("Content Studio")
  })

  it("keeps every page in the command palette under its full name, once", () => {
    const pages = new Map(ALL_PAGES.map((p) => [p.href, p]))
    expect(pages.get("/money")).toMatchObject({ title: "Money" })
    for (const href of ["/money/deals", "/money/income", "/money/media-kit"]) expect(pages.get(href)?.section).toBe("Money")
    expect(pages.get("/ideas/hooks")).toMatchObject({ title: "Hook Library", section: "Ideas" })
    expect(pages.get("/strategy")).toMatchObject({ title: "Brand HQ", section: "Plan" })
    expect(pages.get("/collabs")).toMatchObject({ title: "Collabs", section: "Grow" })
    expect(new Set(ALL_PAGES.map((p) => p.href)).size).toBe(ALL_PAGES.length)
  })

  it("lists Collabs and Circles first in Grow, outside Simple mode", () => {
    expect(group("grow").items.map((i) => i.title).slice(0, 3)).toEqual(["Collabs", "Circles", "Campaigns"])
    expect(NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === "/collabs")?.simple).toBeUndefined()
    expect(NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === "/circles")?.simple).toBeUndefined()
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
    expect(titles(onGoals.sections)).toContain("Brand HQ")
    expect(onGoals.hidden).toBe(titles(NAV_SECTIONS).length - SIMPLE.length - 1)
  })

  it("folds groups but keeps the module you're on", () => {
    expect([...parseCollapsedGroups("plan, grow,bogus")]).toEqual(["plan", "grow"])
    expect(parseCollapsedGroups(null).size).toBe(0)
    expect(groupItems(group("grow"), { collapsed: true, pathname: "/" })).toEqual([])
    expect(groupItems(group("grow"), { collapsed: true, pathname: "/collabs" }).map((i) => i.title)).toEqual(["Collabs"])
    expect(groupItems(group("grow"), { collapsed: false, pathname: "/" })).toHaveLength(6)
    expect(groupItems(group("start"), { collapsed: true, pathname: "/" })).toHaveLength(2)
  })
})
