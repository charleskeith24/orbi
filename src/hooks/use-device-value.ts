import { useSyncExternalStore } from "react"

/**
 * Small per-device UI preferences in localStorage (a remembered disclosure, collapsed sidebar groups).
 * Never workspace data. Reads are SSR-safe (the server snapshot is `null`) and every write notifies all
 * hooks reading the same key; storage that throws (private mode, blocked site data) behaves as empty.
 */
const listeners = new Map<string, Set<() => void>>()

export function readDeviceValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeDeviceValue(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — the preference just isn't remembered.
  }
  listeners.get(key)?.forEach((listener) => listener())
}

export function useDeviceValue(key: string | null): string | null {
  return useSyncExternalStore(
    (listener) => {
      if (!key) return () => {}
      const set = listeners.get(key) ?? new Set()
      set.add(listener)
      listeners.set(key, set)
      return () => set.delete(listener)
    },
    () => (key ? readDeviceValue(key) : null),
    () => null
  )
}
