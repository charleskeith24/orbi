/**
 * Analytics engine — pure functions of (db, now, settings). No React, no store access;
 * callers pass `new Date()` as `now` and memoise results with `useMemo`.
 * Returned arrays are fresh copies; treat the db as immutable (store semantics).
 */
export {
  RATE_KEYS,
  computeRates,
  engagementsOf,
  isRateKey,
  itemPerformanceRows,
  latestMetricsByItem,
  metricValue,
  rateBase,
  toPerformanceRow,
  type MetricCounts,
  type MetricRates,
  type PerformanceRow,
} from "./metrics"
export {
  NO_TIER,
  compositeBaselines,
  computeTiers,
  getWinners,
  isWinnerTier,
  performanceValue,
  repurposedSourceIds,
  tierForRatio,
  tieredRows,
  tiersForRows,
  topPerformers,
  type CompositeBaselines,
  type TierInfo,
  type TieredRow,
  type TopPerformerOptions,
  type TopPerformerSort,
} from "./performance"
export * from "./aggregates"
export * from "./pipeline"
export * from "./consistency"
export * from "./balance"
export * from "./health"
export * from "./goals"
export * from "./experiments"
export * from "./reports"
export * from "./collabs"
export {
  RECOMMENDATION_WEIGHTS,
  recommendNextContent,
  strategicInsights,
  type ContentRecommendation,
  type InsightType,
  type RecommendationFactor,
  type RecommendationReasons,
  type RecommendOptions,
  type StrategicInsight,
} from "./recommendations"
export {
  NO_KEY,
  formatMultiple,
  inRange,
  isOverdue,
  isPublishedItem,
  publishedAtOf,
  resolveRange,
  trailingDays,
  type DateRange,
  type ISORange,
  type RangeOptions,
} from "./shared"
