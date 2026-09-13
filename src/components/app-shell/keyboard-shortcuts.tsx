"use client"

import { useEffect, useSyncExternalStore } from "react"
import { matchShortcut } from "@/components/app-shell/command-palette/shortcuts"
import { useUIStore } from "@/lib/store"

const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"])

/** True when a key event comes from somewhere the user is typing text. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type)
  return target.closest('[contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"]') !== null
}

/** Another modal (dialog, alert, sheet) is open — don't stack a shortcut on top of it. */
function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !== null
}

const subscribeNoop = () => () => {}

/** Apple platforms show ⌘/⌥ in shortcut hints; everything else shows Ctrl/Alt. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => true
  )
}

/**
 * Global shortcuts, mounted once by the command palette (rules live in `matchShortcut`):
 * ⌘/Ctrl+K palette (works while typing) · ⌘/Ctrl+J Content Strategist · ⌥/Alt+N Quick Capture ·
 * "/" search. Everything except ⌘/Ctrl+K is ignored while typing in a field.
 */
export function KeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUIStore.getState()
      const action = matchShortcut(event, {
        paletteOpen: ui.commandOpen,
        isTyping: () => isTypingTarget(event.target),
        isModalOpen,
      })
      if (!action) return
      event.preventDefault()
      if (action === "toggle-palette") ui.setCommandOpen(!ui.commandOpen)
      else if (action === "toggle-strategist") ui.setStrategistOpen(!ui.strategistOpen)
      else if (action === "quick-capture") ui.openDialog({ type: "quick-capture" })
      else if (action === "open-palette") ui.setCommandOpen(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return null
}
