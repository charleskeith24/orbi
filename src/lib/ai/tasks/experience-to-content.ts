import * as z from "zod"
import type { FunnelStage, PlatformId, ScriptFormat } from "@/lib/types"
import { createKit } from "../offline/brand"
import { experienceStory, parseExperience, stripTimeLead } from "../offline/experience"
import { hookSlots, writeHook } from "../offline/hooks"
import { buildSections, materialFrom } from "../offline/scripts"
import { clip, headline, lowerFirst, seedFor, sentence, splitSentences, stripEndPunct, upperFirst } from "../offline/text"
import { analyzeTopic } from "../offline/topic"
import { resolveRef } from "../refs"
import { contextRefSchema, defineTask, inputText, optionalId, platformSchema, uniqueStrings } from "./shared"

export const EXPERIENCE_ANGLE_TYPES = [
  "leadership_lesson",
  "management_framework",
  "personal_reflection",
  "storytelling_post",
  "educational_video",
  "contrarian_opinion",
  "linkedin_post",
  "facebook_post",
] as const
export type ExperienceAngleType = (typeof EXPERIENCE_ANGLE_TYPES)[number]

const input = z.object({
  experience: inputText(8000).min(20, "Describe what happened in a few sentences."),
  pillar_id: optionalId,
})

const output = z.object({
  angles: z.array(
    z.object({
      type: z.enum(EXPERIENCE_ANGLE_TYPES),
      title: z.string(),
      hook: z.string(),
      format: z.string().describe("Name of a content format from the context"),
      platform: platformSchema,
      pillar_id: contextRefSchema("content pillar", "P1"),
      outline: z.array(z.string()),
      draft: z.string().describe("Ready-to-post copy in the creator's voice"),
    })
  ),
  story: z.object({
    title: z.string(),
    situation: z.string(),
    problem: z.string(),
    action: z.string(),
    result: z.string(),
    lesson: z.string(),
    emotion: z.string(),
    keywords: z.array(z.string()),
  }),
})

/** Each angle's pillar, platforms, structure, hook style and funnel stage (a lived experience is never a sales pitch). */
const PLAN: Record<ExperienceAngleType, { pillar: string; platforms: PlatformId[]; script: ScriptFormat; hook: "story" | "authority" | "list" | "contrarian" | "curiosity"; funnel: FunnelStage }> = {
  leadership_lesson: { pillar: "leadership", platforms: ["linkedin", "facebook"], script: "linkedin_post", hook: "authority", funnel: "mofu" },
  management_framework: { pillar: "leadership", platforms: ["instagram", "linkedin"], script: "carousel", hook: "list", funnel: "mofu" },
  personal_reflection: { pillar: "personal", platforms: ["facebook", "instagram"], script: "facebook_post", hook: "curiosity", funnel: "tofu" },
  storytelling_post: { pillar: "journey", platforms: ["facebook", "linkedin"], script: "facebook_post", hook: "story", funnel: "tofu" },
  educational_video: { pillar: "education", platforms: ["tiktok", "instagram", "youtube"], script: "short_video", hook: "list", funnel: "mofu" },
  contrarian_opinion: { pillar: "authority", platforms: ["linkedin", "facebook", "x"], script: "linkedin_post", hook: "contrarian", funnel: "tofu" },
  linkedin_post: { pillar: "", platforms: ["linkedin"], script: "linkedin_post", hook: "story", funnel: "mofu" },
  facebook_post: { pillar: "", platforms: ["facebook"], script: "facebook_post", hook: "story", funnel: "tofu" },
}

