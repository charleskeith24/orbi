"use client"

import { useEffect, useState } from "react"

/**
 * The id of the section currently at the top of the viewport (the last one whose top has
 * scrolled past `offset`); the last section once the page is scrolled to the bottom.
 * `ids` and `ignore` must be stable (module-level) values; `ignore` skips an element for now
 * (e.g. a section that sits in a sticky side rail at wide breakpoints).
 */
export function useScrollSpy(ids: readonly string[], offset = 96, ignore?: (el: HTMLElement) => boolean): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const tracked = ids.filter((id) => {
        const el = document.getElementById(id)
        return el !== null && el.offsetParent !== null && !ignore?.(el)
      })
      let current = tracked[0] ?? null
      for (const id of tracked) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top - offset <= 0) current = id
      }
      const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (bottom && window.scrollY > 0) current = tracked[tracked.length - 1] ?? current
      setActive(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [ids, offset, ignore])

  return active
}

/** Smoothly scrolls a section into view (instant with reduced motion) and records it in the URL hash. */
export function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  window.history.replaceState(window.history.state, "", `#${id}`)
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
