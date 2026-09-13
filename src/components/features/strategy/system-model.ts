/**
 * Flywheel & System model: live evidence for each flywheel step (§51) and a live enforcement metric
 * for each of the ten system principles (§50). Operating rhythm and the core loop live in
 * `system-rhythm.ts`. Pure — no React, no store. `now` is passed in.
 */
import { format, parseISO, startOfDay, subDays } from "date-fns"
import {
  comparePeriods,
  consistencyStats,
  contentBuffer,
  getWinners,
  inRange,
  isPublishedItem,
  percentChange,
  periodTotals,
  pillarMix,
  previousPeriod,
  publishedAtOf,
  repurposedSourceIds,
  scopedRows,
  type DateRange,
} from "@/lib/analytics"
import { FLYWHEEL_STEPS } from "@/lib/constants"
import type { AppSettings, BrandProfile, Database, ID } from "@/lib/types"
import { formatCompact, formatNumber, pluralize } from "@/lib/utils"

export type Tone = "good" | "warning" | "serious" | "critical" | "neutral"

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

/** Same bands as the Content Health Score: 80 / 60 / 40. */
export function toneFor(score: number | null): Tone {
  if (score === null || !Number.isFinite(score)) return "neutral"
  if (score >= 80) return "good"
  if (score >= 60) return "warning"
  if (score >= 40) return "serious"
  return "critical"
}

function createdIn(value: string, range: DateRange): boolean {
  const date = value ? parseISO(value) : null
  return inRange(date && !Number.isNaN(date.getTime()) ? date : null, range)
}

/* -------------------------------- Flywheel -------------------------------- */

export type FlywheelKey =
  | "expertise"
  | "content"
  | "attention"
  | "trust"
  | "authority"
  | "community"
  | "opportunity"
  | "experience"
  | "more_content"

export interface FlywheelStep {
  key: FlywheelKey
  label: string
  description: string
  /** Formatted evidence value, e.g. "412K". */
  value: string
  unit: string
  /** % change vs the previous 30 days; null when there is nothing to compare. */
  delta: number | null
  href: string
  /** What to do when this step stalls. */
  tip: { text: string; href: string }
}

export interface FlywheelSummary {
  steps: FlywheelStep[]
  /** Steps with a positive change. */
  growing: number
  /** Steps with a comparable change. */
  measured: number
  strongest: FlywheelStep | null
  /** The step with the biggest decline (null when nothing declined). */
  weakest: FlywheelStep | null
}

const STEP_META: { key: FlywheelKey; href: string; tip: { text: string; href: string } }[] = [
  { key: "expertise", href: "/strategy", tip: { text: "Keep Brand HQ current with the expertise you've earned lately.", href: "/strategy" } },
  { key: "content", href: "/analytics/posts", tip: { text: "Run the Weekly Planner so you post consistently.", href: "/calendar/planner" } },
  { key: "attention", href: "/analytics", tip: { text: "Test stronger hooks from the Hook Library.", href: "/ideas/hooks" } },
  { key: "trust", href: "/analytics", tip: { text: "Publish saveable frameworks, checklists and carousels.", href: "/ideas/generator" } },
  { key: "authority", href: "/winners", tip: { text: "Replicate your winners from new angles.", href: "/winners" } },
  { key: "community", href: "/today", tip: { text: "Reply to comments and turn audience questions into content.", href: "/audience/questions" } },
  { key: "opportunity", href: "/analytics", tip: { text: "Add clear conversion calls to action on proven topics.", href: "/pillars/funnel" } },
  { key: "experience", href: "/stories", tip: { text: "Log this week's wins, failures and lessons in the Story Vault.", href: "/stories" } },
  { key: "more_content", href: "/ideas", tip: { text: "Turn stories and winners into new ideas.", href: "/stories/experience" } },
]

