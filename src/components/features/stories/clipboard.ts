import { toast } from "sonner"
import { translate } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { storyFormMessages } from "./messages"

/** Copy text with a toast (Clipboard API, falling back to a hidden textarea). */
export async function copyText(text: string, successMessage?: string): Promise<boolean> {
  const lang = getUiLang()
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
  if (ok) toast.success(successMessage ?? translate(storyFormMessages, lang, "copied"))
  else
    toast.error(translate(storyFormMessages, lang, "copy_failed"), {
      description: translate(storyFormMessages, lang, "copy_failed_description"),
    })
  return ok
}
