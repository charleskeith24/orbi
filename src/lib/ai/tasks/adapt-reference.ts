import * as z from "zod"
import { PLATFORMS } from "@/lib/constants"
import type { ScriptFormat } from "@/lib/types"
import { createKit } from "../offline/brand"
import { hookSlots, writeHook } from "../offline/hooks"
import { problemSubject, titleForProblem } from "../offline/ideas"
import { buildSections, materialFrom } from "../offline/scripts"
import { clip, lowerFirst, seedFor, stripEndPunct, upperFirst } from "../offline/text"
import { analyzeTopic } from "../offline/topic"
import { labelOf } from "../refs"
import { defineTask, optionalId, platformSchema } from "./shared"

const input = z.object({
  analysis: z.object({
    hook: z.string().max(500).default(""),
    structure: z.array(z.string().max(300)).max(12).default([]),
    angle: z.string().max(300).default(""),
    psychology: z.string().max(1500).default(""),
    why_it_works: z.string().max(1500).default(""),
    patterns: z.array(z.string().max(300)).max(12).default([]),
  }),
  /** A short description of the reference — never its full text. */
  summary: z.string().max(2000).default(""),
  /** What the creator wants to talk about, in their own words (optional). */
  topic: z.string().max(500).default(""),
  pillar_id: optionalId,
  persona_id: optionalId,
  platform: platformSchema.default("facebook"),
  format: z.string().max(80).default(""),
})

const output = z.object({
  title: z.string(),
  hook: z.string(),
  outline: z.array(z.string()).describe("Beats of the new piece, mapped to the borrowed structure"),
  draft: z.string().describe("Original, ready-to-post copy in the creator's voice"),
  originality_note: z.string().describe("What was borrowed (structure/psychology only) and what is original"),
})

const PLATFORM_SCRIPT: Record<string, ScriptFormat> = {
  tiktok: "short_video",
  instagram: "carousel",
  youtube: "short_video",
  facebook: "facebook_post",
  linkedin: "linkedin_post",
  x: "x_thread",
  threads: "threads_post",
}

/** Which sections of the new piece play the role of each borrowed beat. */
const BEAT_SECTIONS: [RegExp, string[]][] = [
  [/^hook/i, ["hook", "slide_1", "frame_1", "subject", "title", "cold_open"]],
  [/story|context|direct address|situation/i, ["story", "context", "opening", "intro", "slide_2", "frame_2"]],
  [/turn|insight|realiz/i, ["insight", "slide_3", "frame_3"]],
  [/list|steps|framework|how/i, ["framework", "value", "slide_6", "body", "talking_points", "sections", "segments"]],
  [/proof|example|result|number/i, ["example", "slide_5", "segment_2"]],
  [/lesson|takeaway|moral/i, ["lesson", "takeaway", "conclusion", "slide_4", "recap"]],
  [/question|cta|call to action/i, ["cta", "slide_7", "frame_5", "frame_4"]],
]

/** The idea angle that carries the reference's structure. */
function angleFor(analysisAngle: string): string {
  const a = analysisAngle.toLowerCase()
  if (a.includes("list") || a.includes("checklist")) return "Checklist"
  if (a.includes("contrarian")) return "Mistake"
  if (a.includes("tutorial") || a.includes("how")) return "Tutorial"
  if (a.includes("story") || a.includes("question")) return "Problem"
  return "Framework"
}

