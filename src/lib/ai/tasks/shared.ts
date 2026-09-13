/**
 * Building blocks shared by every AI task: enum schemas that work with Anthropic structured
 * outputs, the task definition contract and post-parse helpers (id validation, clamping,
 * script-section normalisation).
 */
import * as z from "zod"
import {
  FUNNEL_STAGE_IDS,
  GOAL_CATEGORY_IDS,
  HOOK_CATEGORY_IDS,
  PLATFORM_IDS,
  REPURPOSE_TYPE_IDS,
  SCRIPT_FORMAT_IDS,
  SCRIPT_FORMATS,
} from "@/lib/constants"
import type {
  FunnelStage,
  GoalCategory,
  HookCategory,
  PlatformId,
  RepurposeType,
  ScriptFormat,
  ScriptSection,
} from "@/lib/types"
import type { BrandContext } from "../context"

/* ---------------------------------- Enums ---------------------------------- */

export const platformSchema = z.enum(PLATFORM_IDS as [PlatformId, ...PlatformId[]])
export const funnelSchema = z.enum(FUNNEL_STAGE_IDS as [FunnelStage, ...FunnelStage[]])
export const hookCategorySchema = z.enum(HOOK_CATEGORY_IDS as [HookCategory, ...HookCategory[]])
export const goalCategorySchema = z.enum(GOAL_CATEGORY_IDS as [GoalCategory, ...GoalCategory[]])
export const scriptFormatSchema = z.enum(SCRIPT_FORMAT_IDS as [ScriptFormat, ...ScriptFormat[]])
export const repurposeTypeSchema = z.enum(REPURPOSE_TYPE_IDS as [RepurposeType, ...RepurposeType[]])

/** Output id field: a short ref from the Brand Context (e.g. "P2"), mapped back to the real id after parsing. */
export const contextRefSchema = (what: string, example: string) =>
  z.string().nullable().describe(`Ref of a ${what} from the Brand Context (e.g. "${example}"), or null. Never invent one.`)

export const sectionSchema = z.object({ key: z.string(), label: z.string(), content: z.string() })

/** Input-side helpers (inputs are validated on the server only, so any zod feature is fine). */
export const inputText = (max = 4000) => z.string().trim().max(max)
export const optionalId = z.string().nullish().transform((v) => v || null)

/* ---------------------------------- Contract -------------------------------- */

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export interface PromptParts {
  /** Task instructions + input — the final user message. */
  user: string
  /** Optional task-specific rules appended after the Brand Voice system prompt. */
  system?: string
  /** Earlier conversation turns sent before `user` (multi-turn tasks such as the strategist). */
  history?: ChatTurn[]
}

export interface AiTaskDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  name: string
  description: string
  /** Validated on the server; defaults apply. */
  input: I
  /** Sent to the model as a structured-output schema — objects, arrays, enums, strings, numbers, booleans, nullable only. */
  output: O
  maxTokens: number
  buildPrompt(ctx: BrandContext, input: z.output<I>): PromptParts
  /** Deterministic, brand-aware generation used when no model is configured. */
  offline(ctx: BrandContext, input: z.output<I>): z.output<O>
  /** Post-parse clean-up for every provider: clamp ranges, validate ids, enforce section structure. */
  finalize?(output: z.output<O>, ctx: BrandContext, input: z.output<I>): z.output<O>
  /**
   * Replace the workspace Brand Context for this task (prompt, offline engine and finalize all see the result).
   * Onboarding uses it: the wizard answers describe the brand, not whatever workspace happens to be loaded.
   */
  context?(ctx: BrandContext, input: z.output<I>): BrandContext
}

export function defineTask<I extends z.ZodType, O extends z.ZodType>(task: AiTaskDefinition<I, O>): AiTaskDefinition<I, O> {
  return task
}

/* ------------------------------ Post-processing ----------------------------- */

export function clampNumber(value: number, min: number, max: number, fallback = min): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function clampInt(value: number, min: number, max: number, fallback = min): number {
  return Math.round(clampNumber(value, min, max, fallback))
}

/**
 * Map a candidate ref ("C3", "c3") or an exact id back to the id of `rows[n-1]`.
 * Used for per-request lists that aren't part of the Brand Context (e.g. what_to_post candidates).
 */
export function pickListId(value: string | null | undefined, rows: readonly { id: string }[], prefix = "C"): string | null {
  if (!value) return null
  const v = value.trim()
  if (rows.some((r) => r.id === v)) return v
  const match = new RegExp(`^${prefix}(\\d+)\\b`, "i").exec(v)
  return match ? (rows[Number(match[1]) - 1]?.id ?? null) : null
}

/** The content format id whose name matches (case-insensitive), else null. */
export function formatIdByName(ctx: BrandContext, name: string): string | null {
  const n = name.trim().toLowerCase()
  if (!n) return null
  return (
    ctx.formats.find((f) => f.name.toLowerCase() === n)?.id ??
    ctx.formats.find((f) => n.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(n))?.id ??
    null
  )
}

/** Exactly the sections of SCRIPT_FORMATS[format], in order, with canonical labels. */
export function fixSections(format: ScriptFormat, sections: readonly ScriptSection[]): ScriptSection[] {
  const spec = SCRIPT_FORMATS[format] ?? SCRIPT_FORMATS.custom
  const byKey = new Map(sections.map((s) => [s.key.trim().toLowerCase(), s]))
  const byLabel = new Map(sections.map((s) => [s.label.trim().toLowerCase(), s]))
  return spec.sections.map((s, i) => {
    const match = byKey.get(s.key) ?? byLabel.get(s.label.toLowerCase()) ?? (sections.length === spec.sections.length ? sections[i] : undefined)
    return { key: s.key, label: s.label, content: (match?.content ?? "").trim() }
  })
}

export function uniqueStrings(values: readonly string[], limit = 50): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const v = value.trim()
    if (!v || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
    if (out.length >= limit) break
  }
  return out
}

/** Pretty JSON block for prompts. */
export function jsonBlock(label: string, value: unknown): string {
  return `<${label}>\n${JSON.stringify(value, null, 1)}\n</${label}>`
}
