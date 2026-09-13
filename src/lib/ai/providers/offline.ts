import type { AiProvider } from "./types"

export const OFFLINE_MODEL = "offline-templates"

/** Runs the task's deterministic, brand-aware offline generator. Always available. */
export const offlineProvider: AiProvider = {
  id: "offline",
  model: OFFLINE_MODEL,
  async generate(opts) {
    return { output: opts.offline(), model: OFFLINE_MODEL }
  },
}
