/**
 * App UI language (Settings → General → App language). English is the source; Taglish must cover
 * every key — `defineMessages` makes a missing Taglish key a compile error. Product terms
 * (ARCHITECTURE §9) stay in English in both languages.
 *
 * Pure module: safe for lib code, tests and server code. React code uses `useT` from "@/lib/i18n".
 */
export type UiLang = "en" | "tl"

export const UI_LANGS: UiLang[] = ["en", "tl"]
export const UI_LANG_LABELS: Record<UiLang, string> = { en: "English", tl: "Taglish" }

/** The UI language stored on a settings row; English for a missing row or an unknown value. */
export function uiLangOf(settings: { ui_language?: string } | null | undefined): UiLang {
  return settings?.ui_language === "tl" ? "tl" : "en"
}

export type MessageDict = Record<string, string>
export type Vars = Record<string, string | number>

export interface Messages<T extends MessageDict> {
  en: T
  tl: { [K in keyof T]: string }
}

/**
 * Declares a message namespace:
 * `export const m = defineMessages({ en: { save: "Save" }, tl: { save: "I-save" } })`.
 */
export function defineMessages<T extends MessageDict>(messages: Messages<T>): Messages<T> {
  return messages
}

/** Fills `{name}` placeholders. Unknown placeholders stay visible so a missing value is easy to spot. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}

type PluralBase<T> = { [K in keyof T]: K extends `${infer B}_one` ? B : never }[keyof T]

export interface Translator<T extends MessageDict> {
  (key: keyof T & string, vars?: Vars): string
  /** Picks `<key>_one` or `<key>_other` and fills `{count}` (pass `count` in vars to pre-format it). */
  plural: (key: PluralBase<T> & string, count: number, vars?: Vars) => string
}

export function translator<T extends MessageDict>(messages: Messages<T>, lang: UiLang): Translator<T> {
  const dict = messages[lang] as Record<string, string>
  const en = messages.en as Record<string, string>
  const t = ((key: string, vars?: Vars) => interpolate(dict[key] ?? en[key] ?? key, vars)) as Translator<T>
  t.plural = (key, count, vars) => t(`${key}_${count === 1 ? "one" : "other"}` as keyof T & string, { count, ...vars })
  return t
}

/** One-off translation outside React (toasts in store code, pure helpers). */
export function translate<T extends MessageDict>(messages: Messages<T>, lang: UiLang, key: keyof T & string, vars?: Vars): string {
  return translator(messages, lang)(key, vars)
}
