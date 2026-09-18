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
import { translator, type Translator, type UiLang } from "@/lib/i18n/core"
import type { AppSettings, BrandProfile, Database, ID } from "@/lib/types"
import { formatCompact, formatNumber } from "@/lib/utils"
import { systemEvidenceMessages, systemKnowledgeMessages } from "./system-messages"

type EvidenceT = Translator<(typeof systemEvidenceMessages)["en"]>
type CountKey = {
  [K in keyof (typeof systemEvidenceMessages)["en"]]: K extends `${infer B}_one` ? B : never
}[keyof (typeof systemEvidenceMessages)["en"]]

/** "3 items" / "1 idea" in the UI language (numbers formatted like `pluralize`). */
export function counted(t: EvidenceT, key: CountKey, n: number): string {
  return t.plural(key, n, { count: formatNumber(n) })
}

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

const STEP_META: { key: FlywheelKey; href: string; tipHref: string }[] = [
  { key: "expertise", href: "/strategy", tipHref: "/strategy" },
  { key: "content", href: "/analytics/posts", tipHref: "/calendar/planner" },
  { key: "attention", href: "/analytics", tipHref: "/ideas/hooks" },
  { key: "trust", href: "/analytics", tipHref: "/ideas/generator" },
  { key: "authority", href: "/winners", tipHref: "/winners" },
  { key: "community", href: "/today", tipHref: "/audience/questions" },
  { key: "opportunity", href: "/analytics", tipHref: "/pillars/funnel" },
  { key: "experience", href: "/stories", tipHref: "/stories" },
  { key: "more_content", href: "/ideas", tipHref: "/stories/experience" },
]

