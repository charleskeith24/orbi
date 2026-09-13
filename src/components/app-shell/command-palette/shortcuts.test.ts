import { describe, expect, it } from "vitest"
import {
  matchShortcut,
  type ShortcutContext,
  type ShortcutKeyEvent,
} from "@/components/app-shell/command-palette/shortcuts"

const press = (overrides: Partial<ShortcutKeyEvent>): ShortcutKeyEvent => ({
  key: "",
  code: "",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  defaultPrevented: false,
  isComposing: false,
  ...overrides,
})

const context = (overrides: Partial<ShortcutContext> = {}): ShortcutContext => ({
  paletteOpen: false,
  isTyping: () => false,
  isModalOpen: () => false,
  ...overrides,
})
const idle = context()
const typing = context({ isTyping: () => true })
const modal = context({ isModalOpen: () => true })

describe("matchShortcut", () => {
  it("toggles the palette with ⌘K / Ctrl+K, even while typing and on non-Latin layouts", () => {
    expect(matchShortcut(press({ key: "k", code: "KeyK", metaKey: true }), idle)).toBe("toggle-palette")
    expect(matchShortcut(press({ key: "k", code: "KeyK", ctrlKey: true }), typing)).toBe("toggle-palette")
    expect(matchShortcut(press({ key: "л", code: "KeyK", metaKey: true }), idle)).toBe("toggle-palette")
    expect(matchShortcut(press({ key: "k", code: "KeyK", metaKey: true }), context({ paletteOpen: true }))).toBe(
      "toggle-palette"
    )
  })

  it("swallows a held ⌘K and ignores ⌘⇧K / ⌘⌥K", () => {
    expect(matchShortcut(press({ key: "k", code: "KeyK", metaKey: true, repeat: true }), idle)).toBe("swallow")
    expect(matchShortcut(press({ key: "K", code: "KeyK", metaKey: true, shiftKey: true }), idle)).toBeNull()
    expect(matchShortcut(press({ key: "k", code: "KeyK", metaKey: true, altKey: true }), idle)).toBeNull()
  })

  it("leaves ⌘K to a field that already handled it, except inside the palette", () => {
    expect(matchShortcut(press({ key: "k", code: "KeyK", metaKey: true, defaultPrevented: true }), idle)).toBeNull()
    expect(
      matchShortcut(press({ key: "k", code: "KeyK", ctrlKey: true, defaultPrevented: true }), context({ paletteOpen: true }))
    ).toBe("toggle-palette")
  })

  it("toggles the Content Strategist with ⌘J / Ctrl+J, but not while typing", () => {
    expect(matchShortcut(press({ key: "j", code: "KeyJ", metaKey: true }), idle)).toBe("toggle-strategist")
    expect(matchShortcut(press({ key: "j", code: "KeyJ", ctrlKey: true }), idle)).toBe("toggle-strategist")
    expect(matchShortcut(press({ key: "j", code: "KeyJ", metaKey: true }), typing)).toBeNull()
    expect(matchShortcut(press({ key: "j", code: "KeyJ", metaKey: true, repeat: true }), idle)).toBeNull()
  })

  it("opens Quick Capture with ⌥N / Alt+N by physical key, never over a dialog or while typing", () => {
    expect(matchShortcut(press({ key: "Dead", code: "KeyN", altKey: true }), idle)).toBe("quick-capture")
    expect(matchShortcut(press({ key: "n", code: "KeyN", altKey: true }), idle)).toBe("quick-capture")
    expect(matchShortcut(press({ key: "n", code: "KeyN", altKey: true }), modal)).toBeNull()
    expect(matchShortcut(press({ key: "n", code: "KeyN", altKey: true }), typing)).toBeNull()
    expect(matchShortcut(press({ key: "N", code: "KeyN", altKey: true, shiftKey: true }), idle)).toBeNull()
    expect(matchShortcut(press({ key: "n", code: "KeyN", altKey: true, ctrlKey: true }), idle)).toBeNull()
  })

  it("opens search with / only when nothing else has focus or is open", () => {
    expect(matchShortcut(press({ key: "/", code: "Slash" }), idle)).toBe("open-palette")
    // Layouts where "/" needs Shift (e.g. German Shift+7).
    expect(matchShortcut(press({ key: "/", code: "Digit7", shiftKey: true }), idle)).toBe("open-palette")
    expect(matchShortcut(press({ key: "/", code: "Slash" }), typing)).toBeNull()
    expect(matchShortcut(press({ key: "/", code: "Slash" }), modal)).toBeNull()
    expect(matchShortcut(press({ key: "/", code: "Slash" }), context({ paletteOpen: true }))).toBeNull()
    expect(matchShortcut(press({ key: "/", code: "Slash", metaKey: true }), idle)).toBeNull()
  })

  it("ignores IME composition and unrelated keys", () => {
    expect(matchShortcut(press({ key: "k", code: "KeyK", metaKey: true, isComposing: true }), idle)).toBeNull()
    expect(matchShortcut(press({ key: "n", code: "KeyN" }), idle)).toBeNull()
    expect(matchShortcut(press({ key: "Escape", code: "Escape" }), idle)).toBeNull()
  })
})
