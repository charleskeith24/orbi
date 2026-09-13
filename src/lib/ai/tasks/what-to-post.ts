import * as z from "zod"
import { PLATFORMS } from "@/lib/constants"
import { createKit } from "../offline/brand"
import { hookSlots, writeHook } from "../offline/hooks"
import { seedFor } from "../offline/text"
import { analyzeTopic } from "../offline/topic"
import { labelOf, resolveRef } from "../refs"
import { contextRefSchema, defineTask, optionalId, pickListId, platformSchema } from "./shared"

export const whatToPostCandidateSchema = z.object({
  kind: z.enum(["idea", "item"]),
  id: z.string(),
  title: z.string().max(300),
  pillar_id: optionalId,
  platform: platformSchema,
  format: z.string().max(80).default(""),
  angle: z.string().max(80).default(""),
  hook: z.string().max(500).default(""),
  cta: z.string().max(400).default(""),
  score: z.number().default(0),
  reasons: z
    .object({ topic: z.string().max(300), platform: z.string().max(300), format: z.string().max(300), angle: z.string().max(300) })
    .partial()
    .default({}),
  signals: z.array(z.string().max(300)).max(10).default([]),
})

const input = z.object({
  candidates: z.array(whatToPostCandidateSchema).min(1, "Nothing to choose from yet — add ideas to the Idea Bank first.").max(12),
  today: z
    .object({
      date: z.string().max(10).default(""),
      weekday: z.string().max(12).default(""),
      slots: z.array(z.string().max(160)).max(6).default([]),
      buffer_days: z.number().nullable().default(null),
      published_this_week: z.number().default(0),
      weekly_target: z.number().default(0),
    })
    .default({ date: "", weekday: "", slots: [], buffer_days: null, published_this_week: 0, weekly_target: 0 }),
})

const pickSchema = z.object({
  title: z.string(),
  idea_id: z.string().nullable().describe('Candidate ref (e.g. "C2") when the pick is an idea candidate, else null'),
  item_id: z.string().nullable().describe('Candidate ref (e.g. "C1") when the pick is a content item candidate, else null'),
  pillar_id: contextRefSchema("content pillar", "P1"),
  platform: platformSchema,
  format: z.string(),
  angle: z.string(),
  hook: z.string(),
  cta: z.string(),
  why_topic: z.string(),
  why_platform: z.string(),
  why_format: z.string(),
  why_angle: z.string(),
})

const output = z.object({ pick: pickSchema, alternatives: z.array(pickSchema).describe("Up to 3") })

type Candidate = z.output<typeof whatToPostCandidateSchema>
type Pick = z.output<typeof pickSchema>

export const whatToPostTask = defineTask({
  name: "what_to_post",
  description: "Content Decision Engine: pick what to post next from the ranked candidates, with the reasoning for topic, platform, format and angle.",
  input,
  output,
  maxTokens: 3000,

  buildPrompt(ctx, i) {
    const list = i.candidates.map((c, n) => ({
      ref: `C${n + 1}`,
      kind: c.kind,
      title: c.title,
      pillar: labelOf(ctx, "pillar", c.pillar_id) || null,
      platform: PLATFORMS[c.platform].label,
      format: c.format,
      angle: c.angle,
      hook: c.hook,
      cta: c.cta,
      engine_score: c.score,
      engine_reasons: c.reasons,
      signals: c.signals,
    }))
    return {
      user: [
        "Task: decide what the creator should post next. The decision engine already ranked these candidates from the workspace data; use its scores and reasons, your read of the Brand HQ, and today's context.",
        `<today>\n${JSON.stringify(i.today, null, 1)}\n</today>`,
        `<candidates>\n${JSON.stringify(list, null, 1)}\n</candidates>`,
        "Pick one candidate (reference it by its C ref in idea_id or item_id, matching its kind) and up to 3 alternatives. Sharpen the hook and CTA in the creator's voice. Each why_* is one sentence citing the concrete reason (pillar gap, slot, audience demand, winner similarity, platform performance). Don't invent numbers.",
      ].join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("what_to_post", i))
    const sorted = [...i.candidates].sort((a, b) => b.score - a.score)
    const behind = i.today.weekly_target > 0 && i.today.published_this_week < i.today.weekly_target
    const toPick = (c: Candidate, lead: boolean): Pick => {
      const topic = analyzeTopic(c.title)
      const hook = c.hook.trim() || writeHook(kit.hookCategories()[0] ?? "curiosity", hookSlots(topic, kit, { story: kit.storyFor(c.title, { minHits: 2 }) }), kit, kit.rng).text
      const format = c.format || kit.formatFor(c.platform)?.name || ""
      const pillar = ctx.pillars.find((p) => p.id === c.pillar_id)
      return {
        title: c.title,
        idea_id: c.kind === "idea" ? c.id : null,
        item_id: c.kind === "item" ? c.id : null,
        pillar_id: c.pillar_id,
        platform: c.platform,
        format,
        angle: c.angle || "—",
        hook,
        cta: c.cta.trim() || kit.cta({ funnel: kit.funnelFor(c.title, pillar), platform: c.platform, topic: topic.subject }),
        why_topic: `${c.reasons.topic || c.signals[0] || "Strong fit with your pillars and audience"}${lead && behind ? ` — and you're at ${i.today.published_this_week}/${i.today.weekly_target} posts this week` : ""}.`.replace(/\.\./g, "."),
        why_platform: c.reasons.platform || `${PLATFORMS[c.platform].label} is one of your active platforms.`,
        why_format: c.reasons.format || (format ? `${format} fits ${PLATFORMS[c.platform].label}.` : "No format set yet — pick the one you can produce today."),
        why_angle: c.reasons.angle || "Keep the angle you planned.",
      }
    }
    return kit.scrubDeep({ pick: toPick(sorted[0], true), alternatives: sorted.slice(1, 4).map((c) => toPick(c, false)) })
  },

  finalize(out, ctx, i) {
    const fix = (p: Pick): Pick => {
      const ref = p.idea_id ?? p.item_id
      const id = pickListId(ref, i.candidates)
      const candidate = i.candidates.find((c) => c.id === id)
      return {
        ...p,
        idea_id: candidate?.kind === "idea" ? candidate.id : null,
        item_id: candidate?.kind === "item" ? candidate.id : null,
        pillar_id: resolveRef(ctx, "pillar", p.pillar_id) ?? candidate?.pillar_id ?? null,
      }
    }
    return { pick: fix(out.pick), alternatives: out.alternatives.slice(0, 3).map(fix) }
  },
})