export const adaptReferenceTask = defineTask({
  name: "adapt_reference",
  description: "Research → original content: a new piece that borrows only the reference's structure and psychology, filled with the creator's own expertise and stories.",
  input,
  output,
  maxTokens: 5000,

  buildPrompt(ctx, i) {
    return {
      user: [
        `Task: create an ORIGINAL ${i.format || "post"} for ${PLATFORMS[i.platform].label} inspired by the analysis below.`,
        `<analysis>\n${JSON.stringify(i.analysis, null, 1)}\n</analysis>`,
        i.summary ? `<reference_summary>\n${i.summary}\n</reference_summary>` : "",
        [
          i.topic && `The creator wants to talk about: ${i.topic}`,
          i.pillar_id && `Pillar: ${labelOf(ctx, "pillar", i.pillar_id)}`,
          i.persona_id && `Persona: ${labelOf(ctx, "persona", i.persona_id)}`,
        ]
          .filter(Boolean)
          .join("\n"),
        "Borrow only the structure and the psychological levers. The topic, story, examples, numbers and wording must come from this creator's expertise, Story Vault and audience problems. Never reuse or paraphrase the reference's sentences, examples or claims. The outline maps each borrowed beat to the new content. originality_note states plainly what was borrowed and what is original.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("adapt_reference", i))
    const pillar = ctx.pillars.find((p) => p.id === i.pillar_id) ?? null
    const seedText = i.topic || `${pillar?.name ?? ""} ${pillar?.examples[0] ?? ""} ${i.analysis.angle}`
    const problem =
      kit.problemFor(seedText, { personaId: i.persona_id, pillarId: pillar?.id }) ??
      ctx.problems.find((p) => (!pillar || p.pillar_id === pillar.id) && (!i.persona_id || p.persona_id === i.persona_id)) ??
      null
    const topicText = i.topic || problem?.problem || pillar?.examples[0] || ctx.brand.expertise_areas[0] || "your expertise"
    const topic = analyzeTopic(topicText)
    const subject = !i.topic && problem ? problemSubject(problem.problem, kit) : kit.subjectFor(topicText)
    const story = kit.storyFor(`${topicText} ${pillar?.name ?? ""}`, { pillarId: pillar?.id, minHits: 1 })
    const angle = i.analysis.angle.toLowerCase()
    const category = angle.includes("list") ? "list" : angle.includes("story") ? (story ? "story" : "curiosity") : angle.includes("contrarian") ? "contrarian" : angle.includes("question") ? "question" : kit.hookCategories()[0] ?? "curiosity"
    const hook = writeHook(category, hookSlots(topic, kit, { story, problem: problem?.problem ?? null, subject }), kit).text
    const script = (ctx.formats.find((f) => f.name.toLowerCase() === i.format.toLowerCase())?.script_format ?? PLATFORM_SCRIPT[i.platform]) as ScriptFormat
    // The creator's own words come first; otherwise the audience problem, shaped to the borrowed angle.
    const title = i.topic.trim()
      ? upperFirst(stripEndPunct(i.topic.trim()))
      : ((problem ? titleForProblem(problem.problem, angleFor(i.analysis.angle), kit) : null) ?? `${upperFirst(subject)}: the version nobody explains`)
    const m = materialFrom({ title, hook, platform: i.platform, story, problem: problem?.problem ?? null, text: topicText, subject }, kit)
    const sections = buildSections(script, m, kit)
    const beats = i.analysis.structure.length ? i.analysis.structure : sections.map((s) => s.label)
    const usedKeys = new Set<string>()
    const outline = beats
      .map((beat) => {
        const name = stripEndPunct(beat.split(":")[0])
        const preferred = BEAT_SECTIONS.find(([re]) => re.test(name))?.[1] ?? []
        const section = sections.find((s) => preferred.includes(s.key) && !usedKeys.has(s.key)) ?? sections.find((s) => !usedKeys.has(s.key))
        if (!section) return null
        usedKeys.add(section.key)
        return `${name} → ${clip(section.content.replace(/\n+/g, " "), 120)}`
      })
      .filter((line): line is string => Boolean(line))
    const lever = i.analysis.psychology.split(/[;—]/)[0]?.replace(/^it pulls\s*/i, "").trim()
    return kit.scrubDeep({
      title,
      hook,
      outline,
      draft: sections.map((s) => s.content).filter(Boolean).join("\n\n"),
      originality_note: `Borrowed: the ${i.analysis.angle ? lowerFirst(i.analysis.angle) : "overall"} structure (${beats.length} beats)${lever ? ` and one lever — ${lowerFirst(stripEndPunct(lever))}` : ""}. Original: the topic (${subject})${problem ? `, your audience problem (“${clip(problem.problem, 80)}”)` : ""}${story ? `, your story (“${stripEndPunct(story.title)}”)` : ""}, the examples and the CTA. No sentences, examples or claims from the reference are reused.`,
    })
  },
})
