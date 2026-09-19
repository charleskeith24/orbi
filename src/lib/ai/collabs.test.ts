import { describe, expect, it } from "vitest"
import { NICHE_DOMAINS } from "./offline/niche-domains"
import { looksTagalog } from "./offline/text"
import { offlineProvider } from "./providers/offline"
import { executeAiTask } from "./server"
import { getAiTask } from "./tasks"
import { ctx } from "./test-fixtures"
import type { BrandContext } from "./context"

type Idea = { type: string; title: string; partner_niche: string; partner_kind: string; why_it_fits: string; platform: string; format: string; pillar_id: string | null }

async function ideas(context: BrandContext, input: Record<string, unknown> = { count: 5 }): Promise<Idea[]> {
  const res = await executeAiTask({ task: "collab_ideas", input, context }, { provider: offlineProvider })
  return (res.output as { ideas: Idea[] }).ideas
}

async function pitch(context: BrandContext, input: Record<string, unknown>): Promise<string> {
  const res = await executeAiTask({ task: "collab_pitch", input, context }, { provider: offlineProvider })
  return (res.output as { message: string }).message
}

/** A creator in another niche, in English, with the demo's platforms. */
function creator(niche: string, industry: string, expertise: string[], language: BrandContext["brand"]["language"] = "english"): BrandContext {
  return {
    ...ctx,
    brand: { ...ctx.brand, niche, industry, expertise_areas: expertise, interests: [], positioning_audience: "", language },
    pillars: [],
    personas: [],
    problems: [],
  }
}

const english: BrandContext = { ...ctx, brand: { ...ctx.brand, language: "english" } }
const finance = creator("Budgeting and ipon systems for young professionals", "Personal finance", ["Budgeting", "Investing"])
const food = creator("Home baking for people who want to sell from home", "Home baking", ["Baking", "Pricing"])

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 20)

describe("collab_ideas (offline)", () => {
  it("returns 5 distinct ideas with valid types, platforms and pillar refs", async () => {
    const list = await ideas(ctx)
    expect(list).toHaveLength(5)
    expect(new Set(list.map((i) => i.type)).size).toBe(5)
    expect(new Set(list.map((i) => i.title.toLowerCase())).size).toBe(5)
    expect(new Set(list.map((i) => i.partner_niche.toLowerCase())).size).toBe(5)
    const active = new Set(ctx.platforms.map((p) => p.platform))
    for (const idea of list) {
      expect(active.has(idea.platform as never), idea.title).toBe(true)
      expect(idea.format.length).toBeGreaterThan(0)
      if (idea.pillar_id) expect(ctx.pillars.some((p) => p.id === idea.pillar_id)).toBe(true)
    }
  })

  it("is niche-specific: adjacent partners that share the audience, never the creator's own niche", async () => {
    const fin = await ideas(finance)
    const bake = await ideas(food)
    const niches = (list: Idea[]) => list.map((i) => i.partner_niche.toLowerCase())
    expect(niches(fin)).toContain("freelancing")
    expect(niches(fin).some((n) => /tax/.test(n))).toBe(true)
    expect(niches(bake).some((n) => /food (business|photography)/.test(n))).toBe(true)
    expect(niches(fin)).not.toEqual(niches(bake))
    const financeDomain = NICHE_DOMAINS.find((d) => d.id === "finance")!
    for (const n of niches(fin)) expect(financeDomain.match.test(n) && !/tax|salary|irregular/.test(n), n).toBe(false)
    // The demo brand teaches e-commerce marketing: no marketing or e-commerce partners.
    for (const n of niches(await ideas(english))) expect(n).not.toMatch(/marketing|e-?commerce|online selling/)
  })

  it("never repeats a phrase across the batch", async () => {
    for (const context of [ctx, english, finance, food]) {
      const list = await ideas(context)
      const all = list.flatMap((i) => [i.title, ...sentences(i.why_it_fits), ...sentences(i.partner_kind)].map((s) => s.toLowerCase()))
      const repeated = all.filter((s, index) => all.indexOf(s) !== index)
      expect(repeated, context.brand.niche).toEqual([])
    }
  })

  it("describes kinds of creators, never named people, accounts or links", async () => {
    for (const context of [ctx, english, finance, food]) {
      for (const idea of await ideas(context)) {
        const text = JSON.stringify(idea)
        expect(text).not.toMatch(/@\w|https?:\/\/|www\./)
        expect(idea.partner_kind).toMatch(/^(A|An|Isang)\b/)
      }
    }
  })

  it("strips @handles and links a model might add", () => {
    const task = getAiTask("collab_ideas")
    const input = task.input.parse({ count: 1 })
    const out = task.finalize!(
      {
        ideas: [
          {
            type: "joint_live",
            title: "Joint Live with @juan.money",
            partner_niche: "Personal finance",
            partner_kind: "A finance creator like @juan.money (https://tiktok.com/@juan.money)",
            why_it_fits: "Same audience.",
            platform: "facebook",
            format: "Live Video",
            pillar_id: "P1",
          },
        ],
      },
      ctx,
      input
    ) as { ideas: Idea[] }
    expect(JSON.stringify(out)).not.toMatch(/@juan|https?:/)
    expect(out.ideas[0].pillar_id).toBe(ctx.pillars[0].id)
  })

  it("follows Brand HQ's writing language", async () => {
    const taglish = await ideas(ctx)
    expect(taglish.filter((i) => looksTagalog(i.why_it_fits)).length).toBeGreaterThanOrEqual(3)
    const en = await ideas(english)
    expect(en.every((i) => !looksTagalog(i.why_it_fits))).toBe(true)
  })

  it("Regenerate avoids the titles already shown", async () => {
    const first = await ideas(english)
    const again = await ideas(english, { count: 5, exclude: first.map((i) => i.title) })
    expect(again.length).toBeGreaterThanOrEqual(3)
    for (const idea of again) expect(first.map((i) => i.title)).not.toContain(idea.title)
  })
})

