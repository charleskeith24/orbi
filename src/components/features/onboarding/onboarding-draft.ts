/**
 * The wizard's work in progress, kept in this browser per user so a refresh never loses answers, the
 * chosen language, the niche suggestions, the generated strategy or idea edits. A draft belongs to one
 * workspace: after "Start fresh" (a new brand row) an old draft is ignored.
 *
 * Drafts remember their step by key. Older drafts (version 2, saved by index into the flows before Quick
 * setup) and unknown keys resume on the first screen with every answer that still maps.
 */
import type { AiProviderId, BrandProfile } from "@/lib/types"
import { ONBOARDING_LANGS, type OnboardingLang } from "./copy"
import { sanitizeNicheResult, type NicheResult } from "./niche-model"
import { sanitizeIdeaDrafts, type IdeaDraft } from "./onboarding-ideas"
import { FULL_FLOW, flowFor, sanitizeAnswers, type OnboardingAnswers, type StepKey, type WizardMode } from "./onboarding-model"

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
  version: 3
  /** workspaceKey() of the brand row when the draft started. */
  workspace: string
  mode: WizardMode
  /** The onboarding UI language (also the language niche suggestions come back in). */
  lang: OnboardingLang
  /** Index into flowFor(mode) — stored as `stepKey`, so a changed flow never resumes on the wrong screen. */
  step: number
  /** Furthest step reached — progress segments up to here are clickable. */
  maxStep: number
  answers: OnboardingAnswers
  niche: NicheResult | null
  strategy: StrategyResult | null
  updatedAt: string
}

const PROVIDERS: AiProviderId[] = ["anthropic", "openai", "gemini", "offline"]
const MODES: WizardMode[] = ["first", "rerun", "niche"]
const storageKey = (userId: string) => `pbos:onboarding:v2:${userId || "local"}`

/** "Start fresh" creates a new brand row (new created_at), so drafts never leak across workspaces. */
export const workspaceKey = (brand: Pick<BrandProfile, "id" | "created_at">) => `${brand.id}|${brand.created_at}`

export function createDraft(workspace: string, mode: WizardMode, answers: OnboardingAnswers, lang: OnboardingLang): OnboardingDraft {
  return { version: 3, workspace, mode, lang, step: 0, maxStep: 0, answers, niche: null, strategy: null, updatedAt: new Date().toISOString() }
}

/** The flows version-2 drafts indexed into (before Quick setup). */
const V2_FLOWS: Record<WizardMode, readonly StepKey[]> = {
  first: FULL_FLOW,
  rerun: FULL_FLOW,
  niche: ["hilig", "galing", "kanino", "para_saan", "niche"],
}

const index = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : -1)

/** Where a stored draft resumes in today's flow: its step key if the flow still has it, else the first screen. */
function resumeStep(raw: Record<string, unknown>, mode: WizardMode): { step: number; maxStep: number } {
  const flow = flowFor(mode)
  const keyOf = (key: unknown, legacyIndex: unknown): StepKey | undefined =>
    raw.version === 3 ? (typeof key === "string" ? (key as StepKey) : undefined) : V2_FLOWS[mode][index(legacyIndex)]
  const at = (key: StepKey | undefined) => (key ? flow.indexOf(key) : -1)
  const step = Math.max(0, at(keyOf(raw.stepKey, raw.step)))
  return { step, maxStep: Math.max(step, at(keyOf(raw.maxStepKey, raw.maxStep))) }
}

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

/** A stored draft (parsed JSON) for this workspace, migrated to the current flows; null when it isn't one. */
export function parseDraft(raw: unknown, workspace: string): OnboardingDraft | null {
  if (!raw || typeof raw !== "object") return null
  const parsed = raw as Record<string, unknown>
  if ((parsed.version !== 2 && parsed.version !== 3) || parsed.workspace !== workspace) return null
  const mode = MODES.includes(parsed.mode as WizardMode) ? (parsed.mode as WizardMode) : "first"
  const { step, maxStep } = resumeStep(parsed, mode)
  return {
    version: 3,
    workspace,
    mode,
    lang: ONBOARDING_LANGS.includes(parsed.lang as OnboardingLang) ? (parsed.lang as OnboardingLang) : "english",
    step,
    maxStep,
    answers: sanitizeAnswers(parsed.answers),
    niche: sanitizeNicheResult(parsed.niche),
    strategy: sanitizeStrategy(parsed.strategy),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
  }
}

/** What is written to storage: the draft plus its step keys. */
export function serializeDraft(draft: OnboardingDraft): string {
  const flow = flowFor(draft.mode)
  return JSON.stringify({ ...draft, stepKey: flow[draft.step] ?? flow[0], maxStepKey: flow[draft.maxStep] ?? flow[0], updatedAt: new Date().toISOString() })
}

export function loadDraft(userId: string, workspace: string): OnboardingDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return raw ? parseDraft(JSON.parse(raw), workspace) : null
  } catch {
    return null
  }
}

export function saveDraft(userId: string, draft: OnboardingDraft): void {
  try {
    window.localStorage.setItem(storageKey(userId), serializeDraft(draft))
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
