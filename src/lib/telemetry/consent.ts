/**
 * Per-device opt-in for usage analytics. Off by default; stored in this browser's localStorage,
 * never in the workspace, so each phone or laptop decides for itself. Storage failures (private
 * mode, blocked site data) read as "off".
 */
export const USAGE_CONSENT_KEY = "pbos:usage-analytics"

const listeners = new Set<() => void>()

export function getUsageConsent(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(USAGE_CONSENT_KEY) === "on"
  } catch {
    return false
  }
}

export function setUsageConsent(on: boolean): void {
  try {
    if (on) localStorage.setItem(USAGE_CONSENT_KEY, "on")
    else localStorage.removeItem(USAGE_CONSENT_KEY)
  } catch {
    // Storage unavailable: the choice can't be remembered, and "off" stays the answer.
  }
  for (const listener of listeners) listener()
}

/** For `useSyncExternalStore`: this tab's changes plus changes made in other tabs. */
export function subscribeUsageConsent(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === USAGE_CONSENT_KEY || event.key === null) listener()
  }
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage)
  }
}