describe("collab_pitch (offline)", () => {
  const input = {
    type: "joint_live",
    partner_name: "Tina Ramos",
    partner_handle: "@tinasells.ph",
    partner_platform: "facebook",
    partner_niche: "Seller logistics",
  }

  it("is a short, specific DM with one concrete first step and no flattery", async () => {
    const message = await pitch(english, input)
    const words = message.split(/\s+/).length
    expect(words).toBeGreaterThan(40)
    expect(words).toBeLessThanOrEqual(120)
    expect(message).toMatch(/^Hi Tina!/)
    expect(message).toMatch(/Live/)
    expect(message).toMatch(/outline|date/i)
    expect(message).not.toMatch(/love your (content|posts|videos)|big fan|amazing content|huge fan|so inspiring/i)
    expect(message).not.toMatch(/follow for follow|engagement pod|f4f/i)
  })

  it("proposes the date when there is one, and writes Taglish for a Taglish brand", async () => {
    const taglish = await pitch(ctx, { ...input, collab_date: "2026-09-24" })
    expect(looksTagalog(taglish)).toBe(true)
    expect(taglish).toContain("Sep 24")
    const en = await pitch(english, { ...input, collab_date: "2026-09-24" })
    expect(looksTagalog(en)).toBe(false)
    expect(en).toContain("Thu, Sep 24")
  })

  it("fits the collab type and writes a different version on regenerate", async () => {
    const stitch = await pitch(english, { ...input, type: "duet_stitch" })
    expect(stitch).toMatch(/stitch|duet/i)
    const first = await pitch(english, input)
    const second = await pitch(english, { ...input, previous: first })
    expect(second).not.toBe(first)
  })

  it("works with only a niche (no name or handle)", async () => {
    const message = await pitch(english, { type: "shoutout_swap", partner_niche: "Freelancing" })
    expect(message).toMatch(/^Hi!/)
    expect(message).toMatch(/shoutout|Story/i)
  })
})
