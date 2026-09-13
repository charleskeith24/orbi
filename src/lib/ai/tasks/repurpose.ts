import * as z from "zod"
import { FUNNEL_STAGES, PLATFORMS, REPURPOSE_TYPES, SCRIPT_FORMATS } from "@/lib/constants"
import type { PlatformId, RepurposeType } from "@/lib/types"
import { createKit, type Kit } from "../offline/brand"
import { buildSections, materialFrom, povLine, storyParagraph, type ScriptMaterial } from "../offline/scripts"
import { clip, firstSentence, headline, lowerFirst, seedFor, sentence, splitSentences, stripEndPunct, tokenSet } from "../offline/text"
import { labelOf } from "../refs"
import { defineTask, fixSections, funnelSchema, optionalId, platformSchema, repurposeTypeSchema, sectionSchema } from "./shared"

const input = z.object({
  source: z.object({
    title: z.string().trim().min(1).max(300),
    platform: platformSchema.default("facebook"),
    format: z.string().max(80).default(""),
    hook: z.string().max(500).default(""),
    body: z.string().max(12000).default(""),
    pillar_id: optionalId,
    funnel_stage: funnelSchema.nullish().transform((v) => v ?? null),
    /** e.g. "76,359 views, 4.1× baseline" — context for why it's worth repurposing. */
    performance: z.string().max(300).default(""),
  }),
  targets: z.array(repurposeTypeSchema).min(1, "Pick at least one target.").max(12),
})

const output = z.object({
  assets: z.array(
    z.object({
      type: repurposeTypeSchema,
      platform: platformSchema.nullable(),
      title: z.string(),
      sections: z.array(sectionSchema),
    })
  ),
})

const CTA_LINE = /\b(comment|dm|save|share|follow|book|link|subscribe|reply)\b/i

type Source = z.output<typeof input>["source"]

