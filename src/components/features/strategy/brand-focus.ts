/** Smoothly scrolls an element into view (instant with reduced motion). */
export function scrollToElement(id: string, block: ScrollLogicalPosition = "start") {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block })
}

/** Scrolls to a form control and focuses it (or its first focusable child). */
export function focusControl(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const target =
    el.matches("input, textarea, button, select, [tabindex]")
      ? el
      : el.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex='0']")
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" })
  ;(target ?? el).focus({ preventScroll: true })
}
