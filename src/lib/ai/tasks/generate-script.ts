import * as z from "zod"
import { FUNNEL_STAGES, PLATFORMS, SCRIPT_FORMATS } from "@/lib/constants"
import { createKit } from "../offline/brand"
import { buildSections, captionFor, hashtagsFor, materialFrom } from "../offline/scripts"
import { hashtag, seedFor } from "../offline/text"
import { labelOf, refOf } from "../refs"
import { defineTask, fixSections, funnelSchema, optionalId, platformSchema, scriptFormatSchema, sectionSchema, uniqueStrings } from "./shared"

const briefSchema = z
  .object({
    objective: z.string().max(1000),
    main_message: z.string().max(1000),
    supporting_points: z.array(z.string().max(500)).max(10),
    cta: z.string().max(400),
    visual_direction: z.string().max(1000),
    caption: z.string().max(2000),
    production_notes: z.string().max(1000),
  })
  .partial()
  .default({})

const input = z.object({
  format: scriptFormatSchema,
  title: z.string().trim().min(1).max(300),
  platform: platformSchema.default("facebook"),
  hook: z.string().max(500).default(""),
  description: z.string().max(3000).default(""),
  brief: briefSchema,
  pillar_id: optionalId,
  persona_id: optionalId,
  problem_id: optionalId,
  funnel_stage: funnelSchema.nullish().transform((v) => v ?? null),
  story_ids: z.array(z.string()).max(5).default([]),
  notes: z.string().max(2000).default(""),
  /** The idea's talking points (used when the brief has no supporting points). */
  talking_points: z.array(z.string().max(400)).max(12).default([]),
  /** The item's current script, when rewriting or converting an existing draft. */
  current_script: z.string().max(12000).default(""),
})

const output = z.object({
  title: z.string(),
  sections: z.array(sectionSchema).describe("Exactly the requested sections, in order, with the given keys and labels"),
  caption: z.string(),
  hashtags: z.array(z.string()),
})

export const generateScriptTask = defineTask({
  name: "generate_script",
  description: "Content Studio: a full script in any SCRIPT_FORMATS structure, in the brand voice, weaving in a Story Vault story.",
  input,
  output,
  maxTokens: 8000,

  buildPrompt(ctx, i) {
    const spec = SCRIPT_FORMATS[i.format]
    const stories = i.story_ids.map((id) => labelOf(ctx, "story", id)).filter(Boolean)
    const piece = {
      title: i.title,
      platform: PLATFORMS[i.platform].label,
      hook: i.hook,
      description: i.description,
      brief: i.brief,
      pillar: labelOf(ctx, "pillar", i.pillar_id) || null,
      persona: labelOf(ctx, "persona", i.persona_id) || null,
      problem: labelOf(ctx, "problem", i.problem_id) || null,
      funnel_stage: i.funnel_stage ? FUNNEL_STAGES[i.funnel_stage].label : null,
      notes: i.notes,
      talking_points: i.talking_points,
    }
    return {
      user: [
        `Task: write a ${spec.label} (${spec.description}) for ${PLATFORMS[i.platform].label}.`,
        `<piece>\n${JSON.stringify(piece, null, 1)}\n</piece>`,
        i.current_script.trim()
          ? `<current_draft>\n${i.current_script}\n</current_draft>\nThis piece already has a draft. Keep its facts, numbers and strongest lines; rewrite it into the requested format rather than starting over.`
          : "",
        `Write exactly these sections, in this order, with these keys and labels:\n${spec.sections.map((s) => `- key "${s.key}", label "${s.label}": ${s.hint}`).join("\n")}`,
        stories.length
          ? `Weave in this Story Vault story as the proof: ${stories.join("; ")}. Use only its real details.`
          : `If a Story Vault story genuinely fits (${ctx.stories.slice(0, 5).map((s) => refOf(ctx, "story", s.id)).join(", ")}…), weave it in with its real details; if none fits, don't invent one — use a clear [placeholder] instead.`,
        "Write final, ready-to-record/post copy in the creator's voice and language — not an outline. Keep the hook if one is given (tighten it if needed). Caption fits the platform; 3–8 relevant hashtags (none for LinkedIn unless natural).",
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("generate_script", i))
    const chosen = i.story_ids.map((id) => ctx.stories.find((s) => s.id === id)).find(Boolean) ?? null
    const briefPoints = i.brief.supporting_points ?? []
    const text = `${i.title}. ${i.description} ${i.brief.main_message ?? ""} ${[...briefPoints, ...i.talking_points].join(". ")} ${i.notes}`
    const problem = ctx.problems.find((p) => p.id === i.problem_id) ?? kit.problemFor(text)
    const m = materialFrom(
      {
        title: i.title,
        hook: i.hook,
        message: i.brief.main_message || i.description,
        points: briefPoints.length ? briefPoints : i.talking_points,
        cta: i.brief.cta,
        platform: i.platform,
        story: chosen ?? undefined,
        problem: problem?.problem ?? null,
        text: `${i.description} ${i.notes}`,
        funnel: i.funnel_stage ?? undefined,
        script: i.current_script,
      },
      kit
    )
    return {
      title: i.title,
      sections: buildSections(i.format, m, kit),
      caption: i.brief.caption?.trim() || captionFor(m, i.format, kit),
      hashtags: i.platform === "linkedin" ? hashtagsFor(m, kit, 3) : hashtagsFor(m, kit, 5),
    }
  },

  finalize(out, _ctx, i) {
    return {
      ...out,
      title: out.title.trim() || i.title,
      sections: fixSections(i.format, out.sections),
      hashtags: uniqueStrings(out.hashtags.map((h) => (h.trim().startsWith("#") ? h.trim() : hashtag(h))).filter((h) => h.length > 1), 10),
    }
  },
})
