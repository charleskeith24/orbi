"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { managedKey, parseIdeaBankState, writeIdeaBankState, type IdeaBankState } from "./idea-model"

/** Shallow URL update — Next syncs `useSearchParams` with the History API (no server round trip). */
function replaceUrl(params: URLSearchParams) {
  const query = params.toString()
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`)
}

/**
 * The Idea Bank's view, sort, filters, search and open sheet. Local state is the source of truth
 * (so typing and quick toggles never wait on a router transition) and every change is mirrored to
 * the URL. A URL change this hook didn't write — a ⌘K result like `/ideas?q=Pricing` or
 * `/ideas?open=<id>` while already on the page — replaces the state.
 */
export function useIdeaBankState() {
  const searchParams = useSearchParams()
  const urlKey = managedKey(searchParams)
  const [state, setState] = useState<IdeaBankState>(() => parseIdeaBankState(searchParams))
  const [sync, setSync] = useState<{ seen: string; pending: string[] }>({ seen: urlKey, pending: [] })
  // Latest state for `update`, so callbacks captured earlier (toast actions) never apply stale filters.
  const latest = useRef(state)

  if (urlKey !== sync.seen) {
    const index = sync.pending.indexOf(urlKey)
    if (index >= 0) {
      setSync({ seen: urlKey, pending: sync.pending.slice(index + 1) })
    } else {
      setSync({ seen: urlKey, pending: [] })
      setState(parseIdeaBankState(searchParams))
    }
  }

  useEffect(() => {
    latest.current = state
  }, [state])

  const update = useCallback((patch: Partial<IdeaBankState>) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setState(next)
    const params = new URLSearchParams(window.location.search)
    const before = managedKey(params)
    writeIdeaBankState(params, next)
    const after = managedKey(params)
    if (after === before) return
    setSync((s) => ({ ...s, pending: [...s.pending, after] }))
    replaceUrl(params)
  }, [setState, setSync])

  return { state, update }
}
