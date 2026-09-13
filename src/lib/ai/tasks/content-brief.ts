import * as z from "zod"
import { FUNNEL_STAGES, PLATFORMS } from "@/lib/constants"
import type { ScriptFormat } from "@/lib/types"
import { audienceFromPersona, createKit } from "../offline/brand"
import { buildSections, captionFor, materialFrom } from "../offline/scripts"
import { clip, lowerFirst, seedFor, sentence, stripEndPunct, upperFirst } from "../offline/text"
import { labelOf } from "../refs"
import { defineTask, funnelSchema, optionalId, platformSchema, uniqueStrings } from "./shared"

const input = z.object({
  title: z.string().trim().min(1).max(300),
  platform: platformSchema.default("facebook"),
  format: z.string().max(80).default(""),
  hook: z.string().max(500).default(""),
  description: z.string().max(3000).default(""),
  why_it_matters: z.string().max(2000).default(""),
  talking_points: z.array(z.string().max(400)).max(12).default([]),
  cta: z.string().max(400).default(""),
  angle: z.string().max(80).default(""),
  pillar_id: optionalId,
  persona_id: optionalId,
  problem_id: optionalId,
  goal_id: optionalId,
  funnel_stage: funnelSchema.nullish().transform((v) => v ?? null),
  notes: z.string().max(2000).default(""),
  /** The item's current script, when the brief is written after a draft exists. */
  current_script: z.string().max(12000).default(""),
})

const output = z.object({
  objective: z.string().describe("What this piece must achieve, for whom, at which funnel stage"),
  main_message: z.string().describe("The one sentence the audience should remember"),
  supporting_points: z.array(z.string()).describe("3–5 points that prove or unpack the message"),
  cta: z.string(),
  visual_direction: z.string(),
  reference_ideas: z.string().describe("Structures or past winners to model (structure only, never copy)"),
  caption: z.string(),
  production_notes: z.string(),
  b_roll: z.array(z.string()),
  on_screen_text: z.array(z.string()),
})

