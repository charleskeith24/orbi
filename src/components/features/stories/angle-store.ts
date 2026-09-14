import { create } from "zustand"
import { runAiTask, toAiError, type AiTaskInput } from "@/lib/ai"
import type { AiProviderId, ID } from "@/lib/types"
import { toAngleDrafts, type AngleDraft, type ExtractedStory } from "./angle-model"

export type AngleStatus = "idle" | "pending" | "done" | "error"

/** One experience_to_content conversation: the latest drafts (kept while regenerating) and its status. */
export interface AngleSession {
  status: AngleStatus
  drafts: AngleDraft[]
  /** The Story Vault entry the AI extracted (editable on the Experience page). */
  story: ExtractedStory | null
  provider: AiProviderId | null
  model: string | null
  error: string | null
  /** The experience text of the last successful run. */
  input: string
  request: number
}

export interface ExperiencePageState {
  text: string
  pillarId: ID | null
  /** The story saved from the current experience (ideas saved afterwards link to it). */
  savedStoryId: ID | null
}

interface AngleStoreState {
  sessions: Record<string, AngleSession>
  experience: ExperiencePageState
}

const IDLE: AngleSession = { status: "idle", drafts: [], story: null, provider: null, model: null, error: null, input: "", request: 0 }

/** Session key of the `/stories/experience` page. */
export const EXPERIENCE_SESSION = "experience"

/**
 * Module-level so generations survive closing the story sheet or leaving the page, and so a card
 * menu can start one before the sheet that shows it has mounted.
 */
export const useAngleStore = create<AngleStoreState>(() => ({
  sessions: {},
  experience: { text: "", pillarId: null, savedStoryId: null },
}))

export function storySessionKey(storyId: ID): string {
  return `story:${storyId}`
}

export function useAngleSession(key: string): AngleSession {
  return useAngleStore((state) => state.sessions[key] ?? IDLE)
}

export function useExperiencePageState(): ExperiencePageState {
  return useAngleStore((state) => state.experience)
}

function patchSession(key: string, patch: (session: AngleSession) => Partial<AngleSession>) {
  useAngleStore.setState((state) => {
    const current = state.sessions[key] ?? IDLE
    return { sessions: { ...state.sessions, [key]: { ...current, ...patch(current) } } }
  })
}

let requestSeq = 0

/** Run experience_to_content for a session. Latest call wins; resolves true when drafts were stored. */
export async function generateAngles(
  key: string,
  input: AiTaskInput<"experience_to_content">,
  options: { entityType?: string; entityId?: ID | null } = {}
): Promise<boolean> {
  const request = ++requestSeq
  patchSession(key, () => ({ status: "pending", error: null, request }))
  try {
    const result = await runAiTask("experience_to_content", input, { entityType: options.entityType, entityId: options.entityId })
    if (useAngleStore.getState().sessions[key]?.request !== request) return false
    patchSession(key, () => ({
      status: "done",
      drafts: toAngleDrafts(result.output.angles, request),
      story: result.output.story,
      provider: result.provider,
      model: result.model,
      input: input.experience,
    }))
    return true
  } catch (err) {
    if (useAngleStore.getState().sessions[key]?.request !== request) return false
    patchSession(key, () => ({ status: "error", error: toAiError(err).message }))
    return false
  }
}

export function updateAngleDraft(key: string, draftKey: string, patch: Partial<AngleDraft>) {
  patchSession(key, (session) => ({ drafts: session.drafts.map((d) => (d.key === draftKey ? { ...d, ...patch } : d)) }))
}

export function updateSessionStory(key: string, patch: Partial<ExtractedStory>) {
  patchSession(key, (session) => (session.story ? { story: { ...session.story, ...patch } } : {}))
}

export function setExperiencePageState(patch: Partial<ExperiencePageState>) {
  useAngleStore.setState((state) => ({ experience: { ...state.experience, ...patch } }))
}
