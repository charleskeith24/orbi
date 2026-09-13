/**
 * AI task registry. Every task: { name, description, input (zod), output (zod), maxTokens,
 * buildPrompt(ctx, input), offline(ctx, input), finalize? }.
 */
import type * as z from "zod"
import { adaptReferenceTask } from "./adapt-reference"
import { analyzeReferenceTask } from "./analyze-reference"
import { captureIdeaTask } from "./capture-idea"
import { contentBriefTask } from "./content-brief"
import { experienceToContentTask } from "./experience-to-content"
import { generateHooksTask } from "./generate-hooks"
import { generateIdeasTask } from "./generate-ideas"
import { generateScriptTask } from "./generate-script"
import { onboardingStrategyTask } from "./onboarding-strategy"
import { repurposeTask } from "./repurpose"
import { monthlyReviewTask, weeklyReviewTask } from "./reviews"
import { scoreContentTask } from "./score-content"
import { scoreIdeaTask } from "./score-idea"
import type { AiTaskDefinition } from "./shared"
import { strategistChatTask } from "./strategist-chat"
import { weeklyPlanTask } from "./weekly-plan"
import { whatToPostTask } from "./what-to-post"
import { winnerReplicationTask } from "./winner-replication"

export const AI_TASKS = {
  capture_idea: captureIdeaTask,
  generate_ideas: generateIdeasTask,
  generate_hooks: generateHooksTask,
  score_idea: scoreIdeaTask,
  content_brief: contentBriefTask,
  generate_script: generateScriptTask,
  score_content: scoreContentTask,
  repurpose: repurposeTask,
  experience_to_content: experienceToContentTask,
  analyze_reference: analyzeReferenceTask,
  adapt_reference: adaptReferenceTask,
  what_to_post: whatToPostTask,
  winner_replication: winnerReplicationTask,
  weekly_review: weeklyReviewTask,
  monthly_review: monthlyReviewTask,
  weekly_plan: weeklyPlanTask,
  strategist_chat: strategistChatTask,
  onboarding_strategy: onboardingStrategyTask,
} as const

export type AiTaskName = keyof typeof AI_TASKS
/** What callers pass (defaults applied on the server). */
export type AiTaskInput<N extends AiTaskName> = z.input<(typeof AI_TASKS)[N]["input"]>
/** What callers get back (validated, ids mapped to real rows). */
export type AiTaskOutput<N extends AiTaskName> = z.output<(typeof AI_TASKS)[N]["output"]>

export const AI_TASK_NAMES = Object.keys(AI_TASKS) as AiTaskName[]

export function isAiTaskName(value: unknown): value is AiTaskName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(AI_TASKS, value)
}

/** The task definition with its generics widened, for the gateway. */
export function getAiTask(name: AiTaskName): AiTaskDefinition {
  return AI_TASKS[name] as AiTaskDefinition
}

export type { AiTaskDefinition } from "./shared"