export function flywheel(db: Database, now: Date, brand: Pick<BrandProfile, "expertise_areas" | "years_experience">): FlywheelSummary {
  const current: DateRange = { start: startOfDay(subDays(now, 29)), end: now }
  const previous = previousPeriod(current.start, current.end)
  const cur = periodTotals(db, current.start, current.end)
  const prev = periodTotals(db, previous.start, previous.end)
  const deltas = comparePeriods(cur, prev)
  const newStories = db.stories.filter((s) => createdIn(s.created_at, current)).length
  const oldStories = db.stories.filter((s) => createdIn(s.created_at, previous)).length
  const newIdeas = db.content_ideas.filter((i) => createdIn(i.created_at, current)).length
  const oldIdeas = db.content_ideas.filter((i) => createdIn(i.created_at, previous)).length
  const years = brand.years_experience

  const evidence: Record<FlywheelKey, { value: string; unit: string; delta: number | null }> = {
    expertise: {
      value: formatNumber(brand.expertise_areas.length),
      unit: `${brand.expertise_areas.length === 1 ? "area" : "areas"}${years !== null ? ` · ${Math.round(years * 10) / 10} yrs` : ""}`,
      delta: null,
    },
    content: { value: formatNumber(cur.posts), unit: cur.posts === 1 ? "post" : "posts", delta: deltas.posts },
    attention: { value: formatCompact(cur.views), unit: "views", delta: deltas.views },
    trust: { value: formatCompact(cur.saves), unit: "saves", delta: deltas.saves },
    authority: { value: formatCompact(cur.shares), unit: "shares", delta: deltas.shares },
    community: { value: formatCompact(cur.comments), unit: "comments", delta: deltas.comments },
    opportunity: { value: formatNumber(cur.leads), unit: cur.leads === 1 ? "lead" : "leads", delta: deltas.leads },
    experience: {
      value: formatNumber(db.stories.length),
      unit: `stories · ${newStories} new`,
      delta: percentChange(newStories, oldStories),
    },
    more_content: { value: formatNumber(newIdeas), unit: newIdeas === 1 ? "new idea" : "new ideas", delta: percentChange(newIdeas, oldIdeas) },
  }

  const steps = STEP_META.map((meta, i): FlywheelStep => ({
    ...meta,
    label: FLYWHEEL_STEPS[i]?.label ?? meta.key,
    description: FLYWHEEL_STEPS[i]?.description ?? "",
    ...evidence[meta.key],
  }))
  const measured = steps.filter((s) => s.delta !== null)
  const byDelta = [...measured].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
  const weakest = byDelta[0] && (byDelta[0].delta ?? 0) < 0 ? byDelta[0] : null
  const top = byDelta[byDelta.length - 1]
  return {
    steps,
    growing: measured.filter((s) => (s.delta ?? 0) > 0).length,
    measured: measured.length,
    strongest: top && (top.delta ?? 0) > 0 ? top : null,
    weakest,
  }
}

/* ------------------------------- Principles ------------------------------- */

export interface PrincipleMetric {
  value: string
  /** What the value measures. */
  label: string
  tone: Tone
  detail: string
  href: string
  hrefLabel: string
}

