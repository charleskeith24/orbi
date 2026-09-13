"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { GeneratedBy, ID, ScriptFormat, ScriptSection } from "@/lib/types"

/** Unsaved script edits. Kept outside the component tree so switching tabs, items or reloading never loses them. */
export interface ScriptDraft {
  sections: ScriptSection[]
  caption: string
  hashtags: string[]
  /** The saved version the draft started from (null for a brand-new script). */
  baseId: ID | null
  /** Engine behind the draft: an AI provider for a generated draft, "manual" once written by hand. */
  source: GeneratedBy
  model: string
  title: string
}

interface StudioState {
  /** Script format open in the Script tab, per item. */
  formats: Record<ID, ScriptFormat>
  /** Unsaved script drafts keyed by `draftKey(item, format)`. */
  drafts: Record<string, ScriptDraft>
  /** Story Vault story chosen for AI script generation, per item. */
  stories: Record<ID, ID | null>
  setFormat: (itemId: ID, format: ScriptFormat) => void
  setDraft: (itemId: ID, format: ScriptFormat, draft: ScriptDraft) => void
  clearDraft: (itemId: ID, format: ScriptFormat) => void
  setStory: (itemId: ID, storyId: ID | null) => void
}

export const draftKey = (itemId: ID, format: ScriptFormat) => `${itemId}:${format}`

/** Session-scoped: drafts survive reloads in this tab without a blocking "leave page?" prompt. */
export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      formats: {},
      drafts: {},
      stories: {},
      setFormat: (itemId, format) => set((s) => ({ formats: { ...s.formats, [itemId]: format } })),
      setDraft: (itemId, format, draft) => set((s) => ({ drafts: { ...s.drafts, [draftKey(itemId, format)]: draft } })),
      clearDraft: (itemId, format) =>
        set((s) => {
          const key = draftKey(itemId, format)
          if (!(key in s.drafts)) return s
          const drafts = { ...s.drafts }
          delete drafts[key]
          return { drafts }
        }),
      setStory: (itemId, storyId) => set((s) => ({ stories: { ...s.stories, [itemId]: storyId } })),
    }),
    {
      name: "pbos:studio:v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ formats: s.formats, drafts: s.drafts, stories: s.stories }),
    }
  )
)

export const studioActions = {
  setFormat: (itemId: ID, format: ScriptFormat) => useStudioStore.getState().setFormat(itemId, format),
  setDraft: (itemId: ID, format: ScriptFormat, draft: ScriptDraft) => useStudioStore.getState().setDraft(itemId, format, draft),
  clearDraft: (itemId: ID, format: ScriptFormat) => useStudioStore.getState().clearDraft(itemId, format),
  setStory: (itemId: ID, storyId: ID | null) => useStudioStore.getState().setStory(itemId, storyId),
  getDraft: (itemId: ID, format: ScriptFormat): ScriptDraft | undefined => useStudioStore.getState().drafts[draftKey(itemId, format)],
}

/** Formats of an item that have unsaved drafts, as a stable comma-joined string (never a new array). */
export function useDraftFormatsKey(itemId: ID): string {
  return useStudioStore((s) =>
    Object.keys(s.drafts)
      .filter((key) => key.startsWith(`${itemId}:`))
      .map((key) => key.slice(itemId.length + 1))
      .sort()
      .join(",")
  )
}
