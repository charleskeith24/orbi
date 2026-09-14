/**
 * Print the report on paper colours, even from dark mode. The app shell hides its chrome in print
 * (`[data-print="hide"]`, the sidebar); `body[data-printing]` marks the document while the dialog is up.
 */
export function printReport() {
  const root = document.documentElement
  const dark = root.classList.contains("dark")
  const scheme = root.style.colorScheme
  document.body.setAttribute("data-printing", "report")
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
