import * as z from "zod"
import { LANGUAGE_MAP, PILLAR_PRESETS, PLATFORMS } from "@/lib/constants"
import type { GoalCategory } from "@/lib/types"
import { EMPTY_BRAND_CONTEXT, positioningStatement, type BrandContext } from "../context"
import { createKit, nicheTopic } from "../offline/brand"
import { generateOfflineIdeas } from "../offline/ideas"
import { nicheInterests, toHundred } from "../offline/niche"
import { clean, headline, listJoin, seedFor, splitSentences, stripEndPunct } from "../offline/text"
import { finalizeIdea, generatedIdeaSchema } from "./generate-ideas"
import { defineTask, goalCategorySchema, platformSchema, uniqueStrings } from "./shared"

const text = (max: number) => z.string().trim().max(max).default("")

const input = z.object({
  name: text(120),
  brand_name: text(120),
  role: text(160),
  industry: text(160),
  years_experience: z.number().int().min(0).max(80).nullable().default(null),
  expertise_areas: z.array(z.string().trim().max(60)).max(15).default([]),
  audience: text(300),
  result: text(300),
  method: text(300),
  audience_problems: z.array(z.string().trim().max(200)).max(10).default([]),
  platforms: z.array(platformSchema).max(7).default([]),
  goals: z.array(goalCategorySchema).max(5).default([]),
  language: z.enum(["english", "tagalog", "taglish"]).default("english"),
  tones: z.array(z.string().trim().max(30)).max(6).default([]),
  personality: z.array(z.string().trim().max(30)).max(10).default([]),
  story: text(2000),
  idea_count: z.number().int().min(5).max(30).default(30),
  // Niche Discovery — optional, so older callers keep working.
  /** One-line niche the creator chose. */
  niche: text(200),
  /** Their "hilig" — topics they love talking about. */
  interests: z.array(z.string().trim().max(60)).max(12).default([]),
  niche_fit: text(600),
  /** The pillars they chose. When given, the strategy uses exactly these instead of the preset mix. */
  pillars: z
    .array(z.object({ name: z.string().trim().max(40), description: z.string().trim().max(200).default(""), target_percentage: z.number().min(0).max(100) }))
    .max(8)
    .default([]),
})

const output = z.object({
  positioning_statement: z.string().describe("I help [audience] [result] through [method]."),
  known_for: z.string(),
  point_of_view: z.string().describe("3–5 short, opinionated beliefs, one per sentence"),
  pillar_suggestions: z.array(z.object({ name: z.string(), description: z.string(), target_percentage: z.number() })),
  ideas: z.array(generatedIdeaSchema),
})

type Answers = z.output<typeof input>
type MixRow = { name: string; description: string; target: number }

const GOAL_NAMES: Record<GoalCategory, string> = {
  awareness: "Reach the right new people",
  authority: "Become the go-to voice on my topic",
  community: "Turn followers into conversations",
  leads: "Generate qualified inquiries",
  business: "Convert attention into revenue",
}

/** Adjust the preset mix toward the chosen goals (targets always sum to 100). */
function pillarMixFor(goals: GoalCategory[]): MixRow[] {
  const shift: Record<string, number> = {}
  const move = (to: string, from: string) => {
    shift[to] = (shift[to] ?? 0) + 5
    shift[from] = (shift[from] ?? 0) - 5
  }
  if (goals.includes("leads") || goals.includes("business")) move("Business", "Education")
  if (goals.includes("authority")) move("Authority", "Personal")
  if (goals.includes("community")) move("Journey", "Authority")
  if (goals.includes("awareness")) move("Education", "Leadership")
  const rows = PILLAR_PRESETS.map((p) => ({ name: p.name, description: p.description, target: Math.max(5, p.target_percentage + (shift[p.name] ?? 0)) }))
  const total = rows.reduce((a, r) => a + r.target, 0)
  const scaled = rows.map((r) => ({ ...r, target: Math.round((r.target / total) * 100) }))
  scaled[0].target += 100 - scaled.reduce((a, r) => a + r.target, 0)
  return scaled
}

