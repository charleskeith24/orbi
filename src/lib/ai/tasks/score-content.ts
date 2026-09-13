import * as z from "zod"
import { PLATFORMS, QUALITY_DIMENSIONS, SCRIPT_FORMATS } from "@/lib/constants"
import { qualityRating, qualityTotal } from "@/lib/scoring"
import type { QualityRating } from "@/lib/types"
import { createKit } from "../offline/brand"
import { scoreContentOffline } from "../offline/scoring"
import { seedFor } from "../offline/text"
import { labelOf } from "../refs"
import { clampInt, defineTask, optionalId, platformSchema, scriptFormatSchema, uniqueStrings } from "./shared"

const input = z.object({
  text: z.string().trim().min(1, "Paste the draft first.").max(20000),
  format: scriptFormatSchema.default("custom"),
  platform: platformSchema.default("facebook"),
  hook: z.string().max(500).nullish().transform((v) => v || null),
  pillar_id: optionalId,
  persona_id: optionalId,
})

const ratingSchema = z.enum(["high_potential", "solid", "needs_work", "weak"] as [QualityRating, ...QualityRating[]])

const output = z.object({
  hook: z.number().describe("0–20"),
  relevance: z.number().describe("0–20"),
  value: z.number().describe("0–20"),
  clarity: z.number().describe("0–20"),
  authenticity: z.number().describe("0–20"),
  cta: z.number().describe("0–10"),
  total: z.number().describe("Normalised 0–100 (recomputed after scoring)"),
  rating: ratingSchema,
  strengths: z.array(z.string()).describe("2–4 specific strengths"),
  improvements: z.array(z.string()).describe("3–5 specific, actionable edits, each quoting what to change and how"),
})

export const scoreContentTask = defineTask({
  name: "score_content",
  description: "Content Score: a quality evaluation of a draft (hook, relevance, value, clarity, authenticity, CTA) with strengths and concrete improvements — not a virality prediction.",
  input,
  output,
  maxTokens: 3000,

  buildPrompt(ctx, i) {
    return {
      user: [
        `Task: evaluate the quality of this ${SCRIPT_FORMATS[i.format].label} for ${PLATFORMS[i.platform].label} against this brand's standards. This is a quality evaluation — not a prediction of views, reach or virality; never imply one.`,
        [i.pillar_id && `Pillar: ${labelOf(ctx, "pillar", i.pillar_id)}`, i.persona_id && `Persona: ${labelOf(ctx, "persona", i.persona_id)}`, i.hook && `Hook: ${i.hook}`].filter(Boolean).join("\n"),
        `<draft>\n${i.text}\n</draft>`,
        `Score each dimension:\n${QUALITY_DIMENSIONS.map((d) => `- ${d.key} (0–${d.max}): ${d.question}`).join("\n")}`,
        "Be calibrated: a solid, publishable draft lands around 70/100; reserve 17+/20 for genuinely excellent parts. Strengths quote what works. Improvements are concrete edits — quote the line and give the rewrite, in the creator's voice and language.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("score_content", i))
    const parts = scoreContentOffline(kit, i)
    const total = qualityTotal(parts)
    return { ...parts, total, rating: qualityRating(total) }
  },

  finalize(out) {
    const parts = {
      hook: clampInt(out.hook, 0, 20),
      relevance: clampInt(out.relevance, 0, 20),
      value: clampInt(out.value, 0, 20),
      clarity: clampInt(out.clarity, 0, 20),
      authenticity: clampInt(out.authenticity, 0, 20),
      cta: clampInt(out.cta, 0, 10),
    }
    const total = qualityTotal(parts)
    return { ...out, ...parts, total, rating: qualityRating(total), strengths: uniqueStrings(out.strengths, 5), improvements: uniqueStrings(out.improvements, 6) }
  },
})
