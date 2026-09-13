"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useMemo, useSyncExternalStore } from "react"
import { parseDate, toISODate } from "@/lib/dates"
import { isCalendarView, shiftAnchor, type CalendarView } from "./calendar-model"

/* ------------------------- localStorage preferences ------------------------ */

const prefListeners = new Set<() => void>()

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode / storage full: the preference just isn't remembered.
  }
  prefListeners.forEach((l) => l())
}

function subscribePrefs(listener: () => void) {
  prefListeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    prefListeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

/** A string preference stored in localStorage (null until set). */
export function usePref(key: string): string | null {
  return useSyncExternalStore(
    subscribePrefs,
    () => readPref(key),
    () => null
  )
}

export const PREF_KEYS = {
  view: "pbos:calendar:view",
  slots: "pbos:calendar:slots",
  tray: "pbos:calendar:tray",
} as const

/* ---------------------------------- URL ----------------------------------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Merge changes into the current query string (read fresh, so rapid calls don't drop each other) through the
 * native History API — Next syncs `useSearchParams` without a server round trip.
 */
export function replaceSearchParams(mutate: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search)
  mutate(params)
  const query = params.toString()
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
}

export function useReplaceParams() {
  return replaceSearchParams
}

/**
 * Calendar position. URL: `?view=month|week|day&date=YYYY-MM-DD&open=<itemId>`; the view falls back to the
 * last one chosen (localStorage), the date to today.
 */
export function useCalendarNav(now: Date) {
  const searchParams = useSearchParams()
  const replaceParams = useReplaceParams()
  const storedView = usePref(PREF_KEYS.view)
  const viewParam = searchParams.get("view")
  const view: CalendarView = isCalendarView(viewParam) ? viewParam : isCalendarView(storedView) ? storedView : "month"
  const dateParam = searchParams.get("date")
  const todayKey = toISODate(now)
  const dateKey = dateParam && ISO_DATE.test(dateParam) && parseDate(dateParam) ? dateParam : todayKey
  const anchor = useMemo(() => parseDate(dateKey) ?? new Date(), [dateKey])
  const openId = searchParams.get("open")

  const setAnchor = useCallback(
    (date: Date) =>
      replaceParams((params) => {
        const key = toISODate(date)
        if (key === todayKey) params.delete("date")
        else params.set("date", key)
      }),
    [replaceParams, todayKey]
  )

  const setView = useCallback(
    (next: CalendarView) => {
      writePref(PREF_KEYS.view, next)
      replaceParams((params) => params.set("view", next))
    },
    [replaceParams]
  )

  /** Jump to one day in Day view (e.g. "+3 more") without changing the remembered view. */
  const openDay = useCallback(
    (date: Date) =>
      replaceParams((params) => {
        params.set("view", "day")
        params.set("date", toISODate(date))
      }),
    [replaceParams]
  )

  const shift = useCallback((step: number) => setAnchor(shiftAnchor(view, anchor, step)), [setAnchor, view, anchor])
  const goToday = useCallback(() => replaceParams((params) => params.delete("date")), [replaceParams])
  const clearOpen = useCallback(() => replaceParams((params) => params.delete("open")), [replaceParams])

  return { view, anchor, dateKey, isTodayAnchor: dateKey === todayKey, openId, setView, setAnchor, openDay, shift, goToday, clearOpen, replaceParams }
}
