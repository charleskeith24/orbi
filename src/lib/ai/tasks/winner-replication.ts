import * as z from "zod"
import { HOOK_CATEGORIES, PERFORMANCE_TIERS, PLATFORMS } from "@/lib/constants"
import type { HookCategory, PerformanceTier } from "@/lib/types"
import { createKit } from "../offline/brand"
import { hookSlots, writeHook, writeHooks } from "../offline/hooks"
import { titleForTopic } from "../offline/ideas"
import { clip, headline, seedFor, stripEndPunct, truncateWords, upperFirst } from "../offline/text"
import { analyzeTopic } from "../offline/topic"
import { labelOf } from "../refs"
import { storySubject } from "./repurpose"
import { defineTask, funnelSchema, hookCategorySchema, optionalId, platformSchema } from "./shared"

const metricsSchema = z
  .object({
    views: z.number(),
    reach: z.number(),
    likes: z.number(),
    comments: z.number(),
    shares: z.number(),
    saves: z.number(),
    followers_gained: z.number(),
    leads: z.number(),
    engagement_rate: z.number().nullable(),
    save_rate: z.number().nullable(),
    share_rate: z.number().nullable(),
  })
  .partial()
  .default({})

const input = z.object({
  item: z.object({
    title: z.string().trim().min(1).max(300),
    hook: z.string().max(500).default(""),
    hook_category: hookCategorySchema.nullish().transform((v) => v ?? null),
    platform: platformSchema,
    format: z.string().max(80).default(""),
    angle: z.string().max(80).default(""),
    pillar_id: optionalId,
    funnel_stage: funnelSchema.nullish().transform((v) => v ?? null),
    body: z.string().max(8000).default(""),
    why_it_worked: z.string().max(1000).default(""),
  }),
  metrics: metricsSchema,
  tier: z.enum(["normal", "good", "winner", "breakout"] as [PerformanceTier, ...PerformanceTier[]]).default("winner"),
  /** Value ÷ platform baseline from winner detection. */
  ratio: z.number().nullable().default(null),
  baseline_views: z.number().nullable().default(null),
})

const ideaSchema = z.object({ title: z.string(), hook: z.string(), angle: z.string() })

const output = z.object({
  why_it_worked: z.string().describe("3–4 sentences grounded in the metrics, hook, structure and audience"),
  variations: z.array(ideaSchema).describe("5 new angles on the same core idea"),
  follow_ups: z.array(ideaSchema).describe("3 follow-up pieces"),
  hooks: z.array(ideaSchema).describe("3 new hooks for the same idea (title = the idea, angle = hook style)"),
  part_2: ideaSchema,
  contrarian_version: ideaSchema,
  advanced_version: ideaSchema,
  beginner_version: ideaSchema,
  story_version: ideaSchema,
})

const fmt = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits }))

