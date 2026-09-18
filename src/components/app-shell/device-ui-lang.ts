"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"
import { translator, useUiLang, type MessageDict, type Messages, type Translator, type UiLang } from "@/lib/i18n"
import { useDataStore } from "@/lib/store/data-store"

/**
 * The app language remembered on this device, for screens that render without a loaded workspace:
 * /login, /signup and the theme menu before the workspace loads. Only "en" | "tl" is stored — no
 * workspace data. The shell writes it whenever a workspace is loaded (`useRememberUiLang`).
 */
const DEVICE_LANG_KEY = "pbos:ui-lang"
/** Dev-only QA flag set by the scripts' `--lang` (same key as `DEV_UI_LANG_KEY` in the local adapter). */
const DEV_LANG_KEY = "pbos:dev-ui-lang"

const asLang = (value: string | null): UiLang | null => (value === "en" || value === "tl" ? value : null)

function readDeviceLang(): UiLang {
  try {
    const saved = asLang(window.localStorage.getItem(DEVICE_LANG_KEY))
    if (saved) return saved
    if (process.env.NODE_ENV !== "production") return asLang(window.localStorage.getItem(DEV_LANG_KEY)) ?? "en"
  } catch {
    // Storage unavailable — English.
  }
  return "en"
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener)
  return () => window.removeEventListener("storage", listener)
}

/** Workspace language once the workspace is loaded; before that (or without one), this device's last language. */
export function useScreenLang(): UiLang {
  const ready = useDataStore((s) => s.status === "ready")
  const workspaceLang = useUiLang()
  const deviceLang = useSyncExternalStore(subscribe, readDeviceLang, () => "en" as UiLang)
  return ready ? workspaceLang : deviceLang
}

/** `useT` for screens that may render without a workspace (auth pages, the theme menu). */
export function useScreenT<T extends MessageDict>(messages: Messages<T>): Translator<T> {
  const lang = useScreenLang()
  return useMemo(() => translator(messages, lang), [messages, lang])
}

/** Mounted by the app shell: remembers the loaded workspace's language on this device. */
export function useRememberUiLang() {
  const ready = useDataStore((s) => s.status === "ready")
  const lang = useUiLang()
  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(DEVICE_LANG_KEY, lang)
    } catch {
      // Storage unavailable — auth screens fall back to English.
    }
  }, [ready, lang])
}
