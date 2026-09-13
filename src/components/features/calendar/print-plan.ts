/**
 * Print the page (the Weekly Content Plan) on paper colours, even from dark mode. `body[data-printing]` marks
 * the document while the print dialog is up.
 */
export function printPlan() {
  const root = document.documentElement
  const dark = root.classList.contains("dark")
  const scheme = root.style.colorScheme
  document.body.setAttribute("data-printing", "weekly-plan")
  if (dark) {
    root.classList.remove("dark")
    root.style.colorScheme = "light"
  }
  try {
    window.print()
  } finally {
    if (dark) {
      root.classList.add("dark")
      root.style.colorScheme = scheme
    }
    document.body.removeAttribute("data-printing")
  }
}
