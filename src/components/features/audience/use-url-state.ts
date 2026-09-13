"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

export type UrlState<K extends string> = Record<K, string>

interface ParamReader {
  get(name: string): string | null
}

function readState<K extends string>(params: ParamReader, keys: readonly K[]): UrlState<K> {
  return Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ""])) as UrlState<K>
}

function keyOf(params: ParamReader, keys: readonly string[]): string {
  return keys.map((key) => `${key}=${params.get(key) ?? ""}`).join("&")
}

/**
 * Page state mirrored to the URL (`?open=`, `?tab=`, `?q=`, filters). Local state is the source of
 * truth so typing never waits on navigation; changes are written with `history.replaceState`, which
 * Next syncs into `useSearchParams`. A URL change this hook didn't write — a ⌘K result or a link to
 * the same page with other params — replaces the state. `keys` must be a module-level constant.
 */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const searchParams = useSearchParams()
  const urlKey = keyOf(searchParams, keys)
  const [state, setState] = useState<UrlState<K>>(() => readState(searchParams, keys))
  const [sync, setSync] = useState<{ seen: string; pending: string[] }>({ seen: urlKey, pending: [] })
  // Latest state for `update`, so callbacks captured earlier (toast actions) never write stale values.
  const latest = useRef(state)

  if (urlKey !== sync.seen) {
    const index = sync.pending.indexOf(urlKey)
    if (index >= 0) {
      setSync({ seen: urlKey, pending: sync.pending.slice(index + 1) })
    } else {
      setSync({ seen: urlKey, pending: [] })
      setState(readState(searchParams, keys))
    }
  }

  useEffect(() => {
    latest.current = state
  }, [state])

  const update = useCallback(
    (patch: Partial<UrlState<K>>) => {
      const next = { ...latest.current, ...patch } as UrlState<K>
      latest.current = next
      setState(next)
      const params = new URLSearchParams(window.location.search)
      const before = keyOf(params, keys)
      for (const key of keys) {
        const value = next[key]
        if (value) params.set(key, value)
        else params.delete(key)
      }
      const after = keyOf(params, keys)
      if (after === before) return
      setSync((s) => ({ ...s, pending: [...s.pending, after] }))
      const query = params.toString()
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`)
    },
    [keys, setState, setSync]
  )

  return [state, update] as const
}
