"use client"

import { useSyncExternalStore } from "react"

const TICK_MS = 60_000
let current = new Date()
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    // A module that sat idle (navigating back to the calendar) must not serve an old clock.
    if (Date.now() - current.getTime() > 5_000) current = new Date()
    timer = setInterval(() => {
      current = new Date()
      listeners.forEach((l) => l())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

const getSnapshot = () => current

/** `now` for date logic — refreshed once a minute and stable in between, so memoised views stay cached. */
export function useNow(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
