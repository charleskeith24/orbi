/**
 * Input builders: turn workspace data into the compact, serialisable inputs the data-heavy tasks
 * expect (reports, recommendations, winners, scripts). Pure over (db, now) — safe in client code.
 */
import { addDays, format as formatDate } from "date-fns"
import {
  contentBuffer,
  monthlyReport,
  recommendNextContent,
  tieredRows,
  topPerformers,
  weeklyPostingProgress,
  weeklyReport,
  type GroupAggregate,
  type MonthlyReport,
  type ReportHighlight,
  type TieredRow,
  type WeeklyReport,
} from "@/lib/analytics"
import { DAYS_OF_WEEK, PLATFORMS } from "@/lib/constants"
import { buildRow } from "@/lib/data/defaults"
import { parseDate, startOfWeek, toISODate } from "@/lib/dates"
import type { ContentIdea, Database, ID, PlatformId, RepurposeType, ScriptFormat } from "@/lib/types"
import { buildAnalyticsSnapshot } from "./context"
import type { AiTaskInput } from "./tasks"
import type { MonthlyReportSummary, WeeklyReportSummary } from "./tasks/reviews"

const settingsOf = (db: Database, now: Date) => db.app_settings[0] ?? buildRow("app_settings", {}, "", now)
const round = (n: number | null | undefined, digits = 2) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10 ** digits) / 10 ** digits)

function postOf(row: TieredRow | null, db: Database) {
  if (!row) return null
  return {
    title: row.item.title,
    platform: PLATFORMS[row.platform]?.label ?? row.platform,
    views: row.views,
    ratio: round(row.ratio),
    engagement_rate: round(row.rates.engagement_rate),
    hook: row.item.hook,
    pillar: db.content_pillars.find((p) => p.id === row.pillarId)?.name ?? "",
    tier: row.tier,
  }
}

function highlightOf(h: ReportHighlight | null) {
  return h ? { label: h.label, value: round(h.value) ?? 0, metric_label: h.metricLabel, posts: h.posts } : null
}

function groupOf(g: GroupAggregate & { label: string }) {
  return { label: g.label, posts: g.posts, avg_views: round(g.avgViews, 0), engagement_rate: round(g.engagementRate), leads: g.leads, winners: g.winners }
}

function totalsOf(t: WeeklyReport["totals"]) {
  return {
    posts: t.posts,
    views: t.views,
    reach: t.reach,
    engagements: t.engagements,
    engagement_rate: round(t.engagementRate),
    leads: t.leads,
    sales: t.sales,
    followers: t.followers,
    saves: t.saves,
    shares: t.shares,
    comments: t.comments,
  }
}

function deltasOf(d: WeeklyReport["deltas"]) {
  return { posts: round(d.posts, 0), views: round(d.views, 0), engagements: round(d.engagements, 0), engagement_rate: round(d.engagementRate, 0), leads: round(d.leads, 0), followers: round(d.followers, 0) }
}

/** Compact weekly report for the weekly_review task. */
export function summarizeWeeklyReport(report: WeeklyReport, db: Database, now: Date): WeeklyReportSummary {
  return {
    week_start: report.range.start,
    week_end: report.range.end,
    in_progress: toISODate(now) <= report.range.end,
    published: report.published,
    target: report.target,
    consistency_pct: Math.round(report.consistencyPct),
    totals: totalsOf(report.totals),
    deltas: deltasOf(report.deltas),
    best_post: postOf(report.bestPost, db),
    worst_post: postOf(report.worstPost, db),
    best_platform: highlightOf(report.bestPlatform),
    best_pillar: highlightOf(report.bestPillar),
    best_topic: highlightOf(report.bestTopic),
    best_format: highlightOf(report.bestFormat),
    best_hook: highlightOf(report.bestHook),
    pillar_mix: report.contentMix.pillars.rows.map((r) => ({ label: r.label, actual_pct: r.actualPct, target_pct: r.targetPct })),
    mix_warnings: [...report.contentMix.pillars.warnings, ...report.contentMix.funnel.warnings].map((w) => w.message),
    top_posts: report.topPosts.slice(0, 5).map((r) => postOf(r, db)!),
    winners: report.winners,
    ranked_by: report.rankedBy,
  }
}

