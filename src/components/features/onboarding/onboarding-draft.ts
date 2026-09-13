/**
 * The wizard's work in progress, kept in this browser per user so a refresh never loses answers, the
 * generated strategy or idea edits. A draft belongs to one workspace: after "Start fresh" (a new brand
 * row) an old draft is ignored.
 */
import type { AiProviderId, BrandProfile } from "@/lib/types"
import { sanitizeIdeaDrafts, type IdeaDraft } from "./onboarding-ideas"
import { LAST_STEP, sanitizeAnswers, type OnboardingAnswers } from "./onboarding-model"

export interface PillarSuggestion {
  name: string
  description: string
  target_percentage: number
}

export interface StrategyResult {
  /** strategyKey() of the answers it was generated from — a different key means it's out of date. */
  key: string
  provider: AiProviderId
  model: string
  positioning_statement: string
  known_for: string
  point_of_view: string
  pillar_suggestions: PillarSuggestion[]
  ideas: IdeaDraft[]
  /** The creator edited idea titles, selection or pillars (regenerating asks first). */
  edited?: boolean
}

export interface OnboardingDraft {
  version: 1
  /** workspaceKey() of the brand row when the draft started. */
  workspace: string
  mode: "first" | "rerun"
  step: number
  /** Furthest step reached — progress segments up to here are clickable. */
  maxStep: number
  answers: OnboardingAnswers
  strategy: StrategyResult | null
  updatedAt: string
}

const PROVIDERS: AiProviderId[] = ["anthropic", "openai", "offline"]
const storageKey = (userId: string) => `pbos:onboarding:v1:${userId || "local"}`

/** "Start fresh" creates a new brand row (new created_at), so drafts never leak across workspaces. */
export const workspaceKey = (brand: Pick<BrandProfile, "id" | "created_at">) => `${brand.id}|${brand.created_at}`

export function createDraft(workspace: string, mode: OnboardingDraft["mode"], answers: OnboardingAnswers): OnboardingDraft {
  return { version: 1, workspace, mode, step: 0, maxStep: 0, answers, strategy: null, updatedAt: new Date().toISOString() }
}

const clampStep = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(LAST_STEP, Math.max(0, Math.round(value))) : 0

function sanitizeStrategy(raw: unknown): StrategyResult | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.key !== "string" || typeof r.positioning_statement !== "string") return null
  const suggestions = Array.isArray(r.pillar_suggestions) ? r.pillar_suggestions : []
  return {
    key: r.key,
    provider: PROVIDERS.includes(r.provider as AiProviderId) ? (r.provider as AiProviderId) : "offline",
    model: typeof r.model === "string" ? r.model : "",
    positioning_statement: r.positioning_statement,
    known_for: typeof r.known_for === "string" ? r.known_for : "",
    point_of_view: typeof r.point_of_view === "string" ? r.point_of_view : "",
    pillar_suggestions: suggestions
      .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object" && typeof (p as { name?: unknown }).name === "string")
      .map((p) => ({
        name: String(p.name),
        description: typeof p.description === "string" ? p.description : "",
        target_percentage: typeof p.target_percentage === "number" && Number.isFinite(p.target_percentage) ? p.target_percentage : 0,
      })),
    ideas: sanitizeIdeaDrafts(r.ideas),
    edited: r.edited === true,
  }
}

export function loadDraft(userId: string, workspace: string): OnboardingDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft> | null
    if (!parsed || parsed.version !== 1 || parsed.workspace !== workspace) return null
    const step = clampStep(parsed.step)
    return {
      version: 1,
      workspace,
      mode: parsed.mode === "rerun" ? "rerun" : "first",
      step,
      maxStep: Math.max(step, clampStep(parsed.maxStep)),
      answers: sanitizeAnswers(parsed.answers),
      strategy: sanitizeStrategy(parsed.strategy),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function saveDraft(userId: string, draft: OnboardingDraft): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }))
  } catch {
    // Storage unavailable or full: the draft just isn't remembered.
  }
}

export function clearDraft(userId: string): void {
  try {
    window.localStorage.removeItem(storageKey(userId))
  } catch {
    // Nothing to clear.
  }
}
