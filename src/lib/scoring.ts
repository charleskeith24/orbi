import { IDEA_SCORE_DIMENSIONS, IDEA_SCORE_THRESHOLDS, QUALITY_DIMENSIONS, QUALITY_RATINGS } from "@/lib/constants"
import type { ContentQualityScore, IdeaScores, Priority, QualityRating } from "@/lib/types"
import { clamp } from "@/lib/utils"

/** Weighted Idea Score 0–100 from seven 1–10 dimensions (spec §39). */
export function computeIdeaScore(scores: IdeaScores): number {
  let total = 0
  for (const d of IDEA_SCORE_DIMENSIONS) total += clamp(scores[d.key] ?? 0, 0, 10) * d.weight
  return Math.round(total * 10)
}

export function priorityFromScore(score: number | null | undefined): Priority {
  if (score === null || score === undefined) return "medium"
  if (score >= IDEA_SCORE_THRESHOLDS.high) return "high"
  if (score >= IDEA_SCORE_THRESHOLDS.medium) return "medium"
  return "low"
}

export const NEUTRAL_IDEA_SCORES: IdeaScores = {
  audience_relevance: 5,
  authority_potential: 5,
  business_alignment: 5,
  timeliness: 5,
  originality: 5,
  repurposing_potential: 5,
  ease_of_production: 5,
}

/** Raw sub-scores (max 110) normalised to 0–100. */
export function qualityTotal(parts: Pick<ContentQualityScore, "hook" | "relevance" | "value" | "clarity" | "authenticity" | "cta">): number {
  const max = QUALITY_DIMENSIONS.reduce((acc, d) => acc + d.max, 0)
  const raw = QUALITY_DIMENSIONS.reduce((acc, d) => acc + clamp(parts[d.key], 0, d.max), 0)
  return Math.round((raw / max) * 100)
}

export function qualityRating(total: number): QualityRating {
  if (total >= QUALITY_RATINGS.high_potential.min) return "high_potential"
  if (total >= QUALITY_RATINGS.solid.min) return "solid"
  if (total >= QUALITY_RATINGS.needs_work.min) return "needs_work"
  return "weak"
}
