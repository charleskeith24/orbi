"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { EMPTY_FACETS, FACET_KEYS, type FacetFilters, type FacetKey, type PipelineFilters } from "./board-model"

/**
 * Shallow URL update. Next syncs `useSearchParams` with the native History API (no server round trip);
 * `null` state lets Next copy its own history entry data.
 */
export function replaceSearchParams(edit: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search)
  edit(params)
  const query = params.toString()
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
}

/**
 * Facet filters live in the URL (`?platform=tiktok&campaign=<id>`) so cross-links can pre-filter the
 * board. The search text is local state (seeded from `?q=`) so typing never waits on a router transition.
 */
export function usePipelineFilters() {
  const searchParams = useSearchParams()
  const [q, setQ] = useState(() => searchParams.get("q") ?? "")

  const facets = useMemo<FacetFilters>(() => {
    const out: FacetFilters = { ...EMPTY_FACETS }
    for (const key of FACET_KEYS) out[key] = [...new Set(searchParams.getAll(key).filter(Boolean))]
    return out
  }, [searchParams])

  const filters = useMemo<PipelineFilters>(() => ({ ...facets, q }), [facets, q])

  const setFacet = useCallback((key: FacetKey, values: string[]) => {
    replaceSearchParams((params) => {
      params.delete(key)
      for (const value of values) params.append(key, value)
    })
  }, [])

  const reset = useCallback(() => {
    setQ("")
    replaceSearchParams((params) => {
      params.delete("q")
      for (const key of FACET_KEYS) params.delete(key)
    })
  }, [])

  return { filters, setQ, setFacet, reset }
}
