import { create } from "zustand"
import type { ID, InsertRow } from "@/lib/types"

/** App-wide dialogs that can be opened from anywhere (top bar, dashboard, Today, command palette). */
export type GlobalDialog =
  | { type: "quick-capture"; initialText?: string }
  | { type: "new-content"; ideaId?: ID; defaults?: InsertRow<"content_items"> }
  | { type: "log-post" }
  | { type: "add-metrics"; itemId?: ID }

interface UIState {
  dialog: GlobalDialog | null
  openDialog(dialog: GlobalDialog): void
  closeDialog(): void

  commandOpen: boolean
  setCommandOpen(open: boolean): void

  strategistOpen: boolean
  /** Prompt queued for the strategist panel (e.g. from a "Ask the strategist" button). */
  strategistPrompt: string | null
  setStrategistOpen(open: boolean): void
  askStrategist(prompt?: string): void
  consumeStrategistPrompt(): string | null
}

export const useUIStore = create<UIState>()((set, get) => ({
  dialog: null,
  openDialog: (dialog) => set({ dialog, commandOpen: false }),
  closeDialog: () => set({ dialog: null }),

  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),

  strategistOpen: false,
  strategistPrompt: null,
  setStrategistOpen: (strategistOpen) => set({ strategistOpen }),
  askStrategist: (prompt) => set({ strategistOpen: true, strategistPrompt: prompt ?? null, commandOpen: false }),
  consumeStrategistPrompt: () => {
    const prompt = get().strategistPrompt
    if (prompt) set({ strategistPrompt: null })
    return prompt
  },
}))

export const uiActions = {
  openDialog: (dialog: GlobalDialog) => useUIStore.getState().openDialog(dialog),
  closeDialog: () => useUIStore.getState().closeDialog(),
  askStrategist: (prompt?: string) => useUIStore.getState().askStrategist(prompt),
  setCommandOpen: (open: boolean) => useUIStore.getState().setCommandOpen(open),
}
