import * as z from "zod"
import { IDEA_SCORE_DIMENSIONS, PLATFORMS } from "@/lib/constants"
import { createKit } from "../offline/brand"
import { scoreIdeaOffline } from "../offline/scoring"
import { seedFor } from "../offline/text"
import { labelOf } from "../refs"
import { clampInt, defineTask, funnelSchema, optionalId, platformSchema } from "./shared"

const input = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(3000).default(""),
  core_topic: z.string().max(300).default(""),
  hook: z.string().max(500).default(""),
  angle: z.string().max(80).default(""),
  talking_points: z.array(z.string().max(400)).max(12).default([]),
  pillar_id: optionalId,
  persona_id: optionalId,
  problem_id: optionalId,
  format: z.string().max(80).default(""),
  platforms: z.array(platformSchema).max(7).default([]),
  funnel_stage: funnelSchema.nullish().transform((v) => v ?? null),
})

const dimension = z.number().describe("Integer 1–10")
const output = z.object({
  scores: z.object({
    audience_relevance: dimension,
    authority_potential: dimension,
    business_alignment: dimension,
    timeliness: dimension,
    originality: dimension,
    repurposing_potential: dimension,
    ease_of_production: dimension,
  }),
  rationale: z.object({
    audience_relevance: z.string(),
    authority_potential: z.string(),
    business_alignment: z.string(),
    timeliness: z.string(),
    originality: z.string(),
    repurposing_potential: z.string(),
    ease_of_production: z.string(),
  }),
  summary: z.string().describe("Two sentences: overall verdict and the single change that would raise the score most"),
})

export const scoreIdeaTask = defineTask({
  name: "score_idea",
  description: "Idea Priority Score: seven 1–10 dimensions with a one-line rationale each.",
  input,
  output,
  maxTokens: 3000,

  buildPrompt(ctx, i) {
    const idea = {
      title: i.title,
      description: i.description,
      core_topic: i.core_topic,
      hook: i.hook,
      angle: i.angle,
      talking_points: i.talking_points,
      pillar: labelOf(ctx, "pillar", i.pillar_id) || null,
      persona: labelOf(ctx, "persona", i.persona_id) || null,
      problem: labelOf(ctx, "problem", i.problem_id) || null,
      format: i.format,
      platforms: i.platforms.map((p) => PLATFORMS[p].label),
      funnel_stage: i.funnel_stage,
    }
    return {
      user: [
        "Task: score this idea on the Idea Priority Score dimensions (1–10 each). It's a prioritisation aid for this brand — not a prediction of views.",
        `<idea>\n${JSON.stringify(idea, null, 1)}\n</idea>`,
        `Dimensions:\n${IDEA_SCORE_DIMENSIONS.map((d) => `- ${d.key}: ${d.description}`).join("\n")}`,
        "Score honestly: most ideas land 4–7; a 9–10 needs specific evidence in the context (a severe Problem Bank entry, a question asked many times, a matching winner, a real story). Each rationale is one sentence citing that evidence.",
      ].join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("score_idea", i))
    return scoreIdeaOffline(ctx, kit, i)
  },

  finalize(out) {
    const scores = Object.fromEntries(Object.entries(out.scores).map(([k, v]) => [k, clampInt(v, 1, 10, 5)])) as typeof out.scores
    return { ...out, scores }
  },
})
