"use client"

import { useSyncExternalStore } from "react"

const TICK_MS = 60_000
let current = new Date()
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    // A module that sat idle (client navigation back to the Studio) must not serve an old clock.
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

/** `now` for analytics and relative dates — refreshed once a minute, stable in between. */
export function useNow(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