export function flywheel(
  db: Database,
  now: Date,
  brand: Pick<BrandProfile, "expertise_areas" | "years_experience">,
  lang: UiLang = "en"
): FlywheelSummary {
  const t = translator(systemEvidenceMessages, lang)
  const tk = translator(systemKnowledgeMessages, lang)
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
      unit: `${t.plural("unit_areas", brand.expertise_areas.length)}${years !== null ? t("unit_years", { count: Math.round(years * 10) / 10 }) : ""}`,
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
      unit: t("unit_stories_new", { count: newStories }),
      delta: percentChange(newStories, oldStories),
    },
    more_content: { value: formatNumber(newIdeas), unit: t.plural("unit_new_ideas", newIdeas), delta: percentChange(newIdeas, oldIdeas) },
  }

  const steps = STEP_META.map((meta, i): FlywheelStep => ({
    key: meta.key,
    href: meta.href,
    tip: { text: t(`tip_${meta.key}`), href: meta.tipHref },
    label: lang === "en" ? (FLYWHEEL_STEPS[i]?.label ?? meta.key) : tk(`fw_${meta.key}_label`),
    description: lang === "en" ? (FLYWHEEL_STEPS[i]?.description ?? "") : tk(`fw_${meta.key}_description`),
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
export function principleMetrics(
  db: Database,
  now: Date,
  settings: AppSettings,
  brandCompleteness: number,
  lang: UiLang = "en"
): PrincipleMetric[] {
  const t = translator(systemEvidenceMessages, lang)
  const n = (key: CountKey, count: number) => counted(t, key, count)
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
        label: t("audience_label"),
        tone: toneFor(pct(withPersona, working.length)),
        detail: t("audience_detail", { items: n("items", working.length - withPersona), personas: n("personas", db.audience_personas.length) }),
        href: "/audience",
        hrefLabel: "Audience HQ",
      }
    : none(t("no_content"), "/audience", "Audience HQ", t("audience_none"))

  // 2 · Purpose
  const withGoal = working.filter((i) => i.goal_id).length
  const withFunnel = working.filter((i) => i.funnel_stage).length
  const withBoth = working.filter((i) => i.goal_id && i.funnel_stage).length
  const purpose = working.length
    ? {
        value: `${pct(withBoth, working.length)}%`,
        label: t("purpose_label"),
        tone: toneFor(pct(withBoth, working.length)),
        detail: t("purpose_detail", { goal: pct(withGoal, working.length), funnel: pct(withFunnel, working.length) }),
        href: "/strategy/goals",
        hrefLabel: "Goals",
      }
    : none(t("no_content"), "/strategy/goals", "Goals", t("purpose_none"))

  // 3 · Consistency
  const consistency = consistencyStats(db, now, settings, 8)
  const buffer = contentBuffer(db, now, settings, lang)
  const consistent: PrincipleMetric =
    consistency.weeksCounted > 0
      ? {
          value: `${consistency.weeksConsistent}/${consistency.weeksCounted}`,
          label: t("consistency_label"),
          tone: toneFor(consistency.score),
          detail: t("consistency_detail", { days: n("days", buffer.days), status: buffer.label }),
          href: "/calendar/schedule",
          hrefLabel: "Posting Schedule",
        }
      : none(t("consistency_none"), "/calendar/schedule", "Posting Schedule", t("consistency_none_detail", { days: n("days", buffer.days) }))

  // 4 · Real problems
  const openIdeas = db.content_ideas.filter((i) => i.status !== "archived")
  const questionIdeas = new Set(db.audience_questions.map((q) => q.idea_id).filter((id): id is ID => Boolean(id)))
  const fromProblems = openIdeas.filter(
    (i) => i.problem_id || i.source === "problem_bank" || i.source === "question_bank" || questionIdeas.has(i.id)
  ).length
  const problems = openIdeas.length
    ? {
        value: `${pct(fromProblems, openIdeas.length)}%`,
        label: t("problems_label"),
        tone: toneFor(pct(fromProblems, openIdeas.length) * 1.5),
        detail: t("problems_detail", { problems: n("problems", db.audience_problems.length), questions: n("questions", db.audience_questions.length) }),
        href: "/audience/problems",
        hrefLabel: "Problem Bank",
      }
    : none(t("problems_none"), "/audience/problems", "Problem Bank", t("problems_none_detail"))

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
        label: t("winners_label"),
        tone: toneFor(pct(repeated, winners.length)),
        detail: winners.length - repeated ? t("winners_waiting", { winners: n("winners", winners.length - repeated) }) : t("winners_all_followed"),
        href: "/winners",
        hrefLabel: "Winning Content Library",
      }
    : none(t("winners_none"), "/winners", "Winning Content Library", t("winners_none_detail"))

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
        label: t("assets_label"),
        tone: (avg >= 2 ? "good" : avg >= 1.5 ? "warning" : avg >= 1.2 ? "serious" : "critical") as Tone,
        detail: t("assets_detail", { pct: pct(multi, converted), versions: n("versions", repurposedVersions) }),
        href: "/studio",
        hrefLabel: "Repurposing Engine",
      }
    : none(t("assets_none"), "/studio", "Repurposing Engine", t("assets_none_detail"))

  // 7 · Performance influences content
  const rows30 = scopedRows(db, now, { days: 30, settings })
  const measured30 = rows30.filter((r) => r.metric).length
  const lastReview = [...db.weekly_reviews].sort((a, b) => b.week_start.localeCompare(a.week_start))[0]
  const reviewText = lastReview ? t("last_report", { date: format(parseISO(lastReview.week_start), "MMM d") }) : t("no_report")
  const performance = rows30.length
    ? {
        value: `${pct(measured30, rows30.length)}%`,
        label: t("performance_label"),
        tone: toneFor(pct(measured30, rows30.length)),
        detail: reviewText,
        href: "/analytics",
        hrefLabel: "Analytics",
      }
    : none(t("performance_none"), "/analytics", "Analytics", reviewText)

  // 8 · Personal experiences
  const storyIdeas = db.content_ideas.filter(
    (i) => (i.source === "story" || i.source === "experience") && createdIn(i.created_at, last90)
  ).length
  const stories = db.stories.length
  const experiences: PrincipleMetric = {
    value: formatNumber(stories),
    label: t.plural("stories_label", stories),
    tone: stories >= 10 ? "good" : stories >= 5 ? "warning" : stories >= 1 ? "serious" : "critical",
    detail: t("stories_detail", { ideas: n("ideas", storyIdeas) }),
    href: "/stories",
    hrefLabel: "Story Vault",
  }

  // 9 · Positioning over virality
  const rows90 = scopedRows(db, now, { days: 90, settings })
  const activePillars = new Set(db.content_pillars.filter((p) => p.is_active).map((p) => p.id))
  const inPillar = rows90.filter((r) => r.pillarId && activePillars.has(r.pillarId)).length
  const mix = pillarMix(db, now, settings, { lang })
  const positioning = rows90.length
    ? {
        value: `${pct(inPillar, rows90.length)}%`,
        label: t("positioning_label"),
        tone: toneFor(pct(inPillar, rows90.length)),
        detail: mix.warnings.length ? t("positioning_off", { pillars: n("pillars", mix.warnings.length) }) : t("positioning_ok"),
        href: "/pillars",
        hrefLabel: "Content Pillars",
      }
    : none(t("positioning_none"), "/pillars", "Content Pillars", t("positioning_none_detail"))

  // 10 · Recognisable expertise
  const brand = db.brand_profiles[0]
  const hasStatement = Boolean(brand?.positioning_audience.trim() && brand?.positioning_result.trim())
  const expertise: PrincipleMetric = {
    value: `${brandCompleteness}%`,
    label: t("expertise_label"),
    tone: toneFor(brandCompleteness),
    detail: t("expertise_detail", { pillars: n("active_pillars", activePillars.size), state: hasStatement ? t("statement_set") : t("statement_missing") }),
    href: "/strategy",
    hrefLabel: "Brand HQ",
  }

  return [audience, purpose, consistent, problems, winnersMetric, multiAssets, performance, experiences, positioning, expertise]
}
