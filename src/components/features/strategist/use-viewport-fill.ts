"use client"

import { useEffect } from "react"

/**
 * On wide screens, sizes an element to fill the viewport below its top edge — so a chat keeps its
 * composer on screen whatever sits above it (banners, wrapped headers). Below the breakpoint the
 * element keeps its natural height.
 */
export function useViewportFill(
  ref: React.RefObject<HTMLElement | null>,
  { bottom = 24, min = 480, query = "(min-width: 1024px)" }: { bottom?: number; min?: number; query?: string } = {}
) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const media = window.matchMedia(query)
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!media.matches) {
          element.style.height = ""
          return
        }
        const top = element.getBoundingClientRect().top + window.scrollY
        element.style.height = `${Math.max(min, Math.floor(window.innerHeight - top - bottom))}px`
      })
    }
    update()
    // Content above can change height (a dismissed banner, a wrapping header) — the body resizes with it.
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    window.addEventListener("resize", update)
    media.addEventListener("change", update)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", update)
      media.removeEventListener("change", update)
      element.style.height = ""
    }
  }, [ref, bottom, min, query])
}
