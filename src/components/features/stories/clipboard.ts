import { toast } from "sonner"

/** Copy text with a toast (Clipboard API, falling back to a hidden textarea). */
export async function copyText(text: string, successMessage = "Copied to clipboard"): Promise<boolean> {
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
  if (ok) toast.success(successMessage)
  else toast.error("Couldn't copy", { description: "Select the text and copy it manually." })
  return ok
}
