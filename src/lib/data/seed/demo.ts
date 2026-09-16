/**
 * Demo Workspace assembly: Starter Kit + "Raf Mendoza / Northbound Commerce".
 * Turns the hand-written seed data into complete, cross-linked rows with dates
 * relative to `ctx.now`.
 */
import { addDays, addMinutes, endOfDay, startOfMonth, subMonths } from "date-fns"
import { PILLAR_PRESETS, SCRIPT_FORMATS } from "@/lib/constants"
import { startOfWeek, toISODate } from "@/lib/dates"
import { computeIdeaScore, priorityFromScore, qualityRating, qualityTotal } from "@/lib/scoring"
import type {
  ContentItem,
  ContentQualityScore,
  Database,
  GoalCategory,
  ID,
  IdeaScores,
  InsertRow,
  PipelineStage,
  PlatformId,
  Priority,
  ScriptSection,
  TaggableEntity,
} from "@/lib/types"
import { PROBLEMS, QUESTIONS } from "./audience-data"
import { BRAND, OWNER, PERSONA_KEYS, PERSONAS, PILLAR_COPY, PILLAR_KEYS, type PersonaKey, type PillarKey } from "./brand-data"
import { earlierToday, type SeedContext } from "./context"
import { IDEAS } from "./ideas-data"
import { buildMetrics, type FormatKind, type MetricSubject } from "./metrics"
import type { PipelineSpec, PublishedSpec, QualitySeed, ScoreTuple } from "./piece-types"
import { PIPELINE_BUFFER } from "./pipeline-a"
import { PIPELINE_WIP } from "./pipeline-b"
import { CAMPAIGNS, ENGAGEMENT_NOTES, EXPERIMENTS, MONTHLY_REVIEW, SERIES, WEEKLY_REVIEWS } from "./programs-data"
import { PUBLISHED_A } from "./published-a"
import { PUBLISHED_B } from "./published-b"
import { RESEARCH } from "./research-data"
import { buildMoney } from "./money"
import { hashString } from "./rng"
import { angleKey, buildStarterKit, formatKey, hookTemplateKey, tagKey } from "./starter"
import { FORMATS, GOALS, type FormatName, type TagName } from "./starter-data"
import { STORIES } from "./stories-data"

const DAY_MS = 86_400_000
/** The demo brand has been using the app for ~4 months. */
const WORKSPACE_AGE_DAYS = 130

type Spec = PublishedSpec | PipelineSpec

interface BuiltItem {
  spec: Spec
  index: number
  row: ContentItem
  publishedAt: Date | null
}

const PUBLISHED: PublishedSpec[] = [...PUBLISHED_A, ...PUBLISHED_B]
const PIPELINE: PipelineSpec[] = [...PIPELINE_BUFFER, ...PIPELINE_WIP]
const SPEC_BY_KEY = new Map<string, Spec>([...PUBLISHED, ...PIPELINE].map((s) => [s.key, s]))

/** Variant A of the Taglish vs English experiment (engagement boost in the metrics model). */
const TAGLISH_KEYS = new Set(EXPERIMENTS.find((e) => e.template === "Tagalog vs English")?.a ?? [])
/** Pieces that also get an earlier (48-hour) metrics snapshot. */
const EARLY_SNAPSHOT_KEYS = new Set([
  "sprint-kickoff",
  "bottlenecks",
  "mml-kill-ad",
  "forecast-sale",
  "aov-lever",
  "scale-checklist-lead",
  "fire-your-agency",
])
const METRIC_NOTES: Record<string, string> = {
  "burned-380k": "Stitched by two creators; comments still coming in daily.",
  "offer-not-ads": "Shared into several sellers' Facebook groups.",
  "fired-client": "Most comments we've ever had on LinkedIn — many from founders.",
  "breakdown-skincare": "Top source of audit inquiries this month.",
  "hiring-media-buyers": "Leads here are job applications, not client inquiries.",
  "workshop-new-sellers": "Seats sold through the post link; the rest came in through DMs.",
}

