"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"

/** Shallow URL update — Next keeps `useSearchParams` in sync with the History API (no server round trip). */
export function replaceSearchParams(mutate: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search)
  mutate(params)
  const query = params.toString()
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`)
}

/**
 * `?open=<id>` for list pages: the row whose detail sheet is open. Local state updates instantly and is
 * mirrored to the URL; a navigation that changes `?open=` (⌘K, a cross-link) replaces it.
 */
export function useOpenParam(): [string | null, (id: string | null) => void] {
  const searchParams = useSearchParams()
  const urlOpen = searchParams.get("open") || null
  const [seen, setSeen] = useState(urlOpen)
  const [open, setOpenState] = useState(urlOpen)
  if (urlOpen !== seen) {
    setSeen(urlOpen)
    setOpenState(urlOpen)
  }

  const setOpen = useCallback((id: string | null) => {
    setOpenState(id)
    replaceSearchParams((params) => {
      if (id) params.set("open", id)
      else params.delete("open")
    })
  }, [])

  return [open, setOpen]
}