/** The pillars the creator chose, normalised to 100 (empty when none were given). */
function chosenPillars(a: Answers): MixRow[] {
  const rows = uniqueStrings(a.pillars.map((p) => p.name))
    .map((name) => a.pillars.find((p) => p.name.trim() === name))
    .filter((p): p is Answers["pillars"][number] => Boolean(p))
  const targets = toHundred(rows.map((p) => p.target_percentage))
  return rows.map((p, i) => ({ name: p.name.trim(), description: p.description.trim(), target: targets[i] }))
}

const mixFor = (a: Answers): MixRow[] => {
  const chosen = chosenPillars(a)
  return chosen.length ? chosen : pillarMixFor(a.goals)
}

/**
 * The brand exactly as the wizard answers describe it. Whatever workspace is loaded (often the demo)
 * must not leak its stories, winners or problems into a new creator's strategy — only its content
 * formats, angles and settings carry over.
 */
function contextFromAnswers(ctx: BrandContext, a: Answers): BrandContext {
  const method = clean(a.method)
  const areas = uniqueStrings([...a.expertise_areas, ...(method && method.split(" ").length <= 6 ? [method] : [])], 10)
  const personaId = "wizard-persona"
  const storySentences = splitSentences(a.story)
  const base = EMPTY_BRAND_CONTEXT
  return {
    ...base,
    generated_at: ctx.generated_at,
    today: ctx.today,
    weekday: ctx.weekday,
    brand: {
      ...base.brand,
      name: a.name,
      brand_name: a.brand_name,
      role: a.role,
      industry: a.industry,
      years_experience: a.years_experience,
      expertise_areas: areas,
      niche: a.niche,
      interests: uniqueStrings(a.interests, 12),
      niche_fit: a.niche_fit,
      positioning_statement: positioningStatement(a.audience, a.result, a.method),
      positioning_audience: a.audience,
      positioning_result: a.result,
      positioning_method: a.method,
      language: a.language,
      tones: a.tones,
      personality: a.personality,
    },
    goals: a.goals.map((g, n) => ({ id: `wizard-goal-${n}`, name: GOAL_NAMES[g], category: g, description: "", target: "", is_primary: n === 0, is_secondary: n === 1 })),
    pillars: mixFor(a).map((p, n) => ({ id: `wizard-pillar-${n}`, name: p.name, description: p.description, target_percentage: p.target, recent_share: null, examples: [] })),
    personas: a.audience
      ? [{ id: personaId, name: a.audience, profession: a.audience, experience_level: "", is_primary: true, platforms: a.platforms, goals: a.result ? [a.result] : [], problems: a.audience_problems, frustrations: [], questions: [], objections: [], language_used: [] }]
      : [],
    problems: a.audience_problems.map((p, n) => ({ id: `wizard-problem-${n}`, problem: p, persona_id: a.audience ? personaId : null, pillar_id: null, severity: 4, category: "business" })),
    platforms: a.platforms.map((p) => ({ platform: p, label: PLATFORMS[p].label, posting_frequency: 0, audience: "", cta_style: "", preferred_format_ids: [], preferred_pillar_ids: [], posts_90d: 0, avg_views: null, engagement_rate: null })),
    formats: ctx.formats,
    angles: ctx.angles,
    stories: a.story
      ? [
          {
            id: "wizard-story",
            // "In 2022 we almost closed our first café because weekday sales were ₱3,000 a day" → "In 2022 we almost closed our first café".
            title: headline((storySentences[0] ?? a.story).split(/\s(?:because|when|after|since|so that)\s/)[0], 12),
            type: "experience",
            situation: clean(storySentences.slice(0, 2).join(" ")).slice(0, 200),
            problem: "",
            action: "",
            result: (storySentences.slice(1).find((s) => /[0-9₱%]/.test(s)) ?? "").slice(0, 200),
            lesson: "",
            emotion: "",
            keywords: areas.slice(0, 3).map((x) => x.toLowerCase()),
            pillar_id: null,
            is_favorite: true,
          },
        ]
      : [],
    settings: ctx.settings,
  }
}

