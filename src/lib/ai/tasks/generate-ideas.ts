import * as z from "zod"
import { FUNNEL_STAGES, PLATFORMS } from "@/lib/constants"
import type { PlatformId } from "@/lib/types"
import type { BrandContext } from "../context"
import { createKit } from "../offline/brand"
import { generateOfflineIdeas } from "../offline/ideas"
import { seedFor } from "../offline/text"
import { labelOf, resolveRef } from "../refs"
import {
  contextRefSchema,
  defineTask,
  funnelSchema,
  hookCategorySchema,
  optionalId,
  platformSchema,
  uniqueStrings,
} from "./shared"

/** One generated idea — shared by generate_ideas, onboarding_strategy and the strategist. */
export const generatedIdeaSchema = z.object({
  title: z.string(),
  core_idea: z.string().describe("1–2 sentences: the idea and what the audience gets"),
  why_it_matters: z.string().describe("Reasoning grounded in the context (problem, question, pillar gap, goal, winner)"),
  hook: z.string(),
  hook_category: hookCategorySchema,
  format: z.string().describe("Name of a content format from the context"),
  angle: z.string().describe("Angle name, preferably from the Angles list"),
  talking_points: z.array(z.string()),
  cta: z.string(),
  platform: platformSchema,
  funnel_stage: funnelSchema,
  pillar_id: contextRefSchema("content pillar", "P1"),
  persona_id: contextRefSchema("persona", "A1"),
  problem_id: contextRefSchema("Problem Bank entry", "R1"),
})

export type GeneratedIdea = z.output<typeof generatedIdeaSchema>

/** Map refs back to ids and apply fixed constraints from the request. */
export function finalizeIdea(
  idea: GeneratedIdea,
  ctx: BrandContext,
  fixed: { pillarId?: string | null; personaId?: string | null; problemId?: string | null; platform?: PlatformId | null } = {}
): GeneratedIdea {
  const format = ctx.formats.find((f) => f.name.toLowerCase() === idea.format.toLowerCase()) ?? ctx.formats.find((f) => resolveRef(ctx, "format", idea.format) === f.id)
  return {
    ...idea,
    format: format?.name ?? idea.format,
    platform: fixed.platform ?? idea.platform,
    pillar_id: resolveRef(ctx, "pillar", idea.pillar_id) ?? fixed.pillarId ?? null,
    persona_id: resolveRef(ctx, "persona", idea.persona_id) ?? fixed.personaId ?? null,
    problem_id: resolveRef(ctx, "problem", idea.problem_id) ?? fixed.problemId ?? null,
    talking_points: uniqueStrings(idea.talking_points, 6),
  }
}

const input = z.object({
  pillar_id: optionalId,
  persona_id: optionalId,
  platform: platformSchema.nullish().transform((v) => v ?? null),
  goal_id: optionalId,
  topic: z.string().trim().max(500).nullish().transform((v) => v || null),
  funnel_stage: funnelSchema.nullish().transform((v) => v ?? null),
  angle: z.string().trim().max(80).nullish().transform((v) => v || null),
  format_id: optionalId,
  problem_id: optionalId,
  count: z.number().int().min(1).max(30).default(10),
})

const output = z.object({ ideas: z.array(generatedIdeaSchema) })

export const generateIdeasTask = defineTask({
  name: "generate_ideas",
  description: "Idea Generator: N strategic ideas filtered by pillar, persona, platform, goal, topic, funnel stage, angle, format or problem.",
  input,
  output,
  maxTokens: 16000,

  buildPrompt(ctx, i) {
    const goal = ctx.goals.find((g) => g.id === i.goal_id)
    const format = ctx.formats.find((f) => f.id === i.format_id)
    const constraints = [
      i.topic && `Topic: ${i.topic}`,
      i.pillar_id && `Pillar: ${labelOf(ctx, "pillar", i.pillar_id) || i.pillar_id}`,
      i.persona_id && `Persona: ${labelOf(ctx, "persona", i.persona_id) || i.persona_id}`,
      i.problem_id && `Audience problem: ${labelOf(ctx, "problem", i.problem_id) || i.problem_id}`,
      i.platform && `Platform: ${PLATFORMS[i.platform].label}`,
      goal && `Goal: ${labelOf(ctx, "goal", goal.id)} (${goal.category})`,
      i.funnel_stage && `Funnel stage: ${FUNNEL_STAGES[i.funnel_stage].label} — ${FUNNEL_STAGES[i.funnel_stage].goal}`,
      i.angle && `Angle: ${i.angle}`,
      format && `Format: ${format.name}`,
    ].filter(Boolean)
    return {
      user: [
        `Task: Idea Generator. Generate exactly ${i.count} content ideas for ${ctx.brand.name || "the creator"}.`,
        constraints.length ? `Constraints (every idea must respect these):\n${constraints.map((c) => `- ${c}`).join("\n")}` : "No constraints — balance the ideas across pillars (favour pillars under their target), personas and funnel stages (toward the funnel targets).",
        "Each idea must be distinct (different angle or problem), grounded in a real Problem Bank entry, question, story, winner or pillar example from the context, and must not repeat a recently published title.",
        "Vary hook styles, leaning on the styles that perform best for this brand. why_it_matters cites the specific reason (problem severity, times asked, pillar gap, goal, similar winner). talking_points: 3–4 concrete points. cta follows the brand's CTA style and the funnel stage.",
      ].join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("generate_ideas", i))
    const ideas = generateOfflineIdeas(ctx, kit, {
      count: i.count,
      pillarId: i.pillar_id,
      personaId: i.persona_id,
      platform: i.platform,
      goalCategory: ctx.goals.find((g) => g.id === i.goal_id)?.category ?? null,
      topic: i.topic,
      funnel: i.funnel_stage,
      angle: i.angle,
      formatId: i.format_id,
      problemId: i.problem_id,
    })
    return { ideas: kit.scrubDeep(ideas) }
  },

  finalize(out, ctx, i) {
    return {
      ideas: out.ideas
        .slice(0, i.count)
        .map((idea) => finalizeIdea(idea, ctx, { pillarId: i.pillar_id, personaId: i.persona_id, problemId: i.problem_id, platform: i.platform })),
    }
  },
})
