/**
 * Feedback dialog logic without React: sending to /api/feedback, the text copied in local mode,
 * and a clipboard helper with a fallback for browsers without the async Clipboard API.
 */
import { format } from "date-fns"
import type { Translator } from "@/lib/i18n/core"
import type { FeedbackKind, Viewport } from "@/lib/telemetry/feedback"
import type { m } from "./messages"

export type FeedbackMessages = (typeof m)["en"]

export interface FeedbackPayload {
  kind: FeedbackKind
  message: string
  page: string
  ui_language: "en" | "tl"
  viewport: Viewport
}

export type SendFeedbackResult = "ok" | "signed_out" | "offline" | "error"

/** POST /api/feedback. Never throws. */
export async function sendFeedback(payload: FeedbackPayload, fetchImpl: typeof fetch = fetch): Promise<SendFeedbackResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline"
  try {
    const response = await fetchImpl("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    })
    if (response.ok) return "ok"
    return response.status === 401 ? "signed_out" : "error"
  } catch {
    return "error"
  }
}

/** The text "Copy feedback" puts on the clipboard (local mode, or when sending fails). */
export function formatFeedbackText(
  input: { kindLabel: string; message: string; page: string; lang: string; viewport: string; date: Date },
  t: Translator<FeedbackMessages>
): string {
  return [
    t("copy_heading", { kind: input.kindLabel }),
    t("copy_page", { page: input.page }),
    t("copy_context", { lang: input.lang, viewport: input.viewport }),
    t("copy_date", { date: format(input.date, "yyyy-MM-dd HH:mm") }),
    "",
    input.message,
  ].join("\n")
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or insecure context — fall back below.
  }
  try {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    area.remove()
    return ok
  } catch {
    return false
  }
}
