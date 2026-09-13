/**
 * Content Strategist conversation model. Every answered question is one `ai_generations` row
 * (task "strategist_chat"). runAiTask logs a size-trimmed copy of the request; once the answer
 * arrives the session rewrites that row with a lossless record — the question, the context the
 * answer considered and the full output — so the conversation survives reloads and syncs like any
 * other workspace data.
 */
import { PLATFORM_IDS } from "@/lib/constants"
import type { AiGeneration, AiProviderId, ID, PlatformId } from "@/lib/types"

export const STRATEGIST_TASK = "strategist_chat"
/** Longest question the composer accepts (the task allows 8,000 characters per message). */
export const MAX_QUESTION_CHARS = 4000
/** Earlier turns sent as history with each question (the task accepts up to 40 messages). */
export const HISTORY_TURNS = 8
const MAX_HISTORY_CHARS = 4000

export type ContextKey =
  | "positioning"
  | "audience"
  | "goal"
  | "platform"
  | "pillar"
  | "funnel"
  | "performance"
  | "content"
  | "problems"
  | "winners"

export const CONTEXT_KEYS: ContextKey[] = [
  "positioning",
  "audience",
  "goal",
  "platform",
  "pillar",
  "funnel",
  "performance",
  "content",
  "problems",
  "winners",
]

/** One piece of workspace context an answer was grounded in (spec §57). */
export interface ContextChip {
  key: ContextKey
  /** Short chip text, e.g. "Goal · Generate leads". */
  label: string
  /** The specifics, e.g. "Target: 40 leads per month". */
  detail: string
  /** Pillar chips: the pillar, so the dot follows its current colour. */
  pillar_id?: ID | null
  /** Platform chips: the platform glyph to show. */
  platform?: PlatformId | null
}

export interface SuggestedIdea {
  title: string
  hook: string
  pillar_id: ID | null
  platform: PlatformId
  format: string
}

/** What the session stores in `ai_generations.input` for an answered question. */
export interface StoredTurnInput {
  kind: "strategist_turn"
  version: 1
  question: string
  context: ContextChip[]
  /** Suggested-idea index → Idea Bank id, once saved. */
  saved: Record<string, ID>
}

export interface StrategistTurn {
  id: ID
  question: string
  reply: string
  ideas: SuggestedIdea[]
  followUps: string[]
  context: ContextChip[]
  saved: Record<string, ID>
  provider: AiProviderId
  model: string
  createdAt: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string => (typeof value === "string" ? value : "")

export function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value
}

/**
 * The question a log row answered. Rows the session rewrote carry it verbatim; for a raw log row
 * the last message is trusted only when the logged history wasn't cut short (it must end with the user).
 */
function questionOf(input: unknown): string {
  if (!isRecord(input)) return ""
  if (typeof input.question === "string") return input.question
  const messages = Array.isArray(input.messages) ? input.messages : []
  const last: unknown = messages[messages.length - 1]
  return isRecord(last) && last.role === "user" ? text(last.content) : ""
}

function parseIdea(value: unknown): SuggestedIdea[] {
  if (!isRecord(value)) return []
  const title = text(value.title).trim()
  if (!title) return []
  return [
    {
      title,
      hook: text(value.hook).trim(),
      pillar_id: text(value.pillar_id) || null,
      platform: PLATFORM_IDS.find((id) => id === value.platform) ?? "facebook",
      format: text(value.format).trim(),
    },
  ]
}

/** Suggested ideas from a strategist output (invalid entries dropped). */
export function parseIdeas(value: unknown): SuggestedIdea[] {
  return Array.isArray(value) ? value.flatMap(parseIdea) : []
}

function parseChip(value: unknown): ContextChip[] {
  if (!isRecord(value)) return []
  const key = CONTEXT_KEYS.find((k) => k === value.key)
  const label = text(value.label).trim()
  if (!key || !label) return []
  return [
    {
      key,
      label,
      detail: text(value.detail),
      pillar_id: text(value.pillar_id) || null,
      platform: PLATFORM_IDS.find((id) => id === value.platform) ?? null,
    },
  ]
}

function savedOf(input: unknown): Record<string, ID> {
  const saved = isRecord(input) && isRecord(input.saved) ? input.saved : {}
  return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
}

/** Answered questions, oldest first. Failed calls and other tasks are skipped. */
export function parseTurns(rows: AiGeneration[]): StrategistTurn[] {
  const turns: { turn: StrategistTurn; index: number }[] = []
  rows.forEach((row, index) => {
    const output = row.output
    if (row.task !== STRATEGIST_TASK || row.status !== "success" || !isRecord(output)) return
    const reply = text(output.reply).trim()
    if (!reply) return
    const input = row.input
    turns.push({
      index,
      turn: {
        id: row.id,
        question: questionOf(input).trim(),
        reply,
        ideas: parseIdeas(output.suggested_ideas),
        followUps: Array.isArray(output.follow_up_questions)
          ? output.follow_up_questions.map((q) => text(q).trim()).filter(Boolean)
          : [],
        context: isRecord(input) && Array.isArray(input.context) ? input.context.flatMap(parseChip) : [],
        saved: savedOf(input),
        provider: row.provider,
        model: row.model,
        createdAt: row.created_at,
      },
    })
  })
  return turns
    .sort((a, b) => a.turn.createdAt.localeCompare(b.turn.createdAt) || a.index - b.index)
    .map((entry) => entry.turn)
}

/**
 * Hides log rows that belong to the question still in flight — runAiTask logs them a moment before
 * the session rewrites them — so a turn never shows twice.
 */
export function settledTurns(turns: StrategistTurn[], pendingSince: string | null): StrategistTurn[] {
  return pendingSince ? turns.filter((turn) => turn.createdAt < pendingSince) : turns
}

/** The newest HISTORY_TURNS turns as chat history, then the new question. */
export function historyMessages(turns: StrategistTurn[], question: string): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const turn of turns.slice(-HISTORY_TURNS)) {
    if (!turn.question || !turn.reply) continue
    messages.push(
      { role: "user", content: clip(turn.question, MAX_HISTORY_CHARS) },
      { role: "assistant", content: clip(turn.reply, MAX_HISTORY_CHARS) }
    )
  }
  messages.push({ role: "user", content: clip(question.trim(), MAX_QUESTION_CHARS) })
  return messages
}

export function storedTurnInput(question: string, context: ContextChip[]): StoredTurnInput {
  return { kind: "strategist_turn", version: 1, question, context, saved: {} }
}

/** The row's input with Idea Bank ids recorded for saved suggestions (other fields kept). */
export function withSavedIdeas(input: unknown, saved: Record<string, ID>): Record<string, unknown> {
  const base = isRecord(input) ? input : {}
  return { ...base, saved: { ...savedOf(input), ...saved } }
}
