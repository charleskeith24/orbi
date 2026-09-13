import * as z from "zod"
import { PLATFORMS } from "@/lib/constants"
import type { HookCategory } from "@/lib/types"
import { audienceFromPersona, createKit } from "../offline/brand"
import { experienceStory, parseExperience } from "../offline/experience"
import { hookSlots, writeHook } from "../offline/hooks"
import { povLine } from "../offline/scripts"
import { headline, seedFor, sentence, splitSentences, stripEndPunct, upperFirst } from "../offline/text"
import { agreeVerb, analyzeTopic, answerTitle } from "../offline/topic"
import { resolveRef } from "../refs"
import {
  contextRefSchema,
  defineTask,
  formatIdByName,
  funnelSchema,
  goalCategorySchema,
  hookCategorySchema,
  inputText,
  platformSchema,
  uniqueStrings,
} from "./shared"

const input = z.object({
  text: inputText(4000).min(1, "Write the idea first."),
})

const output = z.object({
  title: z.string().describe("Specific working title, under ~90 characters"),
  core_topic: z.string().describe("The topic in 2–6 words"),
  pillar_id: contextRefSchema("content pillar", "P1"),
  persona_id: contextRefSchema("persona", "A1"),
  problem_id: contextRefSchema("Problem Bank entry", "R1"),
  hook: z.string(),
  hook_category: hookCategorySchema,
  angle: z.string().describe("Angle name, preferably from the Angles list"),
  format: z.string().describe("Name of a content format from the context"),
  format_id: contextRefSchema("content format", "F1"),
  platforms: z.array(platformSchema).describe("1–3 of the active platforms"),
  goal_category: goalCategorySchema,
  funnel_stage: funnelSchema,
  description: z.string().describe("2–3 sentences: the idea and what the audience gets"),
  why_it_matters: z.string().describe("2–3 sentences of reasoning grounded in the context"),
  talking_points: z.array(z.string()).describe("3–5 concrete points"),
})

const TIME_LEAD = /^(?:yesterday|today|this morning|last (?:night|week|month|year)|kanina|kahapon|ngayon|earlier(?: today)?)[,\s]+/i

/** A title from the note's claim: cut at a clause boundary, never mid-phrase. */
function titleFromClaim(claim: string): string {
  const c = upperFirst(stripEndPunct(claim.replace(TIME_LEAD, "")))
  const words = c.split(" ")
  if (words.length <= 14) return c
  const cut = words.findIndex((w, i) => i >= 6 && i <= 14 && /^(when|because|but|so|and|while|if|which|then)$/i.test(w))
  return cut > 0 ? words.slice(0, cut).join(" ") : headline(c, 12)
}

const ANGLE_HOOKS: Record<string, HookCategory[]> = {
  Contrarian: ["contrarian", "warning", "question", "curiosity"],
  Story: ["story", "results"],
  Mistake: ["mistake", "warning", "list"],
  Tutorial: ["list", "problem", "curiosity"],
  Checklist: ["list"],
  Question: ["question", "curiosity"],
  Observation: ["curiosity", "contrarian", "question", "authority"],
}

