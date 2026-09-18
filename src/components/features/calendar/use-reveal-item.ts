"use client"

import { useEffect, useEffectEvent } from "react"
import { toast } from "sonner"
import { toISODate } from "@/lib/dates"
import { translate } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { dataActions } from "@/lib/store"
import type { ID } from "@/lib/types"
import { placementOf, type CalendarView } from "./calendar-model"
import { calendarMessages } from "./messages"

/**
 * `?open=<itemId>`: bring the item's day into view (tray items open the tray through the view), focus it once
 * rendered, and clear the highlight on Escape or the next click elsewhere.
 */
export function useRevealItem({
  openId,
  view,
  dateKey,
  dayDates,
  clearOpen,
  replaceParams,
}: {
  openId: ID | null
  view: CalendarView
  dateKey: string
  dayDates: Date[]
  clearOpen: () => void
  replaceParams: (mutate: (params: URLSearchParams) => void) => void
}) {
  const reveal = useEffectEvent((id: ID) => {
    const item = dataActions.getDb().content_items.find((row) => row.id === id)
    if (!item) {
      toast.error(translate(calendarMessages, getUiLang(), "missing_item"), { id: "calendar-open-missing" })
      clearOpen()
      return
    }
    const placement = placementOf(item)
    if (placement && !dayDates.some((d) => toISODate(d) === placement.key)) {
      replaceParams((params) => params.set("date", placement.key))
    }
  })
  useEffect(() => {
    if (openId) reveal(openId)
  }, [openId])

  // Focus it once rendered (retried when the view or date changes).
  useEffect(() => {
    if (!openId) return
    let frames = 0
    let handle = 0
    const focus = () => {
      const node = document.querySelector<HTMLElement>(`[data-calendar-item="${CSS.escape(openId)}"]`)
      if (!node) {
        if (frames++ < 40) handle = requestAnimationFrame(focus)
        return
      }
      node.scrollIntoView({ block: "center" })
      node.querySelector<HTMLElement>("[data-card-link]")?.focus({ preventScroll: true })
    }
    handle = requestAnimationFrame(focus)
    return () => cancelAnimationFrame(handle)
  }, [openId, view, dateKey])

  useEffect(() => {
    if (!openId) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(`[data-calendar-item="${CSS.escape(openId)}"]`)) return
      clearOpen()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearOpen()
    }
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true)
      document.addEventListener("keydown", onKeyDown)
    }, 400)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [openId, clearOpen])
}
