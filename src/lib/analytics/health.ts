/**
 * Content Health Score (spec §2): six weighted components, each explained in plain language.
 * A component that can't be measured yet scores half its weight and says why.
 */
import { endOfDay, startOfDay, subDays } from "date-fns"
import { HEALTH_BANDS } from "@/lib/constants"
import type { AppSettings, Database } from "@/lib/types"
import { clamp, formatPercent } from "@/lib/utils"
import { aggregateRows } from "./aggregates"
import { MIN_MIX_SAMPLE, pillarMix } from "./balance"
import { consistencyStats } from "./consistency"
import { sharedPerformanceRows } from "./metrics"
import { getWinners, repurposedSourceIds } from "./performance"
import { contentBuffer } from "./pipeline"
import { formatMultiple, inRange, isOverdue, roundTo, timeOf, trailingDays } from "./shared"

export type HealthComponentKey = "consistency" | "balance" | "engagement" | "completion" | "repurposing" | "backlog"
export type HealthTone = "good" | "warning" | "serious" | "critical"

export interface HealthBand {
  label: string
  tone: HealthTone
}

export interface HealthComponent {
  key: HealthComponentKey
  label: string
  /** Points earned (1 decimal), 0 … max. */
  score: number
  max: number
  /** Why it scored what it did, shown verbatim. */
  detail: string
  /** Where to act on it. */
  href: string
}

export interface ContentHealth {
  /** 0–100. */
  score: number
  band: HealthBand
  components: HealthComponent[]
}

/** Weights sum to 100. */
export const HEALTH_COMPONENTS: Record<HealthComponentKey, { label: string; max: number; href: string }> = {
  consistency: { label: "Posting consistency", max: 25, href: "/calendar/planner" },
  balance: { label: "Pillar balance", max: 20, href: "/pillars" },
  engagement: { label: "Engagement trend", max: 15, href: "/analytics" },
  completion: { label: "Content completion", max: 15, href: "/pipeline" },
  repurposing: { label: "Repurposing", max: 10, href: "/winners" },
  backlog: { label: "Content Buffer", max: 15, href: "/pipeline" },
}

/** Pillar drift (Σ|deviation| ÷ 2, in points) at which the balance component reaches 0. */
const BALANCE_ZERO_DRIFT = 50

function component(key: HealthComponentKey, score: number, detail: string): HealthComponent {
  const spec = HEALTH_COMPONENTS[key]
  return { key, label: spec.label, score: roundTo(clamp(score, 0, spec.max)), max: spec.max, detail, href: spec.href }
}

function neutral(key: HealthComponentKey, detail: string): HealthComponent {
  return component(key, HEALTH_COMPONENTS[key].max / 2, detail)
}

/** Band from HEALTH_BANDS: the highest band whose `min` ≤ score. */
export function healthBand(score: number): HealthBand {
  const band = [...HEALTH_BANDS].sort((a, b) => b.min - a.min).find((b) => score >= b.min) ?? HEALTH_BANDS[HEALTH_BANDS.length - 1]
  return { label: band.label, tone: band.tone }
}

/** Engagement points: ≤ 0.6x → 3, 1.0x → 10, ≥ 1.3x → 15, linear in between. */
export function engagementTrendPoints(ratio: number): number {
  if (ratio <= 0.6) return 3
  if (ratio <= 1) return 3 + ((ratio - 0.6) / 0.4) * 7
  if (ratio >= 1.3) return 15
  return 10 + ((ratio - 1) / 0.3) * 5
}

export interface EngagementTrend {
  /** Engagement rate (%) of posts published in the last 30 days. */
  current: number | null
  /** Engagement rate (%) of posts published in the 90 days before that. */
  previous: number | null
  /** current ÷ previous; null unless both windows have ≥ 2 measured posts. */
  ratio: number | null
  currentPosts: number
  previousPosts: number
}

/** Σ engagements ÷ Σ base for posts published in the last 30 days vs days 31–120. */
export function engagementTrend(db: Database, now: Date): EngagementTrend {
  const rows = sharedPerformanceRows(db, now).filter((r) => r.metric)
  const recentRange = trailingDays(now, 30)
  const previousRange = { start: startOfDay(subDays(now, 119)), end: endOfDay(subDays(now, 30)) }
  const recent = rows.filter((r) => inRange(r.publishedAt, recentRange))
  const previous = rows.filter((r) => inRange(r.publishedAt, previousRange))
  const current = aggregateRows(recent).engagementRate
  const prev = aggregateRows(previous).engagementRate
  const enough = recent.length >= 2 && previous.length >= 2
  return {
    current,
    previous: prev,
    ratio: enough && current !== null && prev ? current / prev : null,
    currentPosts: recent.length,
    previousPosts: previous.length,
  }
}