export const onboardingStrategyTask = defineTask({
  name: "onboarding_strategy",
  description: "Onboarding: positioning statement, known-for, point of view, pillar mix and 30 starter ideas from the wizard answers.",
  input,
  output,
  maxTokens: 16000,

  context: (ctx, a) => contextFromAnswers(ctx, a),

  buildPrompt(_ctx, a) {
    const chosen = chosenPillars(a)
    return {
      user: [
        `Task: the creator just finished the onboarding wizard. Draft their starting strategy: a positioning statement (“I help [audience] [result] through [method].”), what they want to be known for, a point of view (3–5 short, opinionated beliefs they can defend from their experience), ${chosen.length ? "their pillar mix (use exactly the pillars they chose — same names and targets)" : "a pillar mix (4–6 pillars with descriptions and target percentages that sum to 100, weighted toward their goals)"}, and starter ideas.`,
        a.niche
          ? `Their niche (chosen in Niche Discovery): “${a.niche}”.${a.interests.length ? ` Their interests (hilig): ${a.interests.join(", ")}.` : ""} Every idea must sit inside this niche — draw topics from it, their interests, expertise and the audience's problems.`
          : "",
        `<wizard_answers>\n${JSON.stringify({ ...a, language: LANGUAGE_MAP[a.language].label }, null, 1)}\n</wizard_answers>`,
        `Then generate exactly ${a.idea_count} starter ideas (spread across the pillars, platforms and funnel stages; grounded in the audience problems and expertise given). Pillars don't exist in the workspace yet, so set pillar_id, persona_id and problem_id to null. Write in the creator's chosen language. Keep claims modest — use only facts they gave you.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  },

  offline(ctx, a) {
    // The gateway already swaps in the wizard context; direct callers get the same isolation.
    const wizard = contextFromAnswers(ctx, a)
    const kit = createKit(wizard, seedFor("onboarding_strategy", a))
    const areas = a.expertise_areas.length ? a.expertise_areas : wizard.brand.expertise_areas
    const audience = a.audience || kit.say("the people I serve", "mga taong tinutulungan ko")
    const lowerAreas = areas.map((x) => (/^[A-Z]{2,}$/.test(x) ? x : x.toLowerCase()))
    const positioning =
      positioningStatement(a.audience, a.result, a.method) ||
      `I help ${audience} ${a.result || "get better results"} through ${a.method || (areas.length ? listJoin(lowerAreas.slice(0, 3)) : "practical, tested systems")}.`
    const beliefs = [
      areas[0]
        ? kit.say(`${areas[0]} is a system, not a talent — anyone can get good at it with the right process.`, `Sistema ang ${lowerAreas[0]}, hindi talent — kayang matutunan ng kahit sino with the right process.`)
        : kit.say("Systems beat motivation.", "Mas panalo ang sistema kaysa sa motivation."),
      kit.say(`Most advice for ${audience} is written by people who have never done the work.`, `Karamihan ng advice para sa ${audience}, galing sa mga taong hindi pa talaga nakagawa nito.`),
      kit.say("Consistency beats intensity — a sustainable rhythm wins over a burst of effort.", "Consistency over intensity — mas panalo ang kayang ituloy kaysa sa biglaang sipag."),
      a.years_experience
        ? kit.say(`${a.years_experience} years in, I trust what I've tested over what's trending.`, `${a.years_experience} years na ako dito — mas pinagkakatiwalaan ko ang na-test ko kaysa sa trending.`)
        : kit.say("Test it before you trust it.", "I-test mo muna bago mo pagkatiwalaan."),
    ]
    const generated = generateOfflineIdeas(wizard, kit, { count: a.idea_count })
    // Sparse answers can exhaust the seed × angle space before the requested count (the spec promises 30):
    // top up with forced angles, never repeating a title we already have.
    const topUpAngles = ["Mistake", "Myth", "Checklist", "Story", "Comparison", "Lesson", "Question", "Prediction", "Before vs After", "Behind the Scenes", "Framework", "Tutorial", "Opinion", "Case Study"]
    for (const angle of topUpAngles) {
      if (generated.length >= a.idea_count) break
      generated.push(
        ...generateOfflineIdeas(wizard, kit, { count: a.idea_count - generated.length, angle, avoidTitles: generated.map((i) => i.title) })
      )
    }
    // Very sparse answers leave almost no seeds: fall back to real subjects — the user's own material first
    // (niche, interests, expertise, industry, audience problems), then evergreen personal-brand subjects. Formats
    // ("tutorials") and roles ("bookkeeper") are deliberately excluded: they read as nonsense in a title.
    const evergreenSubjects = [
      "content consistency",
      "building an audience",
      "pricing your work",
      "client communication",
      "time management",
      "decision making",
      "delegation",
      "saying no",
      "career growth",
      "productivity",
    ]
    const fallbackTopics = uniqueStrings(
      [nicheTopic(a.niche), ...nicheInterests(a.niche, a.interests, areas), ...areas, a.industry, ...a.audience_problems, ...evergreenSubjects].filter(Boolean),
      40
    )
    for (const topic of fallbackTopics) {
      if (generated.length >= a.idea_count) break
      generated.push(
        ...generateOfflineIdeas(wizard, kit, { count: a.idea_count - generated.length, topic, avoidTitles: generated.map((i) => i.title) })
      )
    }
    const ideas = generated.slice(0, a.idea_count).map((idea) => ({ ...idea, pillar_id: null, persona_id: null, problem_id: null }))
    const knownTopics = areas.length ? listJoin(areas.slice(0, 3)) : a.industry || "My expertise"
    const chosen = chosenPillars(a)
    const niche = stripEndPunct(a.niche)
    return kit.scrubDeep({
      positioning_statement: positioning,
      known_for: niche
        ? kit.say(`${niche} — with real experience, real numbers and no hype.`, `${niche} — with real experience, real numbers at walang hype.`)
        : kit.say(
            `${knownTopics}${a.audience ? ` for ${audience}` : ""} — explained with real experience, real numbers and no hype.`,
            `${knownTopics}${a.audience ? ` para sa ${audience}` : ""} — explained with real experience, real numbers at walang hype.`
          ),
      point_of_view: beliefs.join(" "),
      pillar_suggestions: (chosen.length ? chosen : pillarMixFor(a.goals)).map((p) => ({
        name: p.name,
        description: !chosen.length && areas.length ? `${p.description} — through the lens of ${listJoin(lowerAreas.slice(0, 2))}.` : p.description,
        target_percentage: p.target,
      })),
      ideas,
    })
  },

  finalize(out, ctx, a) {
    const chosen = chosenPillars(a)
    const pillars = out.pillar_suggestions.filter((p) => p.name.trim()).slice(0, 8)
    const total = pillars.reduce((acc, p) => acc + Math.max(0, p.target_percentage), 0)
    const normalized = pillars.map((p) => ({ ...p, target_percentage: total ? Math.round((Math.max(0, p.target_percentage) / total) * 100) : Math.round(100 / Math.max(1, pillars.length)) }))
    if (normalized.length) normalized[0].target_percentage += 100 - normalized.reduce((acc, p) => acc + p.target_percentage, 0)
    return {
      ...out,
      // The creator's chosen pillars are the mix — a model can describe them but never rename or re-weight them.
      pillar_suggestions: chosen.length
        ? chosen.map((p) => ({ name: p.name, description: p.description || (pillars.find((x) => x.name.trim().toLowerCase() === p.name.toLowerCase())?.description ?? ""), target_percentage: p.target }))
        : normalized,
      // Nothing exists in the workspace yet — ids are always null.
      ideas: out.ideas.slice(0, a.idea_count).map((idea) => ({ ...finalizeIdea(idea, ctx), pillar_id: null, persona_id: null, problem_id: null })),
    }
  },
})
