/**
 * Retention for the `ai_generations` log. Strategist conversations are persisted in that table, so they're
 * kept in their own bucket — heavy AI use elsewhere (idea batches, scripts) can never prune a chat.
 */
import type { ID } from "@/lib/types"

export interface GenerationLimits {
  /** Newest rows kept across every task except the strategist. */
  default: number
  /** Newest strategist_chat rows kept. */
  strategist_chat: number
}

export const GENERATION_LIMITS: GenerationLimits = { default: 200, strategist_chat: 300 }

/** Tighter caps in local mode, where the whole workspace shares one ~5 MB localStorage entry. */
export const LOCAL_GENERATION_LIMITS: GenerationLimits = { default: 80, strategist_chat: 150 }

/**
 * Ids of the rows to delete: everything beyond the newest `limits.default` non-strategist rows and beyond the
 * newest `limits.strategist_chat` strategist_chat rows. Pure; ties on created_at are broken by id so it's stable.
 */
export function staleGenerationIds(rows: readonly { id: ID; task: string; created_at: string }[], limits: GenerationLimits = GENERATION_LIMITS): ID[] {
  const newestFirst = (a: { id: ID; created_at: string }, b: { id: ID; created_at: string }) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
  const strategist = rows.filter((r) => r.task === "strategist_chat").sort(newestFirst)
  const other = rows.filter((r) => r.task !== "strategist_chat").sort(newestFirst)
  return [...strategist.slice(Math.max(0, limits.strategist_chat)), ...other.slice(Math.max(0, limits.default))].map((r) => r.id)
}