const PERSONA_AUDIENCE: Record<PersonaKey, string> = {
  founder: "e-commerce founders",
  lead: "marketing leads",
  seller: "new sellers and freelancers",
}
/** Default brief objectives by goal — three phrasings each, picked per piece so briefs don't all read alike. */
const GOAL_OBJECTIVES: Record<GoalCategory, ((audience: string) => string)[]> = {
  awareness: [
    (a) => `Reach ${a} who don't follow us yet and earn the follow with one sharp idea.`,
    (a) => `Get this in front of ${a} outside our audience — shares and new follows are the win.`,
    (a) => `Stop the scroll for ${a} seeing us for the first time, and make the next post worth waiting for.`,
  ],
  authority: [
    (a) => `Teach ${a} something they'll save and use this week, and show how we actually do the work.`,
    (a) => `Make ${a} trust the method: specific, proven with our own numbers, easy to apply.`,
    (a) => `Give ${a} a framework worth sending to their team — saves and shares are the signal.`,
  ],
  community: [
    (a) => `Start a real conversation with ${a} — replies and DMs matter more than reach here.`,
    (a) => `Get ${a} to see themselves in this and share their own version in the comments.`,
    (a) => `Show ${a} the human side of the work so they talk back, not just scroll past.`,
  ],
  leads: [
    (a) => `Turn ${a} who already trust us into template requests and audit conversations.`,
    (a) => `Move warm ${a} one step closer to booking a scaling audit.`,
    (a) => `Prove we can fix this for ${a}, then give them an easy reason to reach out.`,
  ],
  business: [
    (a) => `Convert ${a} who are ready into sign-ups, applications or booked calls.`,
    (a) => `Give ready ${a} one clear, low-friction next step with us.`,
    (a) => `Fill the open slots with ${a} who fit — say plainly who this is for and who it isn't.`,
  ],
}
/** Soft CTAs by goal. Brand rule: direct CTAs only on BOFU pieces. */
const GOAL_CTA: Record<GoalCategory, string> = {
  awareness: "Follow for the next lesson",
  authority: "Save this and send it to your team",
  community: "Ask for their own experience in the comments",
  leads: "Comment the keyword and we'll send the template",
  business: "Send a DM with your situation",
}
const DIRECT_CTA = "DM 'AUDIT' to book a free scaling audit"
const VISUAL: Record<FormatKind, string> = {
  short: "Talking head at the office desk, natural light, captions on every line, one cutaway per point.",
  long: "Desk setup with screen recordings and chapter cards; keep the face on screen for the hook.",
  live: "Two-camera desk setup, question cards on screen, Kat moderating comments.",
  carousel: "Clean document-style slides, one idea per slide, big numbers, brand colours.",
  text: "Text first; optional single candid photo from the office.",
  image: "Single quote card in brand colours with the key line.",
  story: "Selfie video frames with a question sticker on frame 4.",
  audio: "Two-camera conversation in the meeting room, lapel mics.",
}
const TOPIC_LABELS: Record<TagName, string> = {
  marketing: "Marketing",
  leadership: "Leadership",
  ecommerce: "E-commerce",
  business: "Business",
  ai: "AI",
  story: "Storytelling",
  lesson: "Lessons",
  founder: "Founder life",
  team: "Team management",
  growth: "Growth",
}
/** Days since creation, by pipeline stage (min, max). */
const STAGE_AGE: Record<PipelineStage, [number, number]> = {
  idea: [1, 5],
  selected: [2, 6],
  brief: [3, 7],
  scripting: [4, 9],
  ready_for_production: [5, 10],
  recording: [6, 11],
  editing: [7, 12],
  review: [8, 13],
  revision: [9, 14],
  ready_to_post: [10, 15],
  scheduled: [10, 18],
  published: [0, 0],
  repurpose: [0, 0],
}
const CALENDAR_PILLARS: Record<number, PillarKey> = {
  0: "personal",
  1: "education",
  2: "journey",
  3: "education",
  4: "leadership",
  5: "journey",
  6: "personal",
}
const PLATFORM_DETAILS: Record<PlatformId, { followers: number | null; pillars: PillarKey[] }> = {
  facebook: { followers: 48200, pillars: ["journey", "personal", "education"] },
  tiktok: { followers: 126000, pillars: ["education", "journey"] },
  instagram: { followers: 21400, pillars: ["education", "authority"] },
  linkedin: { followers: 18900, pillars: ["leadership", "authority"] },
  youtube: { followers: 9800, pillars: ["authority", "education"] },
  x: { followers: 2100, pillars: ["education"] },
  threads: { followers: null, pillars: ["personal"] },
}
const REPURPOSE_SUGGESTIONS: { source: string; type: "linkedin_post" | "youtube_short" | "case_study" | "reel_caption"; platform: PlatformId; title: string; draft: string }[] = [
  {
    source: "three-numbers",
    type: "linkedin_post",
    platform: "linkedin",
    title: "3 numbers before you scale — LinkedIn version for marketing leads",
    draft: "Before you ask for more budget, bring these three numbers to your CEO: margin after ads, 7-day CPA trend and creative runway.",
  },
  {
    source: "breakdown-skincare",
    type: "youtube_short",
    platform: "youtube",
    title: "The approval bottleneck (60-second cut from the skincare breakdown)",
    draft: "One Monday scorecard replaced 30 daily approvals — and unlocked 12 new ad concepts a week.",
  },
  {
    source: "breakdown-skincare",
    type: "case_study",
    platform: "linkedin",
    title: "Case study: ₱800k to ₱4.2M/month — the four bottlenecks",
    draft: "Creative volume, offer, second channel, approval speed. Budget went up only after each bottleneck was cleared.",
  },
  {
    source: "creative-framework",
    type: "reel_caption",
    platform: "instagram",
    title: "Concept → angle → hook, as a Reel",
    draft: "Big swings before small tweaks. Test concepts first, then angles, then hooks.",
  },
]

const itemKey = (pieceKey: string, index = 0) => `item:${pieceKey}:${index}`

function scoresOf(t: ScoreTuple): IdeaScores {
  const [audience_relevance, authority_potential, business_alignment, timeliness, originality, repurposing_potential, ease_of_production] = t
  return { audience_relevance, authority_potential, business_alignment, timeliness, originality, repurposing_potential, ease_of_production }
}

function formatKind(format: FormatName): FormatKind {
  switch (FORMATS[format].script) {
    case "short_video":
      return "short"
    case "long_video":
      return "long"
    case "video_brief":
      return "live"
    case "carousel":
      return "carousel"
    case "instagram_caption":
      return "image"
    case "story_sequence":
      return "story"
    case "podcast_outline":
      return "audio"
    default:
      return "text"
  }
}

