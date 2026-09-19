import * as z from "zod"
import { COLLAB_TYPE_MAP, PLATFORMS } from "@/lib/constants"
import { createKit } from "../offline/brand"
import { writeCollabPitch } from "../offline/collabs"
import { seedFor } from "../offline/text"
import { collabTypeSchema, defineTask, inputText, jsonBlock, platformSchema } from "./shared"

const input = z.object({
  type: collabTypeSchema.default("other"),
  title: inputText(200).default(""),
  partner_name: inputText(120).default(""),
  partner_handle: inputText(120).default(""),
  partner_platform: platformSchema.nullish().transform((v) => v ?? null),
  partner_niche: inputText(160).default(""),
  partner_followers: z.number().nonnegative().nullish().transform((v) => v ?? null),
  collab_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish()
    .transform((v) => v ?? null),
  notes: inputText(1000).default(""),
  /** The current draft — a regenerate writes a different version. */
  previous: inputText(2000).default(""),
})

const output = z.object({
  message: z.string().describe("The DM, 50–110 words, ready to paste"),
})

export const collabPitchTask = defineTask({
  name: "collab_pitch",
  description: "Collab outreach pitch: a short, friendly DM to a potential collab partner — what's in it for them, the format and one concrete first step.",
  input,
  output,
  maxTokens: 1200,

  buildPrompt(ctx, i) {
    const collab = {
      type: `${COLLAB_TYPE_MAP[i.type].label} — ${COLLAB_TYPE_MAP[i.type].description}`,
      working_title: i.title || null,
      partner_name: i.partner_name || null,
      partner_handle: i.partner_handle || null,
      partner_platform: i.partner_platform ? PLATFORMS[i.partner_platform].label : null,
      partner_niche: i.partner_niche || null,
      approx_followers: i.partner_followers,
      proposed_date: i.collab_date,
      creator_notes: i.notes || null,
    }
    return {
      user: [
        `Task: write the first outreach DM from ${ctx.brand.name || "the creator"} to a potential collab partner.`,
        jsonBlock("collab", collab),
        [
          "Rules:",
          "- 50–110 words, one message, in the creator's writing language (follow the Language rule). Friendly and specific, like one creator texting another.",
          "- No flattery templates (“I love your content!”, “big fan”, “your content is amazing”), no hype, no emojis walls.",
          "- Say what's in it for the partner: what their audience gets and the format (use the collab type).",
          "- End with ONE concrete first step: a date, a 3-line outline, or a quick call.",
          "- Greet them by first name or handle when given. Never invent facts about them, their numbers or their past posts.",
          "- Never propose engagement pods, follow-for-follow or anything against platform rules.",
        ].join("\n"),
        i.previous ? `Write a clearly different version from this previous draft:\n<previous>\n${i.previous}\n</previous>` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("collab_pitch", i))
    const message = writeCollabPitch(ctx, kit, {
      type: i.type,
      title: i.title,
      partner_name: i.partner_name,
      partner_handle: i.partner_handle,
      partner_platform: i.partner_platform,
      partner_niche: i.partner_niche,
      collab_date: i.collab_date,
      previous: i.previous,
    })
    return { message: kit.scrub(message) }
  },

  finalize(out) {
    return { message: out.message.trim() }
  },
})
