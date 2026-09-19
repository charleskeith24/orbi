"use client"

import { useCallback, useEffect, useEffectEvent, useState } from "react"

export interface AdminResource<T> {
  /** The last loaded value — kept while a reload or a new key loads, so screens don't blank out. */
  data: T | null
  error: unknown
  /** True until the load for the current key (and reload count) has finished. */
  loading: boolean
  reload: () => void
  /** Local update after a mutation (e.g. replace one row with the server's answer). */
  update: (updater: (data: T) => T) => void
}

/** Loads `load()` for `key`, again whenever `key` changes or `reload()` is called. */
export function useAdminResource<T>(key: string, load: () => Promise<T>): AdminResource<T> {
  const [nonce, setNonce] = useState(0)
  const [result, setResult] = useState<{ key: string; data: T | null; error: unknown } | null>(null)
  const requestKey = `${key}#${nonce}`
  const run = useEffectEvent(() => load())

  useEffect(() => {
    let active = true
    run().then(
      (data) => {
        if (active) setResult({ key: requestKey, data, error: null })
      },
      (error: unknown) => {
        if (active) setResult((prev) => ({ key: requestKey, data: prev?.data ?? null, error }))
      }
    )
    return () => {
      active = false
    }
  }, [requestKey])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const update = useCallback((updater: (data: T) => T) => {
    setResult((prev) => (prev && prev.data !== null ? { ...prev, data: updater(prev.data) } : prev))
  }, [])

  return {
    data: result?.data ?? null,
    error: result?.key === requestKey ? result.error : null,
    loading: result?.key !== requestKey,
    reload,
    update,
  }
}