/** One live metric per SYSTEM_PRINCIPLES entry (same order). */
export function principleMetrics(db: Database, now: Date, settings: AppSettings, brandCompleteness: number): PrincipleMetric[] {
  const last90 = { start: startOfDay(subDays(now, 89)), end: now }
  // Active content: everything still in the pipeline plus what went out in the last 90 days.
  const working = db.content_items.filter((i) => !isPublishedItem(i) || inRange(publishedAtOf(i), last90))
  const none = (label: string, href: string, hrefLabel: string, detail: string): PrincipleMetric => ({
    value: "—",
    label,
    tone: "neutral",
    detail,
    href,
    hrefLabel,
  })

  // 1 · Audience
  const withPersona = working.filter((i) => i.persona_id).length
  const audience = working.length
    ? {
        value: `${pct(withPersona, working.length)}%`,
        label: "of active content targets a persona",
        tone: toneFor(pct(withPersona, working.length)),
        detail: `${pluralize(working.length - withPersona, "item")} without a persona · ${pluralize(db.audience_personas.length, "persona")} in Audience HQ`,
        href: "/audience",
        hrefLabel: "Audience HQ",
      }
    : none("No content yet", "/audience", "Audience HQ", "Every idea should start from a persona and a real problem.")

  // 2 · Purpose
  const withGoal = working.filter((i) => i.goal_id).length
  const withFunnel = working.filter((i) => i.funnel_stage).length
  const withBoth = working.filter((i) => i.goal_id && i.funnel_stage).length
  const purpose = working.length
    ? {
        value: `${pct(withBoth, working.length)}%`,
        label: "of active content has a goal and a funnel stage",
        tone: toneFor(pct(withBoth, working.length)),
        detail: `${pct(withGoal, working.length)}% have a goal · ${pct(withFunnel, working.length)}% a funnel stage`,
        href: "/strategy/goals",
        hrefLabel: "Goals",
      }
    : none("No content yet", "/strategy/goals", "Goals", "Each item carries a goal and a funnel stage.")

  // 3 · Consistency
  const consistency = consistencyStats(db, now, settings, 8)
  const buffer = contentBuffer(db, now, settings)
  const consistent: PrincipleMetric =
    consistency.weeksCounted > 0
      ? {
          value: `${consistency.weeksConsistent}/${consistency.weeksCounted}`,
          label: "recent weeks at 80%+ of your weekly target",
          tone: toneFor(consistency.score),
          detail: `Content Buffer: ${pluralize(buffer.days, "day")} ready · ${buffer.label}`,
          href: "/calendar/schedule",
          hrefLabel: "Posting Schedule",
        }
      : none("No completed week yet", "/calendar/schedule", "Posting Schedule", `Content Buffer: ${pluralize(buffer.days, "day")} ready`)

  // 4 · Real problems
  const openIdeas = db.content_ideas.filter((i) => i.status !== "archived")
  const questionIdeas = new Set(db.audience_questions.map((q) => q.idea_id).filter((id): id is ID => Boolean(id)))
  const fromProblems = openIdeas.filter(
    (i) => i.problem_id || i.source === "problem_bank" || i.source === "question_bank" || questionIdeas.has(i.id)
  ).length
  const problems = openIdeas.length
    ? {
        value: `${pct(fromProblems, openIdeas.length)}%`,
        label: "of ideas trace back to a real audience problem or question",
        tone: toneFor(pct(fromProblems, openIdeas.length) * 1.5),
        detail: `${pluralize(db.audience_problems.length, "problem")} · ${pluralize(db.audience_questions.length, "question")} in the banks`,
        href: "/audience/problems",
        hrefLabel: "Problem Bank",
      }
    : none("No ideas yet", "/audience/problems", "Problem Bank", "The Problem and Question Banks feed the Idea Bank.")

  // 5 · Winners repeated
  const winners = getWinners(db, settings, now, { days: 90 })
  const repurposed = repurposedSourceIds(db)
  const replicated = new Set(
    db.content_ideas
      .filter((i) => i.source === "winner" || i.source === "repurpose")
      .map((i) => i.source_ref_id)
      .filter((id): id is ID => Boolean(id))
  )
  const repeated = winners.filter((w) => repurposed.has(w.id) || replicated.has(w.id)).length
  const winnersMetric = winners.length
    ? {
        value: `${repeated}/${winners.length}`,
        label: "recent winners were repeated or repurposed",
        tone: toneFor(pct(repeated, winners.length)),
        detail: winners.length - repeated ? `${pluralize(winners.length - repeated, "winner")} still waiting for a follow-up` : "Every recent winner has a follow-up",
        href: "/winners",
        hrefLabel: "Winning Content Library",
      }
    : none("No winners in the last 90 days yet", "/winners", "Winning Content Library", "Log analytics so Winner detection can find them.")

  // 6 · One idea, many assets
  const assetsPerIdea = new Map<ID, number>()
  for (const item of db.content_items) if (item.idea_id) assetsPerIdea.set(item.idea_id, (assetsPerIdea.get(item.idea_id) ?? 0) + 1)
  const repurposedVersions = db.content_items.filter((i) => i.parent_id).length
  const converted = assetsPerIdea.size
  const assets = [...assetsPerIdea.values()].reduce((a, b) => a + b, 0)
  const avg = converted ? assets / converted : 0
  const multi = [...assetsPerIdea.values()].filter((n) => n >= 2).length
  const multiAssets = converted
    ? {
        value: avg.toFixed(1),
        label: "content assets per converted idea",
        tone: (avg >= 2 ? "good" : avg >= 1.5 ? "warning" : avg >= 1.2 ? "serious" : "critical") as Tone,
        detail: `${pct(multi, converted)}% of ideas became 2+ assets · ${pluralize(repurposedVersions, "repurposed version")}`,
        href: "/studio",
        hrefLabel: "Repurposing Engine",
      }
    : none("No converted ideas yet", "/studio", "Repurposing Engine", "Repurpose one good idea into several assets.")

  // 7 · Performance influences content
  const rows30 = scopedRows(db, now, { days: 30, settings })
  const measured30 = rows30.filter((r) => r.metric).length
  const lastReview = [...db.weekly_reviews].sort((a, b) => b.week_start.localeCompare(a.week_start))[0]
  const reviewText = lastReview ? `Last Weekly Report: week of ${format(parseISO(lastReview.week_start), "MMM d")}` : "No Weekly Report yet"
  const performance = rows30.length
    ? {
        value: `${pct(measured30, rows30.length)}%`,
        label: "of posts from the last 30 days have analytics logged",
        tone: toneFor(pct(measured30, rows30.length)),
        detail: reviewText,
        href: "/analytics",
        hrefLabel: "Analytics",
      }
    : none("No posts in the last 30 days", "/analytics", "Analytics", reviewText)

  // 8 · Personal experiences
  const storyIdeas = db.content_ideas.filter(
    (i) => (i.source === "story" || i.source === "experience") && createdIn(i.created_at, last90)
  ).length
  const stories = db.stories.length
  const experiences: PrincipleMetric = {
    value: formatNumber(stories),
    label: stories === 1 ? "story in the Story Vault" : "stories in the Story Vault",
    tone: stories >= 10 ? "good" : stories >= 5 ? "warning" : stories >= 1 ? "serious" : "critical",
    detail: `${pluralize(storyIdeas, "idea")} came from stories or experiences in the last 90 days`,
    href: "/stories",
    hrefLabel: "Story Vault",
  }

  // 9 · Positioning over virality
  const rows90 = scopedRows(db, now, { days: 90, settings })
  const activePillars = new Set(db.content_pillars.filter((p) => p.is_active).map((p) => p.id))
  const inPillar = rows90.filter((r) => r.pillarId && activePillars.has(r.pillarId)).length
  const mix = pillarMix(db, now, settings)
  const positioning = rows90.length
    ? {
        value: `${pct(inPillar, rows90.length)}%`,
        label: "of posts in the last 90 days sit inside a Content Pillar",
        tone: toneFor(pct(inPillar, rows90.length)),
        detail: mix.warnings.length ? `${pluralize(mix.warnings.length, "pillar")} off target in the current mix` : "Pillar mix within tolerance",
        href: "/pillars",
        hrefLabel: "Content Pillars",
      }
    : none("No posts in the last 90 days", "/pillars", "Content Pillars", "Scores measure quality and fit, not predicted virality.")

  // 10 · Recognisable expertise
  const brand = db.brand_profiles[0]
  const hasStatement = Boolean(brand?.positioning_audience.trim() && brand?.positioning_result.trim())
  const expertise: PrincipleMetric = {
    value: `${brandCompleteness}%`,
    label: "of Brand HQ complete",
    tone: toneFor(brandCompleteness),
    detail: `${pluralize(activePillars.size, "active pillar")} · positioning statement ${hasStatement ? "set" : "missing"}`,
    href: "/strategy",
    hrefLabel: "Brand HQ",
  }

  return [audience, purpose, consistent, problems, winnersMetric, multiAssets, performance, experiences, positioning, expertise]
}