export const winnerReplicationTask = defineTask({
  name: "winner_replication",
  description: "Winning Content Library: explain why a winner worked and generate variations, follow-ups, new hooks and part 2 / contrarian / advanced / beginner / story versions.",
  input,
  output,
  maxTokens: 5000,

  buildPrompt(ctx, i) {
    return {
      user: [
        `Task: this post is a ${PERFORMANCE_TIERS[i.tier].label}${i.ratio ? ` at ${i.ratio.toFixed(1)}× its ${PLATFORMS[i.item.platform].label} baseline` : ""}. Explain why it worked and give the creator ways to replicate it without repeating it.`,
        `<winner>\n${JSON.stringify({ ...i.item, pillar: labelOf(ctx, "pillar", i.item.pillar_id) || null, pillar_id: undefined, metrics: i.metrics, baseline_views: i.baseline_views }, null, 1)}\n</winner>`,
        "why_it_worked: 3–4 sentences grounded in the numbers (saves → useful, shares → identity/agreement, comments → conversation), the hook and the structure. Then: 5 variations (new angles on the same core idea), 3 follow-ups, 3 new hooks, and part 2, contrarian, advanced, beginner and story versions — each { title, hook, angle }. Stay on the same core idea and audience; don't repeat the original title.",
      ].join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("winner_replication", i))
    const m = i.metrics
    const title = stripEndPunct(i.item.title)
    const short = headline(title, 8)
    const topic = analyzeTopic(`${i.item.hook || title}. ${i.item.body}`)
    const story = kit.storyFor(`${title}. ${i.item.hook}`, { minHits: 2 })
    // What the winner is about: the keywords of the story behind it ("TikTok ads"), else the brand's own phrase.
    const subject = storySubject(story, kit) ?? kit.subjectFor(title, { context: `${i.item.hook} ${i.item.body}` })
    const slots = hookSlots(topic, kit, { story, subject })
    const base = m.reach || m.views || 0
    const saveRate = m.save_rate ?? (base && m.saves ? (m.saves / base) * 100 : null)
    const shareRate = m.share_rate ?? (base && m.shares ? (m.shares / base) * 100 : null)
    const commentRate = m.likes && m.comments ? (m.comments / m.likes) * 100 : null

    const reasons = [
      i.ratio ? `It hit ${i.ratio.toFixed(1)}× your ${PLATFORMS[i.item.platform].label} baseline${m.views ? ` (${fmt(m.views)} views${i.baseline_views ? ` vs ~${fmt(i.baseline_views)}` : ""})` : ""}.` : m.views ? `It reached ${fmt(m.views)} views.` : "",
      i.item.hook_category ? `The ${HOOK_CATEGORIES[i.item.hook_category].label.toLowerCase()} hook${i.item.hook ? ` (“${truncateWords(i.item.hook, 12)}”)` : ""} ${HOOK_CATEGORIES[i.item.hook_category].description.toLowerCase()}.` : "",
      saveRate !== null && saveRate >= 1.5 ? `A ${saveRate.toFixed(1)}% save rate says people wanted to keep it — it was useful, not just interesting.` : "",
      shareRate !== null && shareRate >= 0.8 ? `A ${shareRate.toFixed(1)}% share rate means it said something people wanted to be seen agreeing with.` : "",
      commentRate !== null && commentRate >= 8 ? `${fmt(m.comments)} comments (${commentRate.toFixed(0)}% of likes) — it started a conversation.` : "",
      m.leads ? `It also produced ${fmt(m.leads)} lead${m.leads === 1 ? "" : "s"}.` : "",
      i.item.why_it_worked ? `Your note: ${clip(i.item.why_it_worked, 200)}` : "",
    ].filter(Boolean)

    const idea = (t: string | null, category: HookCategory, angle: string) => {
      const hook = writeHook(category, slots, kit)
      return { title: kit.scrub(upperFirst(t ?? `${subject}: ${angle.toLowerCase()}`)), hook: hook.text, angle }
    }
    const variationAngles: [string, HookCategory][] = [
      ["Mistake", "mistake"],
      ["Framework", "list"],
      ["Checklist", "list"],
      ["Myth", "contrarian"],
      ["Comparison", "question"],
    ]
    const variations = variationAngles.map(([angle, cat]) => idea(titleForTopic(subject, angle, kit, story), cat, angle))
    const newHooks = writeHooks(slots, kit.hookCategories().filter((c) => c !== i.item.hook_category).slice(0, 3), 3, kit)

    return kit.scrubDeep({
      why_it_worked: reasons.length ? reasons.join(" ") : `It performed above your usual level on ${PLATFORMS[i.item.platform].label}. Log saves, shares and comments to see which lever drove it.`,
      variations,
      follow_ups: [
        idea(`${title}: your questions answered`, "question", "Question"),
        idea(`How to apply “${short}” this week`, "list", "Tutorial"),
        idea(`The mistake people make after “${short}”`, "mistake", "Mistake"),
      ],
      hooks: newHooks.map((h) => ({ title, hook: h.text, angle: HOOK_CATEGORIES[h.category].label })),
      part_2: idea(`${title} — part 2`, "curiosity", "Story"),
      contrarian_version: idea(`The case against “${short}”`, "contrarian", "Contrarian"),
      advanced_version: idea(`Advanced ${subject}: what to do after the basics`, "authority", "Framework"),
      beginner_version: idea(`${upperFirst(subject)} for beginners: start here`, "problem", "Tutorial"),
      story_version: story ? idea(stripEndPunct(story.title), "story", "Story") : idea(`Behind “${short}”: the real story`, "curiosity", "Behind the Scenes"),
    })
  },
})
