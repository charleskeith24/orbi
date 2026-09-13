/**
 * Global shortcut rules, kept pure so they are testable without a DOM:
 * ⌘/Ctrl+K palette (works while typing) · ⌘/Ctrl+J Content Strategist · ⌥/Alt+N Quick Capture · "/" search.
 * Everything except ⌘/Ctrl+K yields to text fields.
 */
export type ShortcutAction = "toggle-palette" | "toggle-strategist" | "quick-capture" | "open-palette"

export type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "defaultPrevented" | "isComposing"
>

export interface ShortcutContext {
  paletteOpen: boolean
  /** The key came from a text field (evaluated lazily, only for shortcuts that yield to typing). */
  isTyping: () => boolean
  /** Another modal is open, so a shortcut must not stack a new dialog on top of it. */
  isModalOpen: () => boolean
}

/**
 * The action a key press triggers; "swallow" for a held ⌘K (block the browser default without toggling
 * again); null when the key isn't a global shortcut.
 */
export function matchShortcut(event: ShortcutKeyEvent, ctx: ShortcutContext): ShortcutAction | "swallow" | null {
  if (event.isComposing) return null
  const mod = event.metaKey || event.ctrlKey
  const plainMod = mod && !event.altKey && !event.shiftKey
  const key = event.key.toLowerCase()

  if (plainMod && (key === "k" || event.code === "KeyK")) {
    // An editor that binds ⌘K itself (e.g. "insert link") keeps it; inside the palette it always closes.
    if (event.defaultPrevented && !ctx.paletteOpen) return null
    return event.repeat ? "swallow" : "toggle-palette"
  }
  if (event.defaultPrevented || event.repeat || ctx.isTyping()) return null

  if (plainMod && (key === "j" || event.code === "KeyJ")) return "toggle-strategist"
  // event.code, not key: Option+N on macOS produces a dead key ("˜").
  if (event.altKey && !mod && !event.shiftKey && event.code === "KeyN") return ctx.isModalOpen() ? null : "quick-capture"
  if (key === "/" && !mod && !event.altKey && !ctx.paletteOpen && !ctx.isModalOpen()) return "open-palette"
  return null
}
