"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { defaultFilters, parseFilters, writeFilters, type AnalyticsFilters, type FilterDefaults } from "./filters"

/** A stable "now" for the life of the view (analytics are memoised per calendar day). */
export function useNow(): Date {
  const [now] = useState(() => new Date())
  return now
}

/** The query string plus an in-place updater (replace, no scroll jump, no history entry). */
export function useUrlParams() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString())
      mutate(next)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, pathname, router]
  )
  return { params, update }
}

/** Analytics filter row state, kept in the URL. `defaults` must be a module-level constant. */
export function useAnalyticsFilters(defaults: FilterDefaults) {
  const { params, update } = useUrlParams()
  const filters = useMemo(() => parseFilters(params, defaults), [params, defaults])
  const setFilters = useCallback(
    (patch: Partial<AnalyticsFilters>) => update((next) => writeFilters(next, { ...filters, ...patch }, defaults)),
    [filters, update, defaults]
  )
  /** Clears the filter row plus any page-specific `extraKeys`. */
  const resetFilters = useCallback(
    (extraKeys: string[] = []) =>
      update((next) => {
        writeFilters(next, defaultFilters(defaults), defaults)
        for (const key of extraKeys) next.delete(key)
      }),
    [update, defaults]
  )
  return { filters, setFilters, resetFilters, params, update }
}
