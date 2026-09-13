/**
 * Pure campaign helpers: calendar window, time progress, pace vs target, defaults.
 * No React and no store access — callers pass `now`.
 */
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns"
import type { StatusTone } from "@/components/common"
import { campaignPerformance, type CampaignPerformance } from "@/lib/analytics"
import { CATEGORICAL_COLORS } from "@/lib/constants"
import { parseDate, toISODate } from "@/lib/dates"
import type { AppSettings, CampaignStatus, CategoricalColor, ContentCampaign, Database, ISODate } from "@/lib/types"
import { clamp, pluralize } from "@/lib/utils"

export type CampaignPhase = "upcoming" | "running" | "ended" | "undated"

export interface CampaignWindow {
  start: Date | null
  end: Date | null
  /** Inclusive length in days. */
  totalDays: number | null
  /** 1-based day of the campaign today (clamped to 0…totalDays). */
  dayIndex: number | null
  /** Share of the window that has elapsed, 0–100. */
  elapsedPct: number | null
  phase: CampaignPhase
  daysToStart: number | null
  /** Days left including today while running. */
  daysLeft: number | null
}

export function campaignWindow(campaign: Pick<ContentCampaign, "start_date" | "end_date">, now: Date): CampaignWindow {
  const start = parseDate(campaign.start_date)
  const end = parseDate(campaign.end_date)
  if (!start || !end) {
    return { start, end, totalDays: null, dayIndex: null, elapsedPct: null, phase: "undated", daysToStart: null, daysLeft: null }
  }
  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1)
  const rawDay = differenceInCalendarDays(now, start) + 1
  const phase: CampaignPhase = rawDay < 1 ? "upcoming" : rawDay > totalDays ? "ended" : "running"
  const dayIndex = clamp(rawDay, 0, totalDays)
  return {
    start,
    end,
    totalDays,
    dayIndex,
    elapsedPct: phase === "upcoming" ? 0 : phase === "ended" ? 100 : (rawDay / totalDays) * 100,
    phase,
    daysToStart: phase === "upcoming" ? 1 - rawDay : null,
    daysLeft: phase === "running" ? totalDays - rawDay + 1 : null,
  }
}

/** "Day 15 of 43 · 29 days left", "Starts in 21 days", "Ended Aug 6". */
export function timeLabel(win: CampaignWindow): string {
  switch (win.phase) {
    case "upcoming":
      return win.daysToStart === 1 ? "Starts tomorrow" : `Starts in ${pluralize(win.daysToStart ?? 0, "day")}`
    case "running":
      return win.daysLeft === 1 ? `Day ${win.dayIndex} of ${win.totalDays} · last day` : `Day ${win.dayIndex} of ${win.totalDays} · ${pluralize(win.daysLeft ?? 0, "day")} left`
    case "ended":
      return win.end ? `Ended ${format(win.end, "MMM d")}` : "Ended"
    default:
      return "No dates set"
  }
}

/** "Aug 28 – Oct 9, 2026"; spans years as "Dec 1, 2026 – Jan 15, 2027". */
export function dateRangeLabel(campaign: Pick<ContentCampaign, "start_date" | "end_date">): string {
  const start = parseDate(campaign.start_date)
  const end = parseDate(campaign.end_date)
  if (!start || !end) return "No dates"
  if (start.getFullYear() !== end.getFullYear()) return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
}

export interface CampaignPace {
  tone: StatusTone
  label: string
  detail: string
  /** Pieces that should be live by today at an even pace (running campaigns only). */
  expected: number | null
}

/** Published pieces vs an even pace toward `target_posts` across the window. */
export function campaignPace(
  status: CampaignStatus,
  published: number,
  target: number | null,
  win: CampaignWindow
): CampaignPace | null {
  if (!target) return null
  const ofTarget = `${published} of ${target} published`
  if (published >= target) return { tone: "good", label: "Target met", detail: ofTarget, expected: null }
  if (status === "paused") return { tone: "warning", label: "Paused", detail: ofTarget, expected: null }
  if (status === "completed" || win.phase === "ended") {
    const pct = (published / target) * 100
    return pct >= 75
      ? { tone: "warning", label: "Short of target", detail: ofTarget, expected: null }
      : { tone: "serious", label: "Missed target", detail: ofTarget, expected: null }
  }
  if (win.phase !== "running" || win.elapsedPct === null) {
    return { tone: "neutral", label: "Not started", detail: `${pluralize(target, "piece")} planned`, expected: null }
  }
  const expected = Math.max(1, Math.round((target * win.elapsedPct) / 100))
  const detail = `${published} published · ${expected} expected by today`
  if (published >= expected * 0.9) return { tone: "good", label: "On pace", detail, expected }
  if (published >= expected * 0.6) return { tone: "warning", label: "Behind pace", detail, expected }
  return { tone: "serious", label: "Well behind pace", detail, expected }
}

/** First categorical colour no other campaign uses (fixed order), else the next in sequence. */
export function nextCampaignColor(campaigns: Pick<ContentCampaign, "color">[]): CategoricalColor {
  const used = new Set(campaigns.map((c) => c.color))
  return CATEGORICAL_COLORS.find((c) => !used.has(c)) ?? CATEGORICAL_COLORS[campaigns.length % CATEGORICAL_COLORS.length]
}

export function defaultCampaignDates(now: Date): { start: ISODate; end: ISODate } {
  const start = startOfDay(now)
  return { start: toISODate(start), end: toISODate(addDays(start, 27)) }
}

export const CAMPAIGN_STATUS_ORDER: Record<CampaignStatus, number> = { active: 0, planning: 1, paused: 2, completed: 3 }

export interface CampaignSummary {
  campaign: ContentCampaign
  perf: CampaignPerformance
  window: CampaignWindow
  pace: CampaignPace | null
}

export function summarizeCampaign(db: Database, campaign: ContentCampaign, now: Date, settings: AppSettings): CampaignSummary | null {
  const perf = campaignPerformance(db, campaign.id, now, settings)
  if (!perf) return null
  const win = campaignWindow(campaign, now)
  return { campaign, perf, window: win, pace: campaignPace(campaign.status, perf.published, perf.targetPosts, win) }
}

/** Active first, then planning, paused, completed; newest start first within a status. */
export function compareCampaigns(a: ContentCampaign, b: ContentCampaign): number {
  return CAMPAIGN_STATUS_ORDER[a.status] - CAMPAIGN_STATUS_ORDER[b.status] || b.start_date.localeCompare(a.start_date)
}
