"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { useDataStore } from "@/lib/store"
import { moduleForPath, trackUsage } from "@/lib/telemetry"
import { detectKeyActions } from "@/lib/telemetry/store-watch"
import { useOnlineWorkspaceReady, useUsageConsent } from "./use-beta"

/**
 * Opt-in usage analytics for the app shell (mounted once by the top bar): module page views, and
 * key actions derived from workspace changes. Renders nothing; does nothing in local mode or until
 * this device opts in.
 */
export function UsageTracker() {
  const pathname = usePathname()
  const online = useOnlineWorkspaceReady()
  const consent = useUsageConsent()
  const active = online && consent

  useEffect(() => {
    if (active) trackUsage("page_viewed", { module: moduleForPath(pathname) }, { path: pathname })
  }, [active, pathname])

  useEffect(() => {
    if (!active) return
    return useDataStore.subscribe((state, prev) => {
      if (state.db === prev.db || state.status !== "ready" || prev.status !== "ready") return
      for (const action of detectKeyActions(prev.db, state.db)) trackUsage(action.name, action.props)
    })
  }, [active])

  return null
}
