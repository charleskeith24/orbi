import type { ZodType } from "zod"
import type { AiProviderId } from "@/lib/types"
import type { ChatTurn } from "../tasks/shared"

export interface GenerateOptions<T> {
  system: string
  user: string
  /** Earlier turns (multi-turn tasks). The final message is always `user`. */
  history?: ChatTurn[]
  /** Structured-output schema; the provider validates against it. */
  schema: ZodType<T>
  maxTokens: number
  taskName: string
  /** Deterministic brand-aware generation (used by the offline provider). */
  offline: () => T
  signal?: AbortSignal
}

export interface GenerateResult<T> {
  output: T
  /** The model that actually produced the output (differs from the configured one after a server-side fallback). */
  model: string
}

export interface AiProvider {
  id: AiProviderId
  /** Configured model id. */
  model: string
  generate<T>(opts: GenerateOptions<T>): Promise<GenerateResult<T>>
}
