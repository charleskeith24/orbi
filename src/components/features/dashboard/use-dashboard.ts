"use client"

import { useEffect, useMemo, useState } from "react"
import { useUiLang } from "@/lib/i18n"
import { useDb, useSettings } from "@/lib/store"
import { computeDashboard } from "./dashboard-data"

/** One shared clock for the whole dashboard, ticking every `intervalMs` so "today" stays true. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** All dashboard analytics, recomputed only when the workspace or the clock changes. */
export function useDashboardData() {
  const db = useDb()
  const settings = useSettings()
  const now = useNow()
  const lang = useUiLang()
  return useMemo(() => computeDashboard(db, settings, now, lang), [db, settings, now, lang])
}
