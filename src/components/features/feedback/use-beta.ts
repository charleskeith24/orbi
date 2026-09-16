"use client"

import { useSyncExternalStore } from "react"
import { useDataStatus } from "@/lib/store"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getUsageConsent, subscribeUsageConsent } from "@/lib/telemetry"

/**
 * The online version (Supabase configured). Inside the app shell that always means a signed-in
 * user — the data provider sends everyone else to /login — and the API re-checks the session.
 * Deliberately not tied to the load state, so the dialog never shows the local-mode copy while
 * the cloud workspace is still loading.
 */
export function useIsOnlineVersion(): boolean {
  return isSupabaseConfigured
}

/** A signed-in user's cloud workspace is loaded (what usage analytics wait for). */
export function useOnlineWorkspaceReady(): boolean {
  const { mode, status } = useDataStatus()
  return isSupabaseConfigured && mode === "supabase" && status === "ready"
}

/** This device's usage-analytics choice (off by default and during server rendering). */
export function useUsageConsent(): boolean {
  return useSyncExternalStore(subscribeUsageConsent, getUsageConsent, () => false)
}
