/**
 * Browser entry for opt-in usage analytics — online version only, off by default, per device.
 *
 * `trackUsage` is safe to call from anywhere: it does nothing on the server, in local mode, before
 * the workspace has loaded, or when this device hasn't opted in (Feedback dialog → "Share anonymous
 * usage data"). Events carry names, enum props and normalised paths only (see ./events.ts).
 * Batches go to POST /api/events; whatever is waiting is flushed when the page is hidden.
 */
import { useDataStore } from "@/lib/store/data-store"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createTelemetry, type SendResult } from "./client"
import { getUsageConsent, setUsageConsent } from "./consent"
import type { UsageEventName, UsageEventRow, UsageProps } from "./events"

export { getUsageConsent, subscribeUsageConsent, USAGE_CONSENT_KEY } from "./consent"
export { moduleForPath, normalizePath, type UsageEventName } from "./events"

const SESSION_KEY = "pbos:usage-session"
let memorySession = ""

function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID().replace(/-/g, "")
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

/** One random id per browser tab (survives reloads), so events from one visit group together. */
function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = randomToken()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    memorySession ||= randomToken()
    return memorySession
  }
}

/** Online version with a loaded workspace — the Supabase adapter only loads for a signed-in user. */
export function isOnlineWorkspace(): boolean {
  if (!isSupabaseConfigured) return false
  const { mode, status } = useDataStore.getState()
  return mode === "supabase" && status === "ready"
}

async function sendEvents(events: UsageEventRow[], { keepalive }: { keepalive: boolean }): Promise<SendResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "retry"
  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
    credentials: "same-origin",
    keepalive,
  })
  if (response.ok) return "ok"
  // 429 / 5xx may pass; 400 (rejected), 401 (signed out) and 501 (not configured) won't.
  return response.status === 429 || response.status >= 500 ? "retry" : "drop"
}

export const telemetry = createTelemetry({
  send: sendEvents,
  isEnabled: () => typeof window !== "undefined" && getUsageConsent() && isOnlineWorkspace(),
  getPath: () => (typeof window !== "undefined" ? window.location.pathname : "/"),
  getSessionId,
})

let listening = false
function flushOnPageHide() {
  if (listening || typeof window === "undefined") return
  listening = true
  const flush = () => void telemetry.flush({ keepalive: true })
  window.addEventListener("pagehide", flush)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush()
  })
}

/** Records one usage event (no-op unless the online version is in use and this device opted in). */
export function trackUsage(name: UsageEventName, props?: UsageProps, context?: { path?: string }): void {
  if (telemetry.track(name, props, context)) flushOnPageHide()
}

export interface OnboardingStepProps {
  /** Step key, e.g. "hilig" or "strategy". */
  step: string
  /** Position in the flow (0-based). */
  index: number
  /** Wizard mode: first | rerun | niche. */
  mode: string
  /** Onboarding language: english | taglish. */
  lang: string
}

/** Onboarding funnel: a step was shown, or completed with Continue. */
export function trackOnboardingStep(kind: "viewed" | "completed", props: OnboardingStepProps): void {
  trackUsage(kind === "viewed" ? "onboarding_step_viewed" : "onboarding_step_completed", { ...props })
}

/** Turns usage sharing on or off for this device. Turning it off also drops anything not yet sent. */
export function setUsageAnalytics(on: boolean): void {
  setUsageConsent(on)
  if (!on) telemetry.clear()
}
