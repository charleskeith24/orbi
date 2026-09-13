import {
  contentBuffer,
  contentHealthScore,
  getWinners,
  pillarPerformance,
  weeklyPostingProgress,
  type ContentBuffer,
  type ContentHealth,
  type WeeklyProgress,
} from "@/lib/analytics"
import { positioningStatement } from "@/lib/ai"
import type { AppSettings, Database, ID, PlatformId, Row } from "@/lib/types"

export interface StrategistKnowledge {
  owner: string
  brandName: string
  role: string
  positioning: string
  persona: Row<"audience_personas"> | null
  goal: Row<"content_goals"> | null
  pillarCount: number
  platforms: PlatformId[]
  problemCount: number
  questionCount: number
  health: ContentHealth
  buffer: ContentBuffer
  week: WeeklyProgress
  /** Best pillar by average ratio to platform baseline (90 days, 3+ measured posts). */
  topPillar: { pillar: Row<"content_pillars">; posts: number; avgViews: number | null; ratio: number | null } | null
  winnerCount: number
  bestWinner: { id: ID; title: string; ratio: number | null } | null
}

/** The strategist's context, summarised for the "What the strategist knows" column. Pure over (db, now, settings). */
export function strategistKnowledge(db: Database, now: Date, settings: AppSettings): StrategistKnowledge {
  const brand = db.brand_profiles[0]
  const persona = db.audience_personas.find((p) => p.is_primary) ?? db.audience_personas[0] ?? null
  const goal = (brand?.primary_goal_id ? db.content_goals.find((g) => g.id === brand.primary_goal_id) : undefined) ?? null
  const strategies = db.content_platforms.filter((p) => p.is_active).map((p) => p.platform)
  const top = pillarPerformance(db, now, { days: 90, settings })
    .filter((g) => g.pillar && g.measured >= 3)
    .sort((a, b) => (b.avgRatio ?? 0) - (a.avgRatio ?? 0) || (b.avgViews ?? 0) - (a.avgViews ?? 0))[0]
  const winners = getWinners(db, settings, now, { days: 90 })
  const best = [...winners].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0]

  return {
    owner: brand?.name ?? "",
    brandName: brand?.brand_name ?? "",
    role: brand?.role ?? "",
    positioning: brand
      ? positioningStatement(brand.positioning_audience, brand.positioning_result, brand.positioning_method) || brand.known_for
      : "",
    persona,
    goal,
    pillarCount: db.content_pillars.filter((p) => p.is_active).length,
    platforms: strategies.length ? strategies : (brand?.main_platforms ?? []),
    problemCount: db.audience_problems.length,
    questionCount: db.audience_questions.filter((q) => q.status !== "dismissed").length,
    health: contentHealthScore(db, now, settings),
    buffer: contentBuffer(db, now, settings),
    week: weeklyPostingProgress(db, now, settings),
    topPillar: top?.pillar ? { pillar: top.pillar, posts: top.measured, avgViews: top.avgViews, ratio: top.avgRatio } : null,
    winnerCount: winners.length,
    bestWinner: best ? { id: best.id, title: best.item.title, ratio: best.ratio } : null,
  }
}
