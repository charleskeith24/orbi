/**
 * Client API for AI features. Components call `useAiTask(name)` or `runAiTask(name, input)`;
 * never a provider directly. Server-only code (providers, gateway) is not exported here.
 */
export { providerLabel, runAiTask, trimForLog, type AiRunResult, type RunAiTaskOptions } from "./client"
export { fetchAiStatus, useAiStatus, useAiTask, type AiStatus } from "./use-ai-task"
export { AiError, isAiError, toAiError, type AiErrorCode } from "./errors"
export {
  buildAnalyticsSnapshot,
  buildBrandContext,
  positioningStatement,
  type AnalyticsSnapshot,
  type BrandContext,
  type BuildContextOptions,
} from "./context"
export {
  buildBriefInput,
  buildMonthlyReviewInput,
  buildRepurposeInput,
  buildScoreIdeaInput,
  buildScriptInput,
  buildStrategistInput,
  buildWeeklyPlanInput,
  buildWeeklyReviewInput,
  buildWhatToPostInput,
  buildWinnerReplicationInput,
  summarizeMonthlyReport,
  summarizeWeeklyReport,
} from "./inputs"
export type { AiTaskInput, AiTaskName, AiTaskOutput } from "./tasks"
export type { ExperienceAngleType } from "./tasks/experience-to-content"
export type { GeneratedIdea } from "./tasks/generate-ideas"
export type { MonthlyReportSummary, WeeklyReportSummary } from "./tasks/reviews"
