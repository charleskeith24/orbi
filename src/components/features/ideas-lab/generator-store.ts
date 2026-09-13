"use client"

import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"
import type { ID } from "@/lib/types"
import type { GeneratedBatch, GeneratedDraft, GeneratorBrief } from "./generator-model"

const MAX_BATCHES = 12

/** sessionStorage that never throws (private mode, quota): results then simply live in memory for this visit. */
const sessionStore: StateStorage = {
  getItem: (name) => {
    try {
      return window.sessionStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.sessionStorage.setItem(name, value)
    } catch {
      // Storage full or blocked — keep going in memory.
    }
  },
  removeItem: (name) => {
    try {
      window.sessionStorage.removeItem(name)
    } catch {
      // Nothing to clean up.
    }
  },
}

interface GeneratorState {
  /** Newest first. Full copies, so a restore within this tab never loses text to the AI log's trimming. */
  batches: GeneratedBatch[]
  /** Batches cleared from the results (restorable from Recent generations). */
  hidden: string[]
  /** The last brief generated, used when the page opens without one in the URL. */
  lastBrief: GeneratorBrief | null
}

/** Idea Generator results for this browser tab (survives navigation and reloads, not new tabs). */
export const useGeneratorStore = create<GeneratorState>()(
  persist((): GeneratorState => ({ batches: [], hidden: [], lastBrief: null }), {
    name: "pbos:idea-generator:v1",
    version: 1,
    storage: createJSONStorage(() => sessionStore),
  })
)

const setState = useGeneratorStore.setState

export const generatorActions = {
  addBatch(batch: GeneratedBatch) {
    setState((s) => {
      const batches = [batch, ...s.batches.filter((b) => b.id !== batch.id)].slice(0, MAX_BATCHES)
      const kept = new Set(batches.map((b) => b.id))
      return { batches, hidden: s.hidden.filter((id) => id !== batch.id && kept.has(id)) }
    })
  },
  /** Bring a batch back to the top of the results. */
  showBatch(id: string) {
    setState((s) => {
      const batch = s.batches.find((b) => b.id === id)
      if (!batch) return s
      return { batches: [batch, ...s.batches.filter((b) => b.id !== id)], hidden: s.hidden.filter((h) => h !== id) }
    })
  },
  hideBatch(id: string) {
    setState((s) => (s.hidden.includes(id) ? s : { hidden: [...s.hidden, id] }))
  },
  hideAll() {
    setState((s) => ({ hidden: s.batches.map((b) => b.id) }))
  },
  /** Undo for "Clear results". */
  setHidden(ids: string[]) {
    setState({ hidden: ids })
  },
  updateDraft(key: string, patch: Partial<GeneratedDraft>) {
    setState((s) => ({
      batches: s.batches.map((b) =>
        b.drafts.some((d) => d.key === key) ? { ...b, drafts: b.drafts.map((d) => (d.key === key ? { ...d, ...patch, key: d.key } : d)) } : b
      ),
    }))
  },
  markSaved(saved: { key: string; ideaId: ID }[]) {
    const byKey = new Map(saved.map((s) => [s.key, s.ideaId]))
    setState((s) => ({
      batches: s.batches.map((b) =>
        b.drafts.some((d) => byKey.has(d.key))
          ? { ...b, drafts: b.drafts.map((d) => (byKey.has(d.key) ? { ...d, saved_idea_id: byKey.get(d.key) ?? null } : d)) }
          : b
      ),
    }))
  },
  setLastBrief(brief: GeneratorBrief | null) {
    setState({ lastBrief: brief })
  },
}
