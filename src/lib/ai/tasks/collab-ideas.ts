import * as z from "zod"
import { COLLAB_TYPES, PLATFORMS } from "@/lib/constants"
import { createKit } from "../offline/brand"
import { generateCollabIdeas } from "../offline/collabs"
import { seedFor } from "../offline/text"
import { resolveRef } from "../refs"
import { collabTypeSchema, contextRefSchema, defineTask, platformSchema } from "./shared"

const input = z.object({
  count: z.number().int().min(1).max(8).default(5),
  /** What the creator wants from collabs right now, e.g. "grow on TikTok" or "land group brand deals". */
  focus: z.string().trim().max(300).nullish().transform((v) => v || null),
  /** Titles already shown (Regenerate) — the next batch avoids them. */
  exclude: z.array(z.string().trim().max(200)).max(24).default([]),
})

export const collabIdeaSchema = z.object({
  type: collabTypeSchema,
  title: z.string().describe("A concrete collab concept, 4–12 words — never just “Collab with …”"),
  partner_niche: z.string().describe("Short label for the partner's niche (2–5 words), e.g. “Freelance skills”"),
  partner_kind: z
    .string()
    .describe("The kind of creator to look for: an ADJACENT niche that shares this audience without competing. Never a named real person, brand or @handle."),
  why_it_fits: z.string().describe("1–2 sentences: the audience overlap, what each side brings and why the format works"),
  platform: platformSchema,
  format: z.string().describe("Name of a content format from the context (or the obvious one for the type)"),
  pillar_id: contextRefSchema("content pillar", "P1"),
})

const output = z.object({ ideas: z.array(collabIdeaSchema) })

/** "@name", links and "u/name" never reach the UI — partners are kinds of creators, not accounts. */
function stripAccounts(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/(^|\s)@[\w.]+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export const collabIdeasTask = defineTask({
  name: "collab_ideas",
  description: "Collab ideas: creator collaborations with adjacent niches that share the audience without competing — type, concept, partner to look for, fit, platform and format.",
  input,
  output,
  maxTokens: 4000,

  buildPrompt(ctx, i) {
    const types = COLLAB_TYPES.map((t) => `${t.id} (${t.label}: ${t.description})`).join("; ")
    const platforms = ctx.platforms.map((p) => PLATFORMS[p.platform].label).join(", ") || "not set yet"
    return {
      user: [
        `Task: Collab ideas. Suggest exactly ${i.count} collaboration ideas for ${ctx.brand.name || "the creator"} with other creators.`,
        [
          "Rules:",
          "- The partner is a KIND of creator in an adjacent niche: they talk to the same people as this creator about a different problem, so both gain followers without competing (e.g. personal finance ↔ freelancing, online selling ↔ product photography). Never suggest a creator in the same niche.",
          "- Never name a real person, brand, show or account, and never write an @handle or a link.",
          `- Use a different collab type for each idea where it makes sense. Types: ${types}.`,
          `- platform: one of the creator's active platforms (${platforms}); format: a content format name from the context, or the obvious one for the type.`,
          "- why_it_fits cites the concrete overlap from the Brand Context (niche, personas, their problems, pillars, goals) and why the format works for both sides.",
          "- Engagement pods, follow-for-follow and anything that breaks platform rules are never collabs.",
        ].join("\n"),
        i.focus ? `What the creator wants from collabs right now: ${i.focus}` : "",
        i.exclude.length ? `Already suggested — don't repeat these:\n${i.exclude.map((t) => `- ${t}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("collab_ideas", i))
    return { ideas: kit.scrubDeep(generateCollabIdeas(ctx, kit, { count: i.count, focus: i.focus, exclude: i.exclude })) }
  },

  finalize(out, ctx, i) {
    const seen = new Set<string>()
    const ideas = out.ideas
      .map((idea) => ({
        ...idea,
        title: stripAccounts(idea.title),
        partner_niche: stripAccounts(idea.partner_niche),
        partner_kind: stripAccounts(idea.partner_kind),
        why_it_fits: stripAccounts(idea.why_it_fits),
        pillar_id: resolveRef(ctx, "pillar", idea.pillar_id),
      }))
      .filter((idea) => {
        const key = idea.title.toLowerCase()
        if (!idea.title || seen.has(key)) return false
        seen.add(key)
        return true
      })
    return { ideas: ideas.slice(0, i.count) }
  },
})