function defaultObjective(spec: Spec): string {
  const options = GOAL_OBJECTIVES[spec.goal]
  return options[hashString(spec.key) % options.length](PERSONA_AUDIENCE[spec.persona])
}

/** Brief CTA → the script's CTA section (so brief and copy agree) → a goal/funnel default. */
function ctaFor(spec: Spec): string {
  if (spec.brief?.cta) return spec.brief.cta
  if (spec.script) {
    const sections = SCRIPT_FORMATS[FORMATS[spec.format].script].sections
    const i = sections.findIndex((s) => s.key === "cta")
    const text = spec.script.s[i >= 0 ? i : sections.length - 1]?.trim().replace(/\s*\n\s*/g, " ")
    if (text) return text
  }
  return spec.funnel === "bofu" ? DIRECT_CTA : GOAL_CTA[spec.goal]
}

function withClock(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date)
  d.setHours(hours, minutes, 0, 0)
  return d
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function renderBody(sections: ScriptSection[]): string {
  return sections
    .map((s) => s.content.trim())
    .filter(Boolean)
    .join("\n\n")
}

/**
 * Move a day offset onto `weekday` inside its 7-day bucket (1–7, 8–14 … days
 * away) so series land on their day without changing weekly post counts.
 */
function snapToWeekday(ctx: SeedContext, offset: number, weekday: number): number {
  const distance = Math.abs(offset)
  if (distance === 0) return offset
  const sign = offset < 0 ? -1 : 1
  const bucketStart = Math.floor((distance - 1) / 7) * 7 + 1
  for (let d = bucketStart; d < bucketStart + 7; d++) {
    if (addDays(ctx.today, sign * d).getDay() === weekday) return sign * d
  }
  return offset
}

/** Publish times for "later today" slots: from 18:30 (or 45 min from now), 90 minutes apart. */
function laterToday(ctx: SeedContext, n: number): Date {
  const evening = ctx.date(0, "18:30")
  const soon = addMinutes(ctx.now, 45)
  soon.setMinutes(Math.ceil(soon.getMinutes() / 15) * 15, 0, 0)
  let at = addMinutes(evening > soon ? evening : soon, n * 90)
  const cap = ctx.date(0, "23:45")
  if (at > cap) at = cap > ctx.now ? cap : new Date(Math.min(addMinutes(ctx.now, 5).getTime(), endOfDay(ctx.now).getTime()))
  return at
}

function qualityOf(q: QualitySeed, evaluatedAt: Date): ContentQualityScore {
  const [hook, relevance, value, clarity, authenticity, cta] = q.parts
  const total = qualityTotal({ hook, relevance, value, clarity, authenticity, cta })
  return {
    hook,
    relevance,
    value,
    clarity,
    authenticity,
    cta,
    total,
    rating: qualityRating(total),
    strengths: q.strengths,
    improvements: q.improvements,
    evaluated_at: evaluatedAt.toISOString(),
    provider: "offline",
  }
}

