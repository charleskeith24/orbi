/**
 * Pure campaign helpers: calendar window, time progress, pace vs target, defaults.
 * No React and no store access — callers pass `now`.
 */
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns"
import type { StatusTone } from "@/components/common"
import { campaignPerformance, type CampaignPerformance } from "@/lib/analytics"
import { CATEGORICAL_COLORS } from "@/lib/constants"
import { parseDate, toISODate } from "@/lib/dates"
import { translator, type UiLang } from "@/lib/i18n/core"
import type { AppSettings, CampaignStatus, CategoricalColor, ContentCampaign, Database, ISODate } from "@/lib/types"
import { clamp, formatNumber } from "@/lib/utils"
import { campaignMessages } from "./messages"

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

/** "Day 15 of 43 · 29 days left", "Starts in 21 days", "Ended Aug 6" — in `lang` (default English). */
export function timeLabel(win: CampaignWindow, lang: UiLang = "en"): string {
  const t = translator(campaignMessages, lang)
  switch (win.phase) {
    case "upcoming": {
      const days = win.daysToStart ?? 0
      return win.daysToStart === 1 ? t("starts_tomorrow") : t.plural("starts_in", days, { count: formatNumber(days) })
    }
    case "running": {
      const days = win.daysLeft ?? 0
      const vars = { day: win.dayIndex ?? "", total: win.totalDays ?? "" }
      return win.daysLeft === 1 ? t("day_last", vars) : t.plural("day_left", days, { ...vars, count: formatNumber(days) })
    }
    case "ended":
      return win.end ? t("ended_on", { date: format(win.end, "MMM d") }) : t("ended")
    default:
      return t("no_dates_set")
  }
}

/** "Aug 28 – Oct 9, 2026"; spans years as "Dec 1, 2026 – Jan 15, 2027". */
export function dateRangeLabel(campaign: Pick<ContentCampaign, "start_date" | "end_date">, lang: UiLang = "en"): string {
  const start = parseDate(campaign.start_date)
  const end = parseDate(campaign.end_date)
  if (!start || !end) return translator(campaignMessages, lang)("no_dates")
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

/** Published pieces vs an even pace toward `target_posts` across the window. Labels are in `lang` (default English). */
export function campaignPace(
  status: CampaignStatus,
  published: number,
  target: number | null,
  win: CampaignWindow,
  lang: UiLang = "en"
): CampaignPace | null {
  if (!target) return null
  const t = translator(campaignMessages, lang)
  const ofTarget = t("pace_published_of", { published, target })
  if (published >= target) return { tone: "good", label: t("pace_target_met"), detail: ofTarget, expected: null }
  if (status === "paused") return { tone: "warning", label: t("pace_paused"), detail: ofTarget, expected: null }
  if (status === "completed" || win.phase === "ended") {
    const pct = (published / target) * 100
    return pct >= 75
      ? { tone: "warning", label: t("pace_short"), detail: ofTarget, expected: null }
      : { tone: "serious", label: t("pace_missed"), detail: ofTarget, expected: null }
  }
  if (win.phase !== "running" || win.elapsedPct === null) {
    return { tone: "neutral", label: t("pace_not_started"), detail: t.plural("pace_pieces_planned", target, { count: formatNumber(target) }), expected: null }
  }
  const expected = Math.max(1, Math.round((target * win.elapsedPct) / 100))
  const detail = t("pace_expected", { published, expected })
  if (published >= expected * 0.9) return { tone: "good", label: t("pace_on"), detail, expected }
  if (published >= expected * 0.6) return { tone: "warning", label: t("pace_behind"), detail, expected }
  return { tone: "serious", label: t("pace_well_behind"), detail, expected }
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

export function summarizeCampaign(db: Database, campaign: ContentCampaign, now: Date, settings: AppSettings, lang: UiLang = "en"): CampaignSummary | null {
  const perf = campaignPerformance(db, campaign.id, now, settings)
  if (!perf) return null
  const win = campaignWindow(campaign, now)
  return { campaign, perf, window: win, pace: campaignPace(campaign.status, perf.published, perf.targetPosts, win, lang) }
}

/** Active first, then planning, paused, completed; newest start first within a status. */
export function compareCampaigns(a: ContentCampaign, b: ContentCampaign): number {
  return CAMPAIGN_STATUS_ORDER[a.status] - CAMPAIGN_STATUS_ORDER[b.status] || b.start_date.localeCompare(a.start_date)
}
