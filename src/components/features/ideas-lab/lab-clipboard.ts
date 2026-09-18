"use client"

import { toast } from "sonner"
import { translate } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { labMessages } from "./messages"

/** Copy text with a toast; falls back to a hidden textarea when the Clipboard API is unavailable. */
export async function copyToClipboard(text: string, successMessage?: string): Promise<boolean> {
  let ok = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      ok = true
    }
  } catch {
    ok = false
  }
  if (!ok) {
    try {
      const area = document.createElement("textarea")
      area.value = text
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.opacity = "0"
      document.body.appendChild(area)
      area.select()
      ok = document.execCommand("copy")
      area.remove()
    } catch {
      ok = false
    }
  }
  const lang = getUiLang()
  if (ok) toast.success(successMessage ?? translate(labMessages, lang, "copied_to_clipboard"))
  else toast.error(translate(labMessages, lang, "couldnt_copy"), { description: translate(labMessages, lang, "copy_manually") })
  return ok
}