export const captureIdeaTask = defineTask({
  name: "capture_idea",
  description: "Quick Capture: turn a rough note into a structured idea (pillar, persona, problem, hook, angle, format, platforms, goal, funnel, talking points).",
  input,
  output,
  maxTokens: 3000,

  buildPrompt(ctx, { text }) {
    return {
      user: [
        `Task: Quick Capture. Turn this rough note from ${ctx.brand.name || "the creator"} into one structured content idea.`,
        `<note>\n${text}\n</note>`,
        "Keep the creator's original insight — sharpen it, don't replace it.",
        "Pick the pillar, persona and Problem Bank entry it best serves (refs; null when nothing genuinely fits), a hook style and angle that suit it (favour hook styles that perform well for this brand), a content format from the list, and 1–3 active platforms.",
        "why_it_matters: 2–3 sentences citing the specific audience problem or question, pillar gap, goal or past winner it connects to. talking_points: 3–5 concrete points in the creator's voice.",
      ].join("\n\n"),
    }
  },

  offline(ctx, { text }) {
    const kit = createKit(ctx, seedFor("capture_idea", text))
    const topic = analyzeTopic(text)
    const subject = kit.subjectFor(text)
    // The audience problem the note is about decides its pillar and persona when there is one.
    const problem = kit.problemFor(text)
    const pillar = ctx.pillars.find((p) => p.id === problem?.pillar_id) ?? kit.pillarFor(text)
    const persona = ctx.personas.find((p) => p.id === problem?.persona_id) ?? kit.personaFor(text)
    const question = kit.questionFor(text)
    const s = topic.signals
    const sentences = splitSentences(text)
    // A first-person moment ("Yesterday a client asked …") is the story itself — don't borrow another one.
    const ownStory = s.story && sentences.length >= 2 ? experienceStory(parseExperience(text, kit)) : null
    const story = ownStory ? null : kit.storyFor(text, { pillarId: pillar?.id, minHits: 2 })
    const funnel = kit.funnelFor(text, pillar)
    const platforms = kit.platformsFor({ pillarId: pillar?.id, personaId: persona?.id }).slice(0, 2)
    const angleName = ownStory || (s.story && story) ? "Story" : s.mistake ? "Mistake" : s.howTo ? "Tutorial" : s.list ? "Checklist" : topic.contrast || s.opinion ? "Contrarian" : s.question ? "Question" : "Observation"
    const angle = ctx.angles.find((a) => a.name.toLowerCase() === angleName.toLowerCase())?.name ?? angleName
    const compatible = ANGLE_HOOKS[angleName] ?? ["curiosity"]
    const hookStory = story ?? ownStory
    const category = kit.hookCategories().find((c) => compatible.includes(c) && (c !== "story" || hookStory)) ?? compatible[0]
    const hook = writeHook(category, hookSlots(topic, kit, { subject, story: hookStory, problem: problem?.problem ?? null, question: question?.question ?? null }), kit)

    const audience = topic.audience ?? kit.audience
    const c = topic.contrast
    let title: string
    if (c && topic.action) {
      title = kit.rng.chance(0.5)
        ? `${upperFirst(c.to)} over ${c.from}: how ${audience} should ${topic.action}`
        : `${upperFirst(c.from)} isn't a strategy. ${upperFirst(c.to)} ${agreeVerb(c.to, "are", "is")}.`
    } else if (c) {
      title = `${upperFirst(c.to)} over ${c.from}`
    } else if (s.question) {
      title = answerTitle(topic.claim)
    } else {
      title = titleFromClaim(topic.claim || text)
    }

    const pov = povLine(kit, text)
    const format = kit.formatFor(platforms[0], s.howTo || s.list ? "visual" : null)
    const problemPersona = problem ? ctx.personas.find((p) => p.id === problem.persona_id) : null
    const hookPerf = kit.hookRatio(hook.category)
    const reasons = [
      pov ? `It's your point of view in action: “${stripEndPunct(pov)}.”` : "",
      problem
        ? `${upperFirst(problemPersona ? audienceFromPersona(problemPersona.name) : "your audience")} live this problem — “${stripEndPunct(problem.problem)}” (severity ${problem.severity}/5).`
        : persona
          ? `Speaks to ${audienceFromPersona(persona.name)}.`
          : "",
      question ? `Asked ${question.frequency}× in your Question Bank: “${question.question}”` : "",
      pillar && pillar.recent_share !== null && pillar.target_percentage - pillar.recent_share >= 3
        ? `${pillar.name} is at ${Math.round(pillar.recent_share)}% of your recent mix vs a ${pillar.target_percentage}% target.`
        : "",
      hookPerf?.ratio && hookPerf.ratio >= 1.05 ? `${hookPerf.label} hooks average ${hookPerf.ratio.toFixed(1)}× your views.` : "",
    ].filter(Boolean)
    const opener = ownStory ? sentence(sentences[0]) : sentence(topic.claim)
    const description = c
      ? `${opener} Show why ${c.from} works until it doesn't, and what ${c.to} ${agreeVerb(c.to, "look", "looks")} like in practice for ${audience}.`
      : ownStory
        ? `${opener} Tell it as a story: what happened, what it revealed, and the lesson ${audience} can use this week.`
        : problem
          ? `${opener} It's the “${stripEndPunct(problem.problem)}” problem in real life — show ${audience} what's behind it and the first fix.`
          : question
            ? `${opener} Answer it directly for ${audience}, with one real example.`
            : `${opener} Unpack it for ${audience} with one real example and one action they can take this week.`
    const points = [
      ownStory ? `What happened: ${stripEndPunct(sentences[0].replace(TIME_LEAD, ""))}.` : `The pattern: ${stripEndPunct(topic.claim)}.`,
      c
        ? `Why ${c.from} works until it doesn't — and what it costs when it stops.`
        : problem
          ? `The root problem: “${stripEndPunct(problem.problem)}.”`
          : question
            ? `The question behind it: “${question.question}”`
            : "",
      c ? `What ${c.to} ${agreeVerb(c.to, "look", "looks")} like in practice: one owner, one weekly routine, one number to watch.` : pov ? `The principle: ${pov}` : "",
      story
        ? `Proof from your Story Vault: “${stripEndPunct(story.title)}” — ${story.lesson || story.result}`
        : ownStory && sentences[1]
          ? `The detail that makes it land: ${stripEndPunct(sentences[1])}.`
          : "",
      `One action for this week: ${c ? `make one part of ${subject} repeatable` : `change one thing in how you handle ${subject}, then review the result after seven days`}.`,
    ].filter(Boolean)
    if (points.length < 3) points.splice(1, 0, `What most ${audience} get wrong about ${subject}.`)
    return kit.scrubDeep({
      title,
      core_topic: subject,
      pillar_id: pillar?.id ?? null,
      persona_id: persona?.id ?? null,
      problem_id: problem?.id ?? null,
      hook: hook.text,
      hook_category: hook.category,
      angle,
      format: format?.name ?? "",
      format_id: format?.id ?? null,
      platforms,
      goal_category: kit.goalFor(funnel, pillar),
      funnel_stage: funnel,
      description,
      why_it_matters: reasons.length ? reasons.slice(0, 3).join(" ") : `Fits your positioning: ${ctx.brand.positioning_statement || "it's squarely in your expertise"}.`,
      talking_points: points,
    })
  },

  finalize(out, ctx) {
    const formatId = resolveRef(ctx, "format", out.format_id) ?? formatIdByName(ctx, out.format)
    const platforms = uniqueStrings(out.platforms, 3).filter((p): p is keyof typeof PLATFORMS => p in PLATFORMS)
    return {
      ...out,
      pillar_id: resolveRef(ctx, "pillar", out.pillar_id),
      persona_id: resolveRef(ctx, "persona", out.persona_id),
      problem_id: resolveRef(ctx, "problem", out.problem_id),
      format_id: formatId,
      format: ctx.formats.find((f) => f.id === formatId)?.name ?? out.format,
      platforms: platforms.length ? platforms : [ctx.platforms[0]?.platform ?? "facebook"],
      talking_points: uniqueStrings(out.talking_points, 6),
    }
  },
})