/** Compact monthly report for the monthly_review task. */
export function summarizeMonthlyReport(report: MonthlyReport, db: Database, now: Date): MonthlyReportSummary {
  const start = parseDate(report.range.start) ?? now
  return {
    month: formatDate(start, "MMMM yyyy"),
    in_progress: toISODate(now) <= report.range.end,
    totals: totalsOf(report.totals),
    deltas: deltasOf(report.deltas),
    audience_growth: { total: report.audienceGrowth.total, by_platform: report.audienceGrowth.byPlatform.map((p) => ({ label: p.label, followers_gained: p.followersGained })) },
    total_reach: report.totalReach,
    total_content: report.totalContent,
    best_content: postOf(report.bestContent, db),
    top_posts: report.top10.slice(0, 5).map((r) => postOf(r, db)!),
    platforms: report.platformPerformance.filter((g) => g.posts > 0).map(groupOf),
    pillars: report.pillarPerformance.filter((g) => g.posts > 0).map(groupOf),
    formats: report.formatPerformance.filter((g) => g.posts > 0).map(groupOf).slice(0, 15),
    topics: report.topicPerformance.filter((g) => g.posts > 0).map(groupOf).slice(0, 10),
    leads: {
      total: report.leadGeneration.total,
      by_pillar: report.leadGeneration.byPillar.map((l) => ({ label: l.label, leads: l.leads, sales: l.sales })),
      by_platform: report.leadGeneration.byPlatform.map((l) => ({ label: l.label, leads: l.leads, sales: l.sales })),
    },
    business: {
      posts: report.businessOpportunities.posts,
      leads: report.businessOpportunities.leads,
      sales: report.businessOpportunities.sales,
      link_clicks: report.businessOpportunities.linkClicks,
    },
    consistency: { weeks_total: report.consistency.weeksTotal, weeks_hit: report.consistency.weeksHit, weeks_consistent: report.consistency.weeksConsistent },
    winners: report.winners,
    ranked_by: report.rankedBy,
  }
}

export function buildWeeklyReviewInput(db: Database, weekStart: Date, now: Date, focus = ""): AiTaskInput<"weekly_review"> {
  const settings = settingsOf(db, now)
  return { report: summarizeWeeklyReport(weeklyReport(db, weekStart, settings, now), db, now), focus }
}

export function buildMonthlyReviewInput(db: Database, monthStart: Date, now: Date): AiTaskInput<"monthly_review"> {
  const settings = settingsOf(db, now)
  return { report: summarizeMonthlyReport(monthlyReport(db, monthStart, settings, now), db, now) }
}

export function buildStrategistInput(db: Database, now: Date, messages: { role: "user" | "assistant"; content: string }[]): AiTaskInput<"strategist_chat"> {
  return { messages, snapshot: buildAnalyticsSnapshot(db, now) }
}

const formatName = (db: Database, id: ID | null) => (id ? (db.content_formats.find((f) => f.id === id)?.name ?? "") : "")
const angleName = (db: Database, id: ID | null) => (id ? (db.angles.find((a) => a.id === id)?.name ?? "") : "")

/** Decision-engine candidates + today's context for what_to_post. */
export function buildWhatToPostInput(db: Database, now: Date, options: { platform?: PlatformId } = {}): AiTaskInput<"what_to_post"> {
  const settings = settingsOf(db, now)
  const recs = recommendNextContent(db, now, settings, { limit: 6, platform: options.platform })
  const week = weeklyPostingProgress(db, now, settings)
  return {
    candidates: recs.map((r) => ({
      kind: r.kind,
      id: r.id,
      title: r.title,
      pillar_id: r.pillarId,
      platform: r.platform,
      format: formatName(db, r.formatId),
      angle: angleName(db, r.angleId),
      hook: r.hook,
      cta: r.cta,
      score: r.score,
      reasons: r.reasons,
      signals: r.signals.slice(0, 6),
    })),
    today: {
      date: toISODate(now),
      weekday: DAYS_OF_WEEK[now.getDay()]?.label ?? "",
      slots: db.content_calendar.filter((s) => s.is_active && s.day_of_week === now.getDay()).map((s) => s.label).filter(Boolean),
      buffer_days: contentBuffer(db, now, settings).days,
      published_this_week: week.published,
      weekly_target: week.target,
    },
  }
}

