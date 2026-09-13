import { addDays } from "date-fns"
import type { WeeklyReport } from "@/lib/analytics"
import { toISODate } from "@/lib/dates"
import type { ContentPillar, ID } from "@/lib/types"
import type { PlanStats } from "./planner-actions"
import type { PlanDocument } from "./planner-model"
import { planPillarCounts } from "./weekly-plan-document"

/** The frozen plan snapshot saved on `weekly_reviews.stats.plan` — plain JSON (numbers, strings, ids). */
export function buildPlanStats(input: {
  doc: PlanDocument
  weekKey: string
  weekStart: Date
  target: number
  created: number
  aiDrafted: boolean
  pillars: Map<ID, ContentPillar>
  report: WeeklyReport
}): PlanStats {
  const { doc, report } = input
  const rate = report.totals.engagementRate
  return {
    source: "weekly_planner",
    saved_at: new Date().toISOString(),
    week_start: input.weekKey,
    week_end: toISODate(addDays(input.weekStart, 6)),
    target: input.target,
    planned_posts: doc.posts,
    new_items: input.created,
    slots_total: doc.slotsTotal,
    slots_filled: doc.slotsFilled,
    ai_drafted: input.aiDrafted,
    pillar_mix: [...planPillarCounts(doc).entries()].map(([pillarId, posts]) => {
      const pillar = pillarId ? input.pillars.get(pillarId) : undefined
      return { pillar_id: pillarId, label: pillar?.name ?? "No pillar", posts, target_pct: pillar ? Math.round(pillar.target_percentage) : 0 }
    }),
    previous_week: {
      week_start: report.range.start,
      published: report.published,
      target: report.target,
      views: report.totals.views,
      engagement_rate: rate === null ? null : Math.round(rate * 10) / 10,
      followers: report.totals.followers,
      leads: report.totals.leads,
    },
  }
}
