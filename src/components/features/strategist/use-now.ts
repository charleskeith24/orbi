"use client"

import { useEffect, useState } from "react"

/** The current time, refreshed every `intervalMs`, so analytics get a stable `now` without reading the clock during render. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