/** Pull hook, message, points and takeaway out of an existing script body. */
function sourceMaterial(source: Source, platform: PlatformId, kit: Kit): ScriptMaterial {
  const paragraphs = source.body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const units = paragraphs.length > 2 ? paragraphs : splitSentences(source.body)
  const hook = source.hook || units[0] || source.title
  // Engagement questions ("Have you ever…?") close a post; they are neither its points nor its takeaway.
  const middle = units.slice(1).filter((s) => !CTA_LINE.test(s) && !/\?["”')]*$/.test(s.trim()))
  const takeaway = middle.length > 3 ? sentence(middle[middle.length - 1]) : undefined
  // The message opens, the last line is the takeaway — the points are what's in between.
  const points = middle
    .slice(1, takeaway ? -1 : undefined)
    .slice(0, 4)
    .map((p) => clip(stripEndPunct(p), 170))
  return materialFrom(
    {
      title: source.title,
      hook,
      message: middle[0] ?? source.title,
      points: points.length ? points : undefined,
      takeaway: takeaway ?? povLine(kit, `${source.title} ${source.body}`) ?? undefined,
      platform,
      text: source.body,
      funnel: source.funnel_stage ?? undefined,
      subject: storySubject(kit.storyFor(`${source.title}. ${source.hook}`, { minHits: 2 }), kit),
    },
    kit
  )
}

/** A matching story's own first keyword is the best topic phrase for a post built on it ("TikTok ads", "clients"). */
const PEOPLE_NOUN = /^(clients?|customers?|founders?|teams?|people|buyers?|sellers?|users?|followers?|employees?|staff)$/i

export function storySubject(story: { keywords: string[] } | null, kit: Kit): string | undefined {
  const keywords = (story?.keywords ?? []).map((k) => k.trim()).filter((k) => k && !/^(failure|story|lesson|case study|event|crisis|near failure)$/i.test(k))
  const [first, second] = keywords
  if (!first) return undefined
  // A bare audience noun ("clients") is who the story is about, not its topic — pair it with the next keyword ("client boundaries").
  if (PEOPLE_NOUN.test(first)) {
    const partner = keywords.slice(1).find((k) => !k.includes(" ") && !PEOPLE_NOUN.test(k))
    if (partner) return kit.display(`${first.replace(/s$/i, "")} ${partner}`)
    if (second) return kit.display(second)
  }
  return kit.display(first)
}

const POSITIVE_RESULT = /\b(hit|grew|doubled|tripled|became|replaced|rose|increased|improved|stayed|saved|won|reached|went from|dropped from)\b/i

function variantMaterial(type: RepurposeType, base: ScriptMaterial, source: Source, kit: Kit): { title: string; material: ScriptMaterial } {
  const short = headline(stripEndPunct(source.title), 9)
  const said = headline(source.hook || source.title, 12)
  const say = kit.say
  switch (type) {
    case "follow_up":
      return {
        title: `Follow-up: ${short}`,
        material: {
          ...base,
          hook: sentence(say(`Follow-up to “${short}” — the part I didn't have time for`, `Follow-up sa “${short}” — 'yung part na hindi ko na-cover`)),
          points: [say("The question I got most: how do you actually start?", "Ang pinakamadalas na tanong: paano ba talaga magsimula?"), ...base.points.slice(0, 2)],
        },
      }
    case "part_2":
      return {
        title: `${stripEndPunct(source.title)} — part 2`,
        material: {
          ...base,
          hook: sentence(say(`Part 2 of “${short}”: what happens after you start`, `Part 2 ng “${short}”: ano ang nangyayari pagkatapos mong magsimula`)),
          points: [
            `Quick recap: ${lowerFirst(said)}`,
            say("The step most people skip after that", "Ang step na nilalaktawan ng karamihan pagkatapos niyan"),
            say("What it looks like 30 days in — and the number that tells you it's working", "Ano ang itsura after 30 days — at ang number na magsasabi kung gumagana"),
          ],
        },
      }
    case "opposite_opinion":
      return {
        title: `The case against “${short}”`,
        material: {
          ...base,
          hook: sentence(say(`Let me argue against my own post: “${short}”`, `Kokontrahin ko ang sarili kong post: “${short}”`)),
          points: ["The strongest case for the other side, stated fairly", "Where that case is actually right", `Where it breaks — and why I still believe ${lowerFirst(stripEndPunct(base.takeaway))}`],
        },
      }
    case "case_study": {
      // The story behind this post — or a case study about the same topic. Never an unrelated one.
      const topical = tokenSet(`${source.title} ${source.hook}`)
      const story =
        kit.storyFor(`${source.title}. ${source.hook}`, { minHits: 1 }) ??
        kit.ctx.stories.find((s) => s.type === "case_study" && s.result && kit.score(topical, tokenSet(`${s.title} ${s.keywords.join(" ")}`)) >= 3) ??
        null
      const facts = splitSentences(source.body)
        .filter((x) => /[0-9₱%]/.test(x) && !CTA_LINE.test(x))
        .map((x) => stripEndPunct(x))
        .slice(0, 3)
      // Lead with the outcome that shows the turnaround ("… hit 2.8 ROAS within six weeks"), not the setback.
      const resultSentences = story ? splitSentences(story.result) : []
      const resultLine =
        resultSentences.find((x) => POSITIVE_RESULT.test(x) && /[0-9₱%]/.test(x)) ?? resultSentences.find((x) => POSITIVE_RESULT.test(x)) ?? resultSentences[0] ?? ""
      return {
        title: `Case study: ${short}`,
        material: {
          ...base,
          story,
          proof: story ? storyParagraph(story) : base.proof,
          hook: sentence(resultLine ? `${stripEndPunct(resultLine)} — here's how` : `“${short}”, applied: the before, the change and the result`),
          points: story
            ? [`Starting point: ${clip(firstSentence(story.situation), 150)}`, `What changed: ${clip(firstSentence(story.action), 160)}`, `Result: ${clip(story.result, 150)}`]
            : facts.length >= 2
              ? facts
              : base.points,
        },
      }
    }
    case "update_post":
      return {
        title: `Update: ${short}`,
        material: {
          ...base,
          hook: sentence(say(`Update on “${short}”: here's what happened since`, `Update sa “${short}”: ito ang nangyari since then`)),
          points: [
            `What I said then: ${lowerFirst(said)}`,
            source.performance ? `How it landed: ${source.performance}` : "How you responded — the comments and questions that came in",
            say("What I'd do differently now", "Ano ang gagawin ko nang iba ngayon"),
          ],
        },
      }
    default:
      return { title: `${stripEndPunct(source.title)} — ${REPURPOSE_TYPES[type].label}`, material: base }
  }
}

export const repurposeTask = defineTask({
  name: "repurpose",
  description: "Repurposing Engine: platform-native versions of a published piece (posts, carousel, thread, short, newsletter, follow-up, part 2, opposite opinion, case study, update).",
  input,
  output,
  maxTokens: 12000,

  buildPrompt(ctx, i) {
    const targets = i.targets.map((t) => {
      const spec = REPURPOSE_TYPES[t]
      const format = SCRIPT_FORMATS[spec.scriptFormat]
      return `- type "${t}" (${spec.label} — ${spec.description}; platform ${spec.platform ? PLATFORMS[spec.platform].label : "same as source"}) → sections: ${format.sections.map((s) => `"${s.key}" (${s.label}: ${s.hint})`).join(", ")}`
    })
    return {
      user: [
        "Task: Repurposing Engine. Turn this published piece into the requested assets — each native to its platform, not a copy-paste.",
        `<source>\n${JSON.stringify({ ...i.source, pillar: labelOf(ctx, "pillar", i.source.pillar_id) || null, funnel_stage: i.source.funnel_stage ? FUNNEL_STAGES[i.source.funnel_stage].label : null, pillar_id: undefined }, null, 1)}\n</source>`,
        `Produce exactly one asset per target, in this order, with exactly these section keys and labels:\n${targets.join("\n")}`,
        "follow_up answers the obvious next question; part_2 continues the story or framework; opposite_opinion steelmans the other side honestly; case_study uses only real numbers from the source or context (otherwise [placeholders]); update_post reports what happened since (placeholders for unknown numbers). platform is the target's platform (null for platform-agnostic types unless the source platform fits).",
      ].join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("repurpose", i))
    const assets = i.targets.map((type) => {
      const spec = REPURPOSE_TYPES[type]
      const platform = spec.platform ?? i.source.platform
      const base = sourceMaterial(i.source, platform, kit)
      const { title, material } = variantMaterial(type, { ...base, platform, cta: kit.cta({ funnel: i.source.funnel_stage ?? "tofu", platform, topic: base.subject }) }, i.source, kit)
      return { type, platform: spec.platform, title: kit.scrub(title), sections: buildSections(spec.scriptFormat, material, kit) }
    })
    return { assets }
  },

  finalize(out, _ctx, i) {
    const byType = new Map(out.assets.map((a) => [a.type, a]))
    return {
      assets: i.targets
        .map((type) => byType.get(type))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => ({ ...a, platform: a.platform ?? REPURPOSE_TYPES[a.type].platform, sections: fixSections(REPURPOSE_TYPES[a.type].scriptFormat, a.sections) })),
    }
  },
})
