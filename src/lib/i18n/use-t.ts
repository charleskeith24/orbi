import { useMemo } from "react"
import { useDataStore } from "@/lib/store/data-store"
import { translator, uiLangOf, type MessageDict, type Messages, type Translator, type UiLang } from "./core"

/**
 * The workspace UI language (Settings → General → App language). Selects a string, so components
 * re-render only when the language changes — not on every settings edit.
 */
export function useUiLang(): UiLang {
  return useDataStore((s) => uiLangOf(s.db.app_settings[0]))
}

/** `const t = useT(m)` → `t("key", { name })` and `t.plural("count", n)`. */
export function useT<T extends MessageDict>(messages: Messages<T>): Translator<T> {
  const lang = useUiLang()
  return useMemo(() => translator(messages, lang), [messages, lang])
}
