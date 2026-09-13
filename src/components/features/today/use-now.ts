"use client"

import { useSyncExternalStore } from "react"

const TICK_MS = 60_000
let current = new Date()
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    // A module that sat idle (client navigation back to Today) must not serve an old clock;
    // React re-reads the snapshot after subscribing, so the fresh value renders right away.
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

/**
 * `now` for analytics and date labels on Today and the Content Decision Engine. Refreshed once a
 * minute (so the page rolls over at midnight) and stable in between, so memoised analytics stay cached.
 */
export function useNow(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
