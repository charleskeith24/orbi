import { describe, expect, it } from "vitest"
import { buildRow } from "@/lib/data/defaults"
import { BRAND } from "@/lib/data/seed/brand-data"
import {
  brandCompleteness,
  brandFormValues,
  brandPatch,
  brandSuggestionInput,
  changedFields,
  cleanList,
  splitPositioning,
  validateBrand,
} from "./brand-model"

const demo = brandFormValues(buildRow("brand_profiles", BRAND, "", new Date(0)))
const empty = brandFormValues(buildRow("brand_profiles", {}, "", new Date(0)))

describe("brand form values", () => {
  it("round-trips the demo brand without changes", () => {
    const patch = brandPatch(demo)
    expect(changedFields({ ...demo, ...patch } as typeof demo, demo)).toEqual([])
  })

  it("trims text, dedupes lists and bounds years", () => {
    const patch = brandPatch({
      ...empty,
      name: "  Raf  ",
      expertise_areas: ["AI", " ai ", "", "Growth"],
      years_experience: 11.26,
    })
    expect(patch.name).toBe("Raf")
    expect(patch.expertise_areas).toEqual(["AI", "Growth"])
    expect(patch.years_experience).toBe(11.3)
    expect(brandPatch({ ...empty, years_experience: 120 }).years_experience).toBe(80)
  })

  it("detects list edits", () => {
    expect(changedFields({ ...demo, tones: ["casual"] }, demo)).toEqual(["tones"])
    expect(cleanList(["a", "A", " b "])).toEqual(["a", "b"])
  })

  it("requires a name and a sensible number of years", () => {
    expect(validateBrand(demo)).toEqual({})
    expect(validateBrand({ ...demo, name: "   " }).name).toBeTruthy()
    expect(validateBrand({ ...demo, years_experience: 90 }).years_experience).toBeTruthy()
  })
})

describe("brandCompleteness", () => {
  it("scores the demo brand complete", () => {
    const c = brandCompleteness(demo)
    expect(c.pct).toBe(100)
    expect(c.missing).toEqual([])
    expect(c.sections.identity).toEqual({ done: 8, total: 8 })
  })

  it("lists gaps in page order", () => {
    const c = brandCompleteness(empty)
    // The only default that counts is the default tone.
    expect(c.done).toBe(1)
    expect(c.pct).toBe(4)
    expect(c.missing[0]).toMatchObject({ field: "name", section: "identity" })
  })

  it("needs three expertise areas and personality traits", () => {
    const c = brandCompleteness({ ...demo, expertise_areas: ["AI", "Growth"], personality_traits: ["bold"] })
    expect(c.missing.map((m) => m.field)).toEqual(["expertise_areas", "personality_traits"])
  })
})

describe("splitPositioning", () => {
  const none = { audience: "", result: "", method: "" }

  it("splits the demo statement using the current audience", () => {
    const statement =
      "I help e-commerce founders and marketing leads in Southeast Asia build predictable, profitable growth without burning cash or their team through performance-marketing systems, AI-assisted operations and accountable teams."
    expect(splitPositioning(statement, { audience: BRAND.positioning_audience ?? "", result: "", method: "" })).toEqual({
      audience: "e-commerce founders and marketing leads in Southeast Asia",
      result: "build predictable, profitable growth without burning cash or their team",
      method: "performance-marketing systems, AI-assisted operations and accountable teams",
    })
  })

  it("finds the result verb without a known audience", () => {
    expect(splitPositioning("I help busy moms get fit through 20-minute home workouts.", none)).toEqual({
      audience: "busy moms",
      result: "get fit",
      method: "20-minute home workouts",
    })
    expect(splitPositioning("I help first-time founders to land their first 10 clients", none)).toEqual({
      audience: "first-time founders",
      result: "land their first 10 clients",
      method: "",
    })
  })

  it("keeps unparseable text as the audience", () => {
    expect(splitPositioning("Founders everywhere", none)).toEqual({ audience: "Founders everywhere", result: "", method: "" })
  })
})

describe("brandSuggestionInput", () => {
  it("maps answers to the onboarding_strategy input within its limits", () => {
    const input = brandSuggestionInput(
      { ...demo, years_experience: 11.6, who_am_i: "x".repeat(2500) },
      { problems: ["ROAS drops every time they increase budget"], goals: ["leads", "authority"] }
    )
    expect(input.years_experience).toBe(12)
    expect(input.audience).toBe(BRAND.positioning_audience)
    expect(input.tones).toEqual(["Conversational", "Educational", "Challenging"])
    expect(input.personality).toContain("Story-driven")
    expect(input.story?.length).toBe(2000)
    expect(input.goals).toEqual(["leads", "authority"])
    expect(input.idea_count).toBe(5)
  })
})