export const contentBriefTask = defineTask({
  name: "content_brief",
  description: "Content Brief: objective, main message, supporting points, CTA, visual direction, references, caption, production notes, B-roll, on-screen text.",
  input,
  output,
  maxTokens: 4000,

  buildPrompt(ctx, i) {
    const piece = {
      title: i.title,
      platform: PLATFORMS[i.platform].label,
      format: i.format,
      hook: i.hook,
      description: i.description,
      why_it_matters: i.why_it_matters,
      talking_points: i.talking_points,
      cta: i.cta,
      angle: i.angle,
      pillar: labelOf(ctx, "pillar", i.pillar_id) || null,
      persona: labelOf(ctx, "persona", i.persona_id) || null,
      problem: labelOf(ctx, "problem", i.problem_id) || null,
      goal: labelOf(ctx, "goal", i.goal_id) || null,
      funnel_stage: i.funnel_stage ? FUNNEL_STAGES[i.funnel_stage].label : null,
      notes: i.notes,
    }
    return {
      user: [
        "Task: write the Content Brief for this piece — the strategic plan a creator or editor can produce from.",
        `<piece>\n${JSON.stringify(piece, null, 1)}\n</piece>`,
        i.current_script.trim() ? `<current_draft>\n${i.current_script}\n</current_draft>\nA draft already exists — base the brief on its facts and numbers.` : "",
        "Objective names the persona, the result and the funnel stage. Main message is one memorable sentence in the creator's voice. Supporting points are concrete (use Story Vault facts and real numbers from the context where they fit). Visual direction, B-roll and on-screen text fit the platform and format. reference_ideas points to structures or the creator's own past winners to model — never other creators' words. Caption follows the platform's norms and the brand's CTA style.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("content_brief", i))
    const text = `${i.title}. ${i.description} ${i.talking_points.join(". ")} ${i.notes}`
    const pillar = ctx.pillars.find((p) => p.id === i.pillar_id) ?? kit.pillarFor(text)
    const persona = ctx.personas.find((p) => p.id === i.persona_id) ?? kit.personaFor(text)
    const problem = ctx.problems.find((p) => p.id === i.problem_id) ?? kit.problemFor(text, { personaId: persona?.id })
    const funnel = i.funnel_stage ?? kit.funnelFor(text, pillar)
    const m = materialFrom(
      { title: i.title, hook: i.hook, message: i.description, points: i.talking_points, cta: i.cta, platform: i.platform, problem: problem?.problem ?? null, text: i.notes, funnel, script: i.current_script },
      kit
    )
    const scriptFormat: ScriptFormat = ctx.formats.find((f) => f.name.toLowerCase() === i.format.toLowerCase())?.script_format ?? (i.platform === "linkedin" ? "linkedin_post" : i.platform === "facebook" ? "facebook_post" : "short_video")
    const production = buildSections("video_brief", m, kit)
    const lines = (key: string) =>
      (production.find((s) => s.key === key)?.content ?? "")
        .split("\n")
        .map((l) => l.replace(/^-\s*/, "").trim())
        .filter(Boolean)
    const goal = ctx.goals.find((g) => g.id === i.goal_id) ?? ctx.goals.find((g) => g.is_primary)
    const outcome = funnel === "tofu" ? "discover you and want more" : funnel === "mofu" ? "trust your method enough to save it and come back" : "take the next step with you"
    const winner = ctx.winners.find((w) => (pillar && w.pillar_id === pillar.id) || w.platform === i.platform)
    const who = persona ? audienceFromPersona(persona.name) : m.audience
    // The idea's own description is the message when it's written for the audience; otherwise the takeaway.
    const ownMessage = m.message.toLowerCase() !== sentence(i.title).toLowerCase() ? m.message : null
    return kit.scrubDeep({
      objective: `Help ${who} ${m.contrast ? `switch from ${m.contrast.from} to ${m.contrast.to}` : `get ${m.short ?? m.subject} right`} so they ${outcome} — ${FUNNEL_STAGES[funnel].label} (${FUNNEL_STAGES[funnel].name.toLowerCase()})${goal ? `, supporting “${goal.name}”` : ""}.`,
      main_message: m.contrast ? `${upperFirst(m.contrast.to)} beat ${m.contrast.from} — and switching is simpler than it looks.` : (ownMessage ?? m.takeaway),
      supporting_points: uniqueStrings([...m.points.map((p) => `${stripEndPunct(p)}.`), m.story ? `Proof: ${clip(m.story.result || m.story.lesson || m.story.title, 160)}` : ""], 5),
      cta: m.cta,
      visual_direction: production.find((s) => s.key === "visual_direction")?.content ?? "",
      reference_ideas: winner
        ? `Model the structure of your winner “${stripEndPunct(winner.title)}” (${winner.ratio ? `${winner.ratio.toFixed(1)}× your average` : winner.tier})${winner.why_it_worked ? `: ${lowerFirst(stripEndPunct(clip(winner.why_it_worked, 160)))}` : ""}. Borrow the structure, not the words.`
        : `Open on the tension in the hook, prove it with ${m.story ? `“${stripEndPunct(m.story.title)}”` : "one real example"}, then give one action. Study how operators in ${kit.industry} show their work on screen — structure only.`,
      caption: captionFor(m, scriptFormat, kit),
      production_notes: [
        i.platform === "tiktok" || i.platform === "instagram" || i.platform === "youtube" ? "Record the hook three ways and keep the best take; aim for 45–75 seconds." : "Write the first two lines last — they decide whether anyone taps “see more”.",
        m.story ? `Have the details of “${stripEndPunct(m.story.title)}” in front of you so the numbers are exact.` : "Bring one real number or example before recording.",
        pillar ? `Batch it with your next ${pillar.name} piece to save setup time.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      b_roll: lines("b_roll"),
      on_screen_text: lines("on_screen_text"),
    })
  },

  finalize(out) {
    return { ...out, supporting_points: uniqueStrings(out.supporting_points, 6), b_roll: uniqueStrings(out.b_roll, 8), on_screen_text: uniqueStrings(out.on_screen_text, 10) }
  },
})