/** Slots, candidates, top performers and what's already scheduled for the week starting `weekStart` (default: next week). */
export function buildWeeklyPlanInput(db: Database, now: Date, options: { weekStart?: Date; focus?: string } = {}): AiTaskInput<"weekly_plan"> {
  const settings = settingsOf(db, now)
  const weekStart = startOfWeek(options.weekStart ?? addDays(now, 7), settings.week_starts_on)
  const weekEnd = addDays(weekStart, 7)
  const dateFor = (dayOfWeek: number) => toISODate(addDays(weekStart, (dayOfWeek - settings.week_starts_on + 7) % 7))
  const recs = recommendNextContent(db, now, settings, { limit: 20 })
  return {
    week_start: toISODate(weekStart),
    focus: options.focus ?? "",
    target: settings.weekly_post_target,
    slots: db.content_calendar
      .filter((s) => s.is_active)
      .map((s) => ({
        date: dateFor(s.day_of_week),
        day: DAYS_OF_WEEK[s.day_of_week]?.label ?? "",
        label: s.label,
        pillar_id: s.pillar_id,
        format: formatName(db, s.format_id),
        platforms: s.platforms,
        time: s.time,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    candidates: recs.map((r) => ({ kind: r.kind, id: r.id, title: r.title, pillar_id: r.pillarId, platform: r.platform, format: formatName(db, r.formatId), hook: r.hook, score: r.score, reason: r.reasons.topic })),
    top_performers: topPerformers(db, settings, now, { days: 30, limit: 5 }).map((r) => ({ title: r.item.title, platform: r.platform, views: r.views, ratio: round(r.ratio), pillar_id: r.pillarId, hook: r.item.hook })),
    already_scheduled: db.content_items
      .filter((i) => !i.published_at && i.scheduled_at)
      .map((i) => ({ i, at: parseDate(i.scheduled_at) }))
      .filter(({ at }) => at && at >= weekStart && at < weekEnd)
      .map(({ i, at }) => ({ date: toISODate(at!), title: i.title, platform: i.platform })),
  }
}

function currentScriptBody(db: Database, itemId: ID): string {
  const script = db.content_scripts
    .filter((s) => s.content_item_id === itemId && s.is_current)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
  return script ? script.body || script.sections.map((s) => s.content).filter(Boolean).join("\n\n") : ""
}

/** Winner + latest metrics + tier for winner_replication (null when the item isn't published/measured). */
export function buildWinnerReplicationInput(db: Database, itemId: ID, now: Date): AiTaskInput<"winner_replication"> | null {
  const settings = settingsOf(db, now)
  const row = tieredRows(db, settings, now).find((r) => r.id === itemId)
  if (!row) return null
  const m = row.metric
  return {
    item: {
      title: row.item.title,
      hook: row.item.hook,
      hook_category: row.hookCategory,
      platform: row.platform,
      format: formatName(db, row.formatId),
      angle: angleName(db, row.angleId),
      pillar_id: row.pillarId,
      funnel_stage: row.funnelStage,
      body: currentScriptBody(db, itemId).slice(0, 8000),
      why_it_worked: row.item.why_it_worked,
    },
    metrics: m
      ? {
          views: m.views,
          reach: m.reach,
          likes: m.likes,
          comments: m.comments,
          shares: m.shares,
          saves: m.saves,
          followers_gained: m.followers_gained,
          leads: m.leads,
          engagement_rate: round(row.rates.engagement_rate),
          save_rate: round(row.rates.save_rate),
          share_rate: round(row.rates.share_rate),
        }
      : {},
    tier: row.tier,
    ratio: round(row.ratio),
    baseline_views: settings.winner_metric === "views" ? round(row.baseline, 0) : null,
  }
}

/** Source item + current script for repurpose. */
export function buildRepurposeInput(db: Database, itemId: ID, targets: RepurposeType[], now: Date = new Date()): AiTaskInput<"repurpose"> | null {
  const item = db.content_items.find((i) => i.id === itemId)
  if (!item) return null
  const row = tieredRows(db, settingsOf(db, now), now).find((r) => r.id === itemId)
  return {
    source: {
      title: item.title,
      platform: item.platform,
      format: formatName(db, item.format_id),
      hook: item.hook,
      body: currentScriptBody(db, itemId).slice(0, 12000),
      pillar_id: item.pillar_id,
      funnel_stage: item.funnel_stage,
      performance: row?.metric ? `${row.views.toLocaleString("en-US")} views${row.ratio ? `, ${row.ratio.toFixed(1)}× baseline` : ""}` : "",
    },
    targets,
  }
}

/** Item + brief for generate_script. */
export function buildScriptInput(db: Database, itemId: ID, format: ScriptFormat, storyIds: ID[] = []): AiTaskInput<"generate_script"> | null {
  const item = db.content_items.find((i) => i.id === itemId)
  if (!item) return null
  const brief = db.content_briefs.find((b) => b.content_item_id === itemId)
  const idea = item.idea_id ? db.content_ideas.find((i) => i.id === item.idea_id) : undefined
  return {
    format,
    title: item.title,
    platform: item.platform,
    hook: item.hook,
    description: idea?.description ?? "",
    brief: brief
      ? {
          objective: brief.objective,
          main_message: brief.main_message,
          supporting_points: brief.supporting_points,
          cta: brief.cta,
          visual_direction: brief.visual_direction,
          caption: brief.caption,
          production_notes: brief.production_notes,
        }
      : {},
    pillar_id: item.pillar_id,
    persona_id: item.persona_id,
    problem_id: item.problem_id,
    funnel_stage: item.funnel_stage,
    story_ids: storyIds,
    notes: item.notes,
    talking_points: idea?.talking_points ?? [],
    current_script: currentScriptBody(db, itemId).slice(0, 12000),
  }
}

/** Item (+ its idea) for content_brief. */
export function buildBriefInput(db: Database, itemId: ID): AiTaskInput<"content_brief"> | null {
  const item = db.content_items.find((i) => i.id === itemId)
  if (!item) return null
  const idea = item.idea_id ? db.content_ideas.find((i) => i.id === item.idea_id) : undefined
  return {
    title: item.title,
    platform: item.platform,
    format: formatName(db, item.format_id),
    hook: item.hook,
    description: idea?.description ?? "",
    why_it_matters: idea?.why_it_matters ?? "",
    talking_points: idea?.talking_points ?? [],
    cta: idea?.cta ?? "",
    angle: angleName(db, item.angle_id),
    pillar_id: item.pillar_id,
    persona_id: item.persona_id,
    problem_id: item.problem_id,
    goal_id: item.goal_id,
    funnel_stage: item.funnel_stage,
    notes: item.notes,
    current_script: currentScriptBody(db, itemId).slice(0, 12000),
  }
}

/** An Idea Bank row for score_idea. */
export function buildScoreIdeaInput(db: Database, idea: ContentIdea): AiTaskInput<"score_idea"> {
  return {
    title: idea.title,
    description: idea.description,
    core_topic: idea.core_topic,
    hook: idea.hook,
    angle: angleName(db, idea.angle_id),
    talking_points: idea.talking_points,
    pillar_id: idea.pillar_id,
    persona_id: idea.persona_id,
    problem_id: idea.problem_id,
    format: formatName(db, idea.format_id),
    platforms: idea.platforms,
    funnel_stage: idea.funnel_stage,
  }
}