export const experienceToContentTask = defineTask({
  name: "experience_to_content",
  description: "Experience → Content: extract a Story Vault entry (STAR) from a real experience and turn it into 8 content angles with drafts.",
  input,
  output,
  maxTokens: 14000,

  buildPrompt(_ctx, i) {
    return {
      user: [
        "Task: Experience → Content. The creator just described something that really happened. First extract it as a Story Vault entry (title, situation, problem, action, result, lesson, emotion, keywords) using only what they said — leave a field empty rather than invent.",
        `<experience>\n${i.experience}\n</experience>`,
        `Then write one angle of each type, in this order: ${EXPERIENCE_ANGLE_TYPES.join(", ")}. Each has a title, hook, format (from the context), platform, pillar ref, a 3–6 step outline and a ready-to-post draft in the creator's voice and language, following their storytelling style. Use only facts from the experience or the context; mark missing specifics as [placeholder].`,
      ].join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("experience_to_content", i))
    const parts = parseExperience(i.experience, kit)
    const story = experienceStory(parts)
    const topic = analyzeTopic(i.experience)
    const subject = parts.subject
    const lesson = parts.lesson ? stripEndPunct(parts.lesson) : ""
    // The steps are what the creator actually did, clause by clause.
    const steps = splitSentences(parts.action)
      .flatMap((s) => s.split(/,\s(?:then\s)?|\s(?:and then|then)\s|;\s/))
      .map((s) => upperFirst(stripEndPunct(s.replace(/^(?:then|and)\s+/i, ""))))
      .filter((s) => s.split(" ").length >= 3)
      .slice(0, 4)
    const moment = stripEndPunct(parts.title)
    const shortMoment = headline(moment, 9)
    // The opening scene ("we missed a client deadline because nobody owned the task"), not the result headline.
    const sceneFull = stripTimeLead(splitSentences(i.experience)[0] ?? moment)
    const scene = sceneFull.split(" ").length <= 16 ? sceneFull : headline(sceneFull, 12)
    const n = steps.length >= 2 ? steps.length : 3
    const titles: Record<ExperienceAngleType, string> = {
      leadership_lesson: lesson ? `Leadership lesson: ${lowerFirst(lesson)}` : `What “${shortMoment}” taught me about leading a team`,
      management_framework: steps.length >= 2 ? `The ${steps.length}-step playbook I'd run again` : `The playbook behind “${shortMoment}”`,
      personal_reflection: `What I'd tell myself the day ${lowerFirst(scene)}`,
      storytelling_post: upperFirst(moment),
      educational_video: `${n} lessons from the day ${lowerFirst(scene)}`,
      contrarian_opinion: lesson ? `Unpopular opinion: ${lowerFirst(lesson)}` : `The unpopular lesson in “${shortMoment}”`,
      linkedin_post: lesson ? upperFirst(lesson) : `What “${shortMoment}” taught me`,
      facebook_post: `The day ${lowerFirst(scene)}`,
    }
    const angles = EXPERIENCE_ANGLE_TYPES.map((type) => {
      const plan = PLAN[type]
      const pillar =
        (i.pillar_id ? ctx.pillars.find((p) => p.id === i.pillar_id) : undefined) ??
        (plan.pillar ? ctx.pillars.find((p) => p.name.toLowerCase() === plan.pillar) : undefined) ??
        kit.pillarFor(i.experience)
      const active = ctx.platforms.map((p) => p.platform)
      const platform = plan.platforms.find((p) => active.includes(p)) ?? plan.platforms[0]
      const format = kit.formatFor(platform, plan.script === "carousel" ? "visual" : plan.script === "short_video" ? "video" : "text")
      const hook = writeHook(plan.hook, hookSlots(topic, kit, { subject, story }), kit).text
      const points = type === "management_framework" && steps.length >= 2 ? steps.map((s, k) => `Step ${k + 1}: ${lowerFirst(s)}`) : steps
      const m = materialFrom(
        { title: titles[type], hook, message: parts.situation, points: points.length ? points : undefined, takeaway: lesson ? sentence(lesson) : undefined, platform, story, text: i.experience, funnel: plan.funnel },
        kit
      )
      const sections = buildSections(plan.script, m, kit)
      return {
        type,
        title: kit.scrub(titles[type]),
        hook,
        format: format?.name ?? "",
        platform,
        pillar_id: pillar?.id ?? null,
        outline: sections.map((s) => `${s.label}: ${clip(s.content.replace(/\n+/g, " "), 110)}`),
        draft: sections.map((s) => s.content).filter(Boolean).join("\n\n"),
      }
    })
    return kit.scrubDeep({
      angles,
      story: {
        title: parts.title,
        situation: parts.situation,
        problem: parts.problem,
        action: parts.action,
        result: parts.result,
        lesson: parts.lesson,
        emotion: parts.emotion,
        keywords: parts.keywords,
      },
    })
  },

  finalize(out, ctx) {
    const seen = new Set<string>()
    return {
      angles: out.angles
        .filter((a) => (seen.has(a.type) ? false : (seen.add(a.type), true)))
        .map((a) => ({ ...a, pillar_id: resolveRef(ctx, "pillar", a.pillar_id), outline: uniqueStrings(a.outline, 8) })),
      story: { ...out.story, keywords: uniqueStrings(out.story.keywords.map((k) => k.toLowerCase()), 8) },
    }
  },
})