function consistencyComponent(db: Database, now: Date, settings: AppSettings): HealthComponent {
  const stats = consistencyStats(db, now, settings)
  if (!stats.hasHistory) return component("consistency", 0, "No posts published yet — consistency starts with your first post")
  if (stats.score === null) return neutral("consistency", "First week of publishing — no completed week to judge yet")
  return component(
    "consistency",
    (stats.score / 100) * HEALTH_COMPONENTS.consistency.max,
    `${stats.weeksConsistent} of the last ${stats.weeksCounted} ${stats.weeksCounted === 1 ? "week" : "weeks"} reached 80% of your ${settings.weekly_post_target}-post target`
  )
}

function balanceComponent(db: Database, now: Date, settings: AppSettings): HealthComponent {
  const mix = pillarMix(db, now, settings)
  if (!mix.rows.length) return neutral("balance", "No active pillars yet — define pillars to track balance")
  if (mix.total < MIN_MIX_SAMPLE) {
    return neutral("balance", `Only ${mix.total} ${mix.total === 1 ? "post" : "posts"} with a pillar in the last 30 days — not enough to judge balance`)
  }
  const drift = mix.rows.reduce((acc, r) => acc + Math.abs(r.deviation), 0) / 2
  const score = HEALTH_COMPONENTS.balance.max * clamp(1 - drift / BALANCE_ZERO_DRIFT, 0, 1)
  const [first, ...rest] = mix.warnings
  const detail = first
    ? `${first.message}${rest.length ? ` (+${rest.length} more)` : ""}`
    : `All ${mix.rows.length} pillars within target range over the last 30 days`
  return component("balance", score, detail)
}

function engagementComponent(db: Database, now: Date): HealthComponent {
  const trend = engagementTrend(db, now)
  if (trend.ratio === null) {
    return neutral("engagement", "Not enough measured posts to compare (needs 2+ in the last 30 days and in the 90 days before)")
  }
  return component(
    "engagement",
    engagementTrendPoints(trend.ratio),
    `Last 30 days: ${formatPercent(trend.current)} engagement vs ${formatPercent(trend.previous)} in the 90 days before (${formatMultiple(trend.ratio)})`
  )
}

function completionComponent(db: Database, now: Date): HealthComponent {
  const from = startOfDay(subDays(now, 13)).getTime()
  const to = endOfDay(now).getTime()
  const due = db.content_items.filter((i) => {
    const d = timeOf(i, "due_date")
    return d >= from && d <= to
  })
  if (!due.length) return neutral("completion", "No production deadlines in the last 14 days")
  const todayStart = startOfDay(now)
  const late = due.filter((i) => isOverdue(i, now, todayStart)).length
  return component(
    "completion",
    (HEALTH_COMPONENTS.completion.max * (due.length - late)) / due.length,
    late
      ? `${late} of ${due.length} items due in the last 14 days ${late === 1 ? "is" : "are"} overdue`
      : `All ${due.length} ${due.length === 1 ? "item" : "items"} due in the last 14 days ${due.length === 1 ? "is" : "are"} on track`
  )
}

function repurposingComponent(db: Database, now: Date, settings: AppSettings): HealthComponent {
  const winners = getWinners(db, settings, now, { days: 60 })
  if (!winners.length) return neutral("repurposing", "No winners in the last 60 days yet — nothing to repurpose")
  const repurposed = repurposedSourceIds(db)
  const done = winners.filter((w) => repurposed.has(w.id)).length
  return component(
    "repurposing",
    (HEALTH_COMPONENTS.repurposing.max * done) / winners.length,
    `${done} of ${winners.length} ${winners.length === 1 ? "winner" : "winners"} from the last 60 days repurposed`
  )
}

function backlogComponent(db: Database, now: Date, settings: AppSettings): HealthComponent {
  const buffer = contentBuffer(db, now, settings)
  const healthy = settings.buffer_healthy_days
  const score = healthy > 0 ? HEALTH_COMPONENTS.backlog.max * clamp(buffer.days / healthy, 0, 1) : HEALTH_COMPONENTS.backlog.max
  const detail = buffer.readyCount
    ? `${buffer.days} days of ready content vs a ${healthy}-day target (${buffer.readyCount} ready to publish)`
    : `Nothing is ready to post — target is ${healthy} days of content`
  return component("backlog", score, detail)
}

/**
 * 0–100 = consistency 25 (consistencyScore) + pillar balance 20 (1 − drift ÷ 50) + engagement 15
 * (30-day vs prior-90-day rate) + completion 15 (on-track share of items due in 14 days) + repurposing 10
 * (repurposed share of 60-day winners) + backlog 15 (buffer days ÷ healthy days).
 */
export function contentHealthScore(db: Database, now: Date, settings: AppSettings): ContentHealth {
  const components = [
    consistencyComponent(db, now, settings),
    balanceComponent(db, now, settings),
    engagementComponent(db, now),
    completionComponent(db, now),
    repurposingComponent(db, now, settings),
    backlogComponent(db, now, settings),
  ]
  const score = clamp(Math.round(components.reduce((acc, c) => acc + c.score, 0)), 0, 100)
  return { score, band: healthBand(score), components }
}
