/**
 * "updated today" / "na-update kahapon": the shared `formatRelativeDay` inside a sentence. Single words are
 * lower-cased ("Today" → "today", "Kahapon" → "kahapon"); English keeps its exact earlier output (only
 * "Today" / "Yesterday" were lower-cased). Pure — no React.
 */
import { formatRelativeDay, type DateInput } from "@/lib/dates"
import type { UiLang } from "@/lib/i18n/core"

export function relativeDayInline(value: DateInput, now: Date, lang: UiLang = "en"): string {
  const label = formatRelativeDay(value, now, lang)
  if (lang === "en") return ["Today", "Yesterday"].includes(label) ? label.toLowerCase() : label
  return /^[A-Z][a-z]+$/.test(label) ? label.toLowerCase() : label
}
