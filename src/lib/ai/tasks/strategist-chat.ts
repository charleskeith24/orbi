import * as z from "zod"
import { analyticsSnapshotSchema } from "../context"
import { createKit } from "../offline/brand"
import { strategistOffline } from "../offline/strategist"
import { seedFor } from "../offline/text"
import { renderSnapshot } from "../prompts/system"
import { resolveRef } from "../refs"
import { contextRefSchema, defineTask, platformSchema, uniqueStrings } from "./shared"

const input = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(8000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1]?.role === "user", "The last message must be from the user."),
  snapshot: analyticsSnapshotSchema,
})

const output = z.object({
  reply: z.string().describe("Markdown. Lead with the answer, then the reasoning with the numbers."),
  suggested_ideas: z.array(
    z.object({
      title: z.string(),
      hook: z.string(),
      pillar_id: contextRefSchema("content pillar", "P1"),
      platform: platformSchema,
      format: z.string(),
    })
  ),
  follow_up_questions: z.array(z.string()).describe("2–3 short next questions the creator might ask"),
})

export const strategistChatTask = defineTask({
  name: "strategist_chat",
  description: "Content Strategist: a multi-turn strategy conversation grounded in Brand HQ and the live analytics snapshot.",
  input,
  output,
  maxTokens: 5000,

  buildPrompt(ctx, i) {
    const turns = i.messages
    return {
      system: [
        "# Your role in this conversation",
        "You are the creator's Content Strategist. Answer like a sharp, honest strategist who knows their numbers: lead with the answer, then the reasoning, citing the specific numbers below. Keep it tight — short paragraphs or bullets, markdown allowed.",
        "Recommendations must weigh positioning, audience, goals, platform, pillar, funnel stage, recent performance, existing content, audience problems and previous winners — whichever actually apply. If the data can't support an answer, say what's missing and what to log.",
        "suggested_ideas: only when the answer naturally produces content ideas (0–5). follow_up_questions: 2–3 useful next questions.",
        "",
        `# Live analytics snapshot (${i.snapshot.today || "today"})`,
        renderSnapshot(i.snapshot, ctx),
      ].join("\n"),
      history: turns.slice(0, -1),
      user: turns[turns.length - 1].content,
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("strategist_chat", i.messages))
    return strategistOffline(ctx, kit, i.messages, i.snapshot)
  },

  finalize(out, ctx) {
    return {
      reply: out.reply.trim(),
      suggested_ideas: out.suggested_ideas.slice(0, 10).map((idea) => ({ ...idea, pillar_id: resolveRef(ctx, "pillar", idea.pillar_id) })),
      follow_up_questions: uniqueStrings(out.follow_up_questions, 3),
    }
  },
})