export function buildDemoWorkspace(ctx: SeedContext): Database {
  const { rng, build } = ctx
  const past = (d: Date) => (d > ctx.now ? ctx.now : d)
  const daysBefore = (d: Date, days: number) => new Date(d.getTime() - days * DAY_MS)
  const workspaceStart = ctx.date(-WORKSPACE_AGE_DAYS, "09:00")
  const db = buildStarterKit(ctx, workspaceStart)

  const goalId = (g: GoalCategory) => ctx.id(`goal:${g}`)
  const pillarId = (p: PillarKey) => ctx.id(`pillar:${p}`)
  const personaId = (p: PersonaKey) => ctx.id(`persona:${p}`)
  const problemId = (key?: string) => (key ? ctx.id(`problem:${key}`) : null)
  const formatId = (f: FormatName) => ctx.id(formatKey(f))
  const campaignId = (key?: string) => (key ? ctx.id(`campaign:${key}`) : null)
  const seriesId = (key?: string) => (key ? ctx.id(`series:${key}`) : null)
  const resolveRef = (ref?: string): ID | null => {
    if (!ref) return null
    return ref.startsWith("item:") ? ctx.id(itemKey(ref.slice(5))) : ctx.id(ref)
  }
  const tagLinks: { tag: TagName; type: TaggableEntity; id: ID; at: Date }[] = []
  const tagAll = (tags: TagName[] | undefined, type: TaggableEntity, id: ID, at: Date) => {
    for (const tag of new Set(tags ?? [])) tagLinks.push({ tag, type, id, at })
  }

  /* ------------------------------ Settings & brand ------------------------------ */

  // A four-month-old workspace: every module in use, so Simple mode is off.
  db.app_settings = db.app_settings.map((s) => ({
    ...s,
    weekly_post_target: 10,
    default_owner: OWNER,
    simple_mode: false,
    ui_language: "en" as const,
    currency: "PHP",
  }))
  db.brand_profiles = [
    build(
      "brand_profiles",
      { ...BRAND, id: ctx.id("brand"), primary_goal_id: goalId("authority"), secondary_goal_id: goalId("leads") },
      workspaceStart,
      past(ctx.date(-12, "16:40"))
    ),
  ]

  db.content_pillars = PILLAR_PRESETS.map((preset, i) => {
    const key = PILLAR_KEYS[i]
    return build(
      "content_pillars",
      {
        id: pillarId(key),
        name: preset.name,
        description: PILLAR_COPY[key].description,
        color: preset.color,
        icon: preset.icon,
        target_percentage: preset.target_percentage,
        examples: PILLAR_COPY[key].examples,
        sort_order: i,
        is_active: true,
      },
      workspaceStart
    )
  })
  db.content_calendar = db.content_calendar.map((slot) => ({ ...slot, pillar_id: pillarId(CALENDAR_PILLARS[slot.day_of_week]) }))
  db.content_platforms = db.content_platforms.map((p) => ({
    ...p,
    current_followers: PLATFORM_DETAILS[p.platform].followers,
    preferred_pillar_ids: PLATFORM_DETAILS[p.platform].pillars.map(pillarId),
  }))

  /* ---------------------------------- Audience ---------------------------------- */

  db.audience_personas = PERSONA_KEYS.map((key) =>
    build("audience_personas", { ...PERSONAS[key], id: personaId(key) }, addDays(workspaceStart, 1))
  )
  db.audience_problems = PROBLEMS.map((p, i) =>
    build(
      "audience_problems",
      {
        id: problemId(p.key)!,
        persona_id: personaId(p.persona),
        problem: p.problem,
        category: p.category,
        severity: p.severity,
        pillar_id: p.pillar ? pillarId(p.pillar) : null,
        notes: p.notes ?? "",
      },
      past(addDays(workspaceStart, 1 + Math.floor(i / 4) * 6))
    )
  )

  /* ------------------------------ Knowledge & programs ------------------------------ */

  db.stories = STORIES.map((s, i) => {
    const created = past(addDays(workspaceStart, Math.min(i * 7, WORKSPACE_AGE_DAYS - 10)))
    const row = build(
      "stories",
      {
        id: ctx.id(`story:${s.key}`),
        type: s.type,
        title: s.title,
        situation: s.situation,
        problem: s.problem,
        action: s.action,
        result: s.result,
        lesson: s.lesson,
        emotion: s.emotion,
        pillar_id: pillarId(s.pillar),
        keywords: s.keywords,
        occurred_on: ctx.day(-s.daysAgo),
        is_favorite: Boolean(s.favorite),
      },
      s.daysAgo < WORKSPACE_AGE_DAYS ? past(ctx.date(-s.daysAgo + 1, "22:10")) : created
    )
    tagAll(s.tags, "stories", row.id, new Date(row.created_at))
    return row
  })

  db.research_items = RESEARCH.map((r) => {
    const created = ctx.date(-r.daysAgo, "13:20")
    return build(
      "research_items",
      {
        id: ctx.id(`research:${r.key}`),
        type: r.type,
        title: r.title,
        url: "",
        source: r.source,
        creator: r.creator,
        platform: r.platform,
        topic: r.topic,
        hook: r.hook,
        content: r.content,
        why_attention: r.why,
        learnings: r.learnings,
        adaptation: r.adaptation,
        analysis: r.analysis
          ? {
              hook: r.analysis.hook,
              structure: r.analysis.structure,
              angle: r.analysis.angle,
              psychology: r.analysis.psychology,
              why_it_works: r.analysis.why,
              patterns: r.analysis.patterns,
              analyzed_at: past(addMinutes(created, 40)).toISOString(),
              provider: "offline",
            }
          : null,
        status: r.status,
        pillar_id: r.pillar ? pillarId(r.pillar) : null,
      },
      created
    )
  })

  db.content_campaigns = (Object.keys(CAMPAIGNS) as (keyof typeof CAMPAIGNS)[]).map((key) => {
    const c = CAMPAIGNS[key]
    const row = build(
      "content_campaigns",
      {
        id: campaignId(key)!,
        name: c.name,
        objective: c.objective,
        description: c.description,
        start_date: ctx.day(c.start),
        end_date: ctx.day(c.end),
        persona_id: personaId(c.persona),
        pillar_id: pillarId(c.pillar),
        goal_id: goalId(c.goal),
        platforms: c.platforms,
        message: c.message,
        status: c.status,
        target_posts: c.target,
        color: c.color,
      },
      past(ctx.date(Math.min(c.start - 9, -2), "15:00"))
    )
    tagAll(c.tags, "content_campaigns", row.id, new Date(row.created_at))
    return row
  })

  db.content_series = (Object.keys(SERIES) as (keyof typeof SERIES)[]).map((key, i) => {
    const s = SERIES[key]
    return build(
      "content_series",
      {
        id: seriesId(key)!,
        name: s.name,
        description: s.description,
        frequency: s.frequency,
        day_of_week: s.day,
        platforms: s.platforms,
        pillar_id: pillarId(s.pillar),
        format_id: formatId(s.format),
        hook_template: s.hook,
        is_active: true,
      },
      addDays(workspaceStart, 20 + i * 9)
    )
  })

  /* ------------------------------- Content items ------------------------------- */

  const built: BuiltItem[] = []
  const firstCreated = new Map<string, Date>()

  const hookIdFor = (spec: Spec): ID | null => {
    if (spec.contentHook) return ctx.id(`hook:content:${spec.key}`)
    return spec.tpl ? ctx.id(hookTemplateKey(spec.tpl[0], spec.tpl[1])) : null
  }
  const ideaIdFor = (spec: Spec): ID | null => {
    if (spec.idea) return ctx.id(`idea:${spec.key}`)
    const parent = spec.parent ? SPEC_BY_KEY.get(spec.parent) : undefined
    return parent?.idea ? ctx.id(`idea:${parent.key}`) : null
  }
  const ideaPriority = (spec: Spec): Priority | null =>
    spec.idea?.scores ? priorityFromScore(computeIdeaScore(scoresOf(spec.idea.scores))) : null
  const commonValues = (spec: Spec, platform: PlatformId): InsertRow<"content_items"> => ({
    title: spec.title,
    idea_id: ideaIdFor(spec),
    pillar_id: pillarId(spec.pillar),
    persona_id: personaId(spec.persona),
    problem_id: problemId(spec.problem),
    goal_id: goalId(spec.goal),
    angle_id: ctx.id(angleKey(spec.angle)),
    hook_id: hookIdFor(spec),
    hook: spec.hook,
    hook_category: spec.hc,
    platform,
    format_id: formatId(spec.format),
    funnel_stage: spec.funnel,
    campaign_id: campaignId(spec.campaign),
    series_id: seriesId(spec.series),
    parent_id: spec.parent ? ctx.id(itemKey(spec.parent)) : null,
    repurpose_type: spec.repurposeType ?? null,
  })

  for (const spec of PUBLISHED) {
    const firstOffset = -spec.posts[0][1]
    const shift = spec.series ? snapToWeekday(ctx, firstOffset, SERIES[spec.series].day) - firstOffset : 0
    const lead = spec.idea?.leadDays ?? rng.int(3, 8)
    const parentLive = spec.parent ? (built.find((b) => b.spec.key === spec.parent && b.index === 0)?.publishedAt ?? null) : null
    let created: Date | null = null
    spec.posts.forEach(([platform, daysAgo, time], index) => {
      const publishedAt = ctx.date(-daysAgo + shift, time)
      if (publishedAt > ctx.now) return
      created ??= withClock(daysBefore(publishedAt, lead), rng.int(9, 16), rng.pick([5, 20, 35, 50]))
      // A repurposed version is only started once its source is live.
      const floor = parentLive ? withClock(addDays(parentLive, 1), 10, 5) : null
      if (floor && created < floor && floor < publishedAt) created = floor
      const iso = publishedAt.toISOString()
      const primary = index === 0
      const row = build(
        "content_items",
        {
          ...commonValues(spec, platform),
          id: ctx.id(itemKey(spec.key, index)),
          stage: primary && spec.repurposeQueue ? "repurpose" : "published",
          priority: spec.tier ? "high" : (ideaPriority(spec) ?? "medium"),
          owner: OWNER,
          due_date: toISODate(publishedAt),
          scheduled_at: iso,
          published_at: iso,
          quality_score: primary && spec.quality ? qualityOf(spec.quality, past(addDays(created, 1))) : null,
          pinned_winner: primary && Boolean(spec.pinned),
          why_it_worked: primary ? (spec.why ?? "") : "",
          replication_ideas: primary ? (spec.replicate ?? []) : [],
          notes: primary ? (spec.notes ?? "") : "",
        },
        created,
        past(addDays(publishedAt, 2))
      )
      built.push({ spec, index, row, publishedAt })
      if (primary) firstCreated.set(spec.key, created)
    })
  }

  let laterSlots = 0
  for (const spec of PIPELINE) {
    const [minAge, maxAge] = STAGE_AGE[spec.stage]
    const created = ctx.date(-rng.int(minAge, maxAge), `${rng.int(9, 17)}:${rng.pick(["05", "25", "40", "55"])}`)
    firstCreated.set(spec.key, created)
    spec.platforms.forEach((platform, index) => {
      let scheduledAt: Date | null = null
      if (spec.stage === "scheduled") {
        const [offset, time] = spec.slots?.[index] ?? spec.slots?.[0] ?? [1, "18:30"]
        if (time === "later") scheduledAt = laterToday(ctx, laterSlots++)
        else {
          const day = spec.series ? snapToWeekday(ctx, offset, SERIES[spec.series].day) : offset
          scheduledAt = ctx.date(day, time)
        }
      }
      const updated =
        spec.stage === "review"
          ? earlierToday(ctx, rng.int(30, 240))
          : new Date(ctx.now.getTime() - rng.int(2, 40) * 3_600_000)
      const row = build(
        "content_items",
        {
          ...commonValues(spec, platform),
          id: ctx.id(itemKey(spec.key, index)),
          stage: spec.stage,
          priority: spec.priority,
          owner: spec.owner,
          due_date: spec.stage === "scheduled" || spec.due === undefined ? null : ctx.day(spec.due),
          scheduled_at: scheduledAt?.toISOString() ?? null,
          published_at: null,
          quality_score: index === 0 && spec.quality ? qualityOf(spec.quality, past(addDays(created, 2))) : null,
          notes: spec.notes ?? "",
        },
        created,
        updated < created ? created : updated
      )
      built.push({ spec, index, row, publishedAt: null })
    })
  }

  db.content_items = built.map((b) => b.row)
  const specItems = new Map<string, BuiltItem[]>()
  for (const b of built) specItems.set(b.spec.key, [...(specItems.get(b.spec.key) ?? []), b])
  for (const b of built) tagAll(b.spec.tags, "content_items", b.row.id, new Date(b.row.created_at))

  /* ------------------------------ Briefs & scripts ------------------------------ */

  db.content_briefs = built.map(({ spec, row, publishedAt }) => {
    const b = spec.brief ?? {}
    const rich = !publishedAt || Boolean(spec.script)
    return build(
      "content_briefs",
      {
        content_item_id: row.id,
        objective: b.objective ?? defaultObjective(spec),
        main_message: spec.msg,
        supporting_points: b.points ?? [],
        cta: ctaFor(spec),
        visual_direction: b.visual ?? (rich ? VISUAL[formatKind(spec.format)] : ""),
        reference: b.reference ?? "",
        caption: b.caption ?? spec.script?.caption ?? "",
        production_notes: b.notes ?? "",
        b_roll: b.broll ?? [],
        on_screen_text: b.onScreen ?? [],
      },
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  })

  const scriptBodies = new Map<string, string>()
  db.content_scripts = built.flatMap(({ spec, row }) => {
    if (!spec.script) return []
    const format = FORMATS[spec.format].script
    const sectionSpecs = SCRIPT_FORMATS[format].sections
    const toSections = (contents: string[]): ScriptSection[] => {
      if (contents.length !== sectionSpecs.length) {
        throw new Error(`Seed script "${spec.key}" has ${contents.length} sections; ${format} needs ${sectionSpecs.length}`)
      }
      return sectionSpecs.map((s, i) => ({ key: s.key, label: s.label, content: contents[i] }))
    }
    const itemCreated = new Date(row.created_at)
    const current = toSections(spec.script.s)
    const body = renderBody(current)
    scriptBodies.set(row.id, body)
    const rows = []
    const version = spec.script.previous ? 2 : 1
    if (spec.script.previous) {
      const previous = toSections(spec.script.previous)
      rows.push(
        build(
          "content_scripts",
          {
            content_item_id: row.id,
            format,
            title: SCRIPT_FORMATS[format].label,
            sections: previous,
            body: renderBody(previous),
            caption: "",
            hashtags: [],
            version: 1,
            is_current: false,
            generated_by: "offline",
          },
          past(addDays(itemCreated, 1))
        )
      )
    }
    rows.push(
      build(
        "content_scripts",
        {
          content_item_id: row.id,
          format,
          title: SCRIPT_FORMATS[format].label,
          sections: current,
          body,
          caption: spec.script.caption ?? "",
          hashtags: spec.script.hashtags ?? [],
          version,
          is_current: true,
          generated_by: "manual",
        },
        past(addDays(itemCreated, version)),
        new Date(Math.max(new Date(row.updated_at).getTime(), past(addDays(itemCreated, version)).getTime()))
      )
    )
    return rows
  })

  /* ------------------------------------ Hooks ------------------------------------ */

  const favoriteTemplates = new Set([hookTemplateKey("contrarian", 0), hookTemplateKey("contrarian", 3), hookTemplateKey("list", 1), hookTemplateKey("story", 2)].map((k) => ctx.id(k)))
  db.hooks = db.hooks.map((h) => (favoriteTemplates.has(h.id) ? { ...h, is_favorite: true } : h))
  for (const spec of [...PUBLISHED, ...PIPELINE]) {
    if (!spec.contentHook) continue
    const created = firstCreated.get(spec.key) ?? workspaceStart
    db.hooks.push(
      build(
        "hooks",
        {
          id: ctx.id(`hook:content:${spec.key}`),
          text: spec.hook,
          category: spec.hc,
          is_template: false,
          source: "content",
          pillar_id: pillarId(spec.pillar),
          notes: `Used in "${spec.title}".`,
          is_favorite: "tier" in spec && spec.tier !== undefined,
        },
        created
      )
    )
  }

  /* ------------------------------------ Ideas ------------------------------------ */

  for (const spec of [...PUBLISHED, ...PIPELINE]) {
    if (!spec.idea) continue
    const items = specItems.get(spec.key)
    const first = items?.[0]
    if (!first) continue
    const itemCreated = new Date(first.row.created_at)
    const created = withClock(daysBefore(itemCreated, spec.idea.leadDays ?? 3), rng.int(8, 21), rng.pick([10, 25, 45]))
    const scores = spec.idea.scores ? scoresOf(spec.idea.scores) : null
    const score = scores ? computeIdeaScore(scores) : null
    const problem = spec.problem ? PROBLEMS.find((p) => p.key === spec.problem) : undefined
    const row = build(
      "content_ideas",
      {
        id: ctx.id(`idea:${spec.key}`),
        title: spec.title,
        core_topic: TOPIC_LABELS[spec.tags?.[0] ?? "marketing"],
        description: spec.msg,
        hook: spec.hook,
        hook_category: spec.hc,
        angle_id: ctx.id(angleKey(spec.angle)),
        pillar_id: pillarId(spec.pillar),
        persona_id: personaId(spec.persona),
        problem_id: problemId(spec.problem),
        goal_id: goalId(spec.goal),
        platforms: [...new Set(items.map((i) => i.row.platform))],
        format_id: formatId(spec.format),
        funnel_stage: spec.funnel,
        inspiration: spec.brief?.reference ?? "",
        source: spec.idea.source,
        source_ref_id: resolveRef(spec.idea.ref),
        priority: score !== null ? priorityFromScore(score) : "medium",
        status: "converted",
        scores,
        score,
        why_it_matters: problem
          ? `Real problem for our ${PERSONAS[problem.persona].name} persona (severity ${problem.severity}/5): ${problem.problem}.`
          : GOALS[spec.goal].description,
        talking_points: spec.brief?.points ?? [],
        cta: ctaFor(spec),
        campaign_id: campaignId(spec.campaign),
        series_id: seriesId(spec.series),
        converted_item_id: first.row.id,
      },
      created,
      itemCreated
    )
    db.content_ideas.push(row)
    tagAll(spec.tags, "content_ideas", row.id, created)
  }

  for (const idea of IDEAS) {
    const created =
      idea.minutesAgo !== undefined
        ? earlierToday(ctx, idea.minutesAgo)
        : ctx.date(-(idea.daysAgo ?? 1), rng.pick(["08:40", "10:15", "12:30", "15:05", "19:20", "21:45"]))
    const scores = idea.scores ? scoresOf(idea.scores) : null
    const score = scores ? computeIdeaScore(scores) : null
    const touched = idea.status === "inbox" || idea.status === "archived" ? created : past(addDays(created, 1))
    const row = build(
      "content_ideas",
      {
        id: ctx.id(`idea:${idea.key}`),
        title: idea.title,
        core_topic: idea.topic,
        description: idea.desc,
        hook: idea.hook,
        hook_category: idea.hc,
        angle_id: ctx.id(angleKey(idea.angle)),
        pillar_id: pillarId(idea.pillar),
        persona_id: personaId(idea.persona),
        problem_id: problemId(idea.problem),
        goal_id: goalId(idea.goal),
        platforms: idea.platforms,
        format_id: formatId(idea.format),
        funnel_stage: idea.funnel,
        inspiration: idea.inspiration ?? "",
        source: idea.source,
        source_ref_id: resolveRef(idea.ref),
        priority: score !== null ? priorityFromScore(score) : idea.status === "archived" ? "low" : "medium",
        status: idea.status,
        scores,
        score,
        why_it_matters: idea.why ?? "",
        talking_points: idea.points ?? [],
        cta: idea.cta ?? "",
        campaign_id: campaignId(idea.campaign),
        series_id: seriesId(idea.series),
      },
      created,
      touched < created ? created : touched
    )
    db.content_ideas.push(row)
    tagAll(idea.tags, "content_ideas", row.id, created)
  }

  db.audience_questions = QUESTIONS.map((q, i) =>
    build(
      "audience_questions",
      {
        id: ctx.id(`question:${i}`),
        question: q.question,
        source_person: q.source,
        platform: q.platform,
        topic: q.topic,
        frequency: q.frequency,
        pillar_id: q.pillar ? pillarId(q.pillar) : null,
        persona_id: personaId(q.persona),
        status: q.status,
        idea_id: q.idea ? ctx.id(q.idea) : null,
        content_item_id: q.item ? ctx.id(itemKey(q.item)) : null,
        last_asked_at: ctx.day(-q.lastAskedDaysAgo),
      },
      ctx.date(-(q.lastAskedDaysAgo + 10 + q.frequency * 4), "11:30"),
      past(ctx.date(-q.lastAskedDaysAgo, "18:00"))
    )
  )

  /* ---------------------------- Repurposing & metrics ---------------------------- */

  for (const { spec, index, row } of built) {
    if (!spec.parent || !spec.repurposeType || index !== 0) continue
    db.content_repurposing.push(
      build(
        "content_repurposing",
        {
          source_item_id: ctx.id(itemKey(spec.parent)),
          target_item_id: row.id,
          type: spec.repurposeType,
          platform: row.platform,
          status: "created",
          title: spec.title,
          draft: scriptBodies.get(row.id) ?? "",
        },
        new Date(row.created_at)
      )
    )
  }
  for (const s of REPURPOSE_SUGGESTIONS) {
    const source = specItems.get(s.source)?.[0]
    if (!source?.publishedAt) continue
    db.content_repurposing.push(
      build(
        "content_repurposing",
        { source_item_id: source.row.id, target_item_id: null, type: s.type, platform: s.platform, status: "suggested", title: s.title, draft: s.draft },
        past(addDays(source.publishedAt, 3))
      )
    )
  }

  const subjects: MetricSubject[] = built
    .filter((b): b is BuiltItem & { spec: PublishedSpec; publishedAt: Date } => b.publishedAt !== null && "posts" in b.spec)
    .map(({ spec, index, row, publishedAt }) => ({
      item: row,
      publishedAt,
      pillar: spec.pillar,
      hc: spec.hc,
      kind: formatKind(spec.format),
      funnel: spec.funnel,
      goal: spec.goal,
      hookWords: wordCount(spec.hook),
      tier: index === 0 ? spec.tier : undefined,
      repurposed: Boolean(spec.parent),
      taglish: TAGLISH_KEYS.has(spec.key),
      earlySnapshot: index === 0 && (spec.tier !== undefined || EARLY_SNAPSHOT_KEYS.has(spec.key)),
      noSales: Boolean(spec.recruiting),
      note: index === 0 ? METRIC_NOTES[spec.key] : undefined,
    }))
  db.content_metrics = buildMetrics(ctx, subjects)

  /* ------------------------------ Experiments & reviews ------------------------------ */

  const refItem = (ref: string) => {
    const [key, idx] = ref.split(":")
    return ctx.id(itemKey(key, idx ? Number(idx) : 0))
  }
  db.content_experiments = EXPERIMENTS.map((e) =>
    build(
      "content_experiments",
      {
        name: e.name,
        hypothesis: e.hypothesis,
        variant_a: e.variantA,
        variant_b: e.variantB,
        metric: e.metric,
        start_date: e.start === null ? null : ctx.day(e.start),
        end_date: e.end === null ? null : ctx.day(e.end),
        status: e.status,
        variant_a_item_ids: e.a.map(refItem),
        variant_b_item_ids: e.b.map(refItem),
        result: e.result ?? "",
        winner: e.winner ?? null,
        lesson: e.lesson ?? "",
      },
      past(ctx.date(Math.min((e.start ?? 0) - 3, -1), "16:30")),
      e.status === "completed" && e.end !== null ? past(ctx.date(e.end + 1, "10:00")) : undefined
    )
  )

  const thisWeek = startOfWeek(ctx.now, 1)
  db.weekly_reviews = WEEKLY_REVIEWS.map((w) => {
    const weekStart = addDays(thisWeek, -7 * w.weeksAgo)
    const weekEnd = addDays(weekStart, 7)
    const planned = built
      .filter((b) => b.publishedAt && b.publishedAt >= weekStart && b.publishedAt < weekEnd)
      .map((b) => b.row.id)
    const created = past(withClock(weekEnd, 9, 30))
    return build(
      "weekly_reviews",
      {
        week_start: toISODate(weekStart),
        focus: w.focus,
        stats: null,
        what_worked: w.what_worked,
        what_didnt: w.what_didnt,
        learned: w.learned,
        double_down: w.double_down,
        stop: w.stop,
        test_next: w.test_next,
        planned_item_ids: planned,
        status: "final",
        generated_by: "manual",
      },
      created
    )
  })

  const lastMonth = startOfMonth(subMonths(ctx.now, 1))
  db.monthly_reviews = [
    build(
      "monthly_reviews",
      {
        month: toISODate(lastMonth),
        stats: null,
        summary: MONTHLY_REVIEW.summary,
        continue_doing: MONTHLY_REVIEW.continue_doing,
        increase: MONTHLY_REVIEW.increase,
        reduce: MONTHLY_REVIEW.reduce,
        stop: MONTHLY_REVIEW.stop,
        experiment: MONTHLY_REVIEW.experiment,
        status: "final",
        generated_by: "manual",
      },
      past(withClock(addDays(startOfMonth(ctx.now), 1), 10, 0))
    ),
  ]

  /* ------------------------------- Engagement logs ------------------------------- */

  const skipped = new Set([4, 11, 17])
  const tasks = db.app_settings[0].engagement_tasks
  const target = (key: string) => tasks.find((t) => t.key === key)?.target ?? 0
  for (let d = 21; d >= 1; d--) {
    if (skipped.has(d)) continue
    const comments = rng.int(5, 19)
    const dms = rng.int(2, 9)
    const creators = rng.int(1, 7)
    const questions = rng.int(0, 4)
    const completed = [
      comments >= target("reply_comments") ? "reply_comments" : null,
      dms >= target("reply_dms") ? "reply_dms" : null,
      creators >= target("comment_creators") ? "comment_creators" : null,
      rng.chance(0.55) ? "answer_questions" : null,
      questions >= target("collect_questions") ? "collect_questions" : null,
    ].filter((k): k is string => k !== null && tasks.some((t) => t.key === k))
    db.engagement_logs.push(
      build(
        "engagement_logs",
        {
          date: ctx.day(-d),
          comments_replied: comments,
          dms_replied: dms,
          creator_comments: creators,
          questions_collected: questions,
          ideas_captured: rng.int(0, 3),
          completed_tasks: completed,
          notes: rng.chance(0.45) ? rng.pick(ENGAGEMENT_NOTES) : "",
        },
        ctx.date(-d, "21:40")
      )
    )
  }

  /* ------------------------------------ Tags ------------------------------------ */

  const seen = new Set<string>()
  for (const link of tagLinks) {
    const key = `${link.tag}|${link.type}|${link.id}`
    if (seen.has(key)) continue
    seen.add(key)
    db.content_tags.push(
      build("content_tags", { tag_id: ctx.id(tagKey(link.tag)), entity_type: link.type, entity_id: link.id }, past(link.at))
    )
  }

  /* ------------------------------------ Money ------------------------------------ */

  // Last, so the ids above never shift when the Money data changes.
  const money = buildMoney(ctx, {
    item: (ref) => {
      const [key, index] = ref.split(":")
      return specItems.get(key)?.find((b) => b.index === (index ? Number(index) : 0))?.row.id ?? null
    },
    campaign: (key) => campaignId(key),
    workspaceStart,
  })
  db.brand_deals = money.brand_deals
  db.income_entries = money.income_entries
  db.rate_cards = money.rate_cards

  return db
}
