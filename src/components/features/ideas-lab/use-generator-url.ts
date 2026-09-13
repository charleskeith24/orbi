"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import {
  GENERATOR_PARAM_KEYS,
  parseBriefParams,
  writeBriefParams,
  type BriefDb,
  type GeneratorBrief,
  type ParsedBrief,
} from "./generator-model"

interface UrlState {
  seen: string
  /** URLs this hook wrote and hasn't seen come back through `useSearchParams` yet. */
  pending: string[]
  parsed: ParsedBrief
  /** Bumps when the URL changes from outside (a link to `/ideas/generator?…&run=1` while the page is open). */
  nonce: number
}

/**
 * The brief in the URL. `write` mirrors a brief to the URL (and drops `run=1`) without that counting
 * as an outside navigation; anything else that changes the query re-parses it and bumps `nonce`.
 */
export function useGeneratorUrl(db: BriefDb) {
  const searchParams = useSearchParams()
  const key = searchParams.toString()
  const [state, setState] = useState<UrlState>(() => ({ seen: key, pending: [], parsed: parseBriefParams(searchParams, db), nonce: 0 }))

  if (key !== state.seen) {
    const index = state.pending.indexOf(key)
    if (index >= 0) setState({ ...state, seen: key, pending: state.pending.slice(index + 1) })
    else setState({ seen: key, pending: [], parsed: parseBriefParams(searchParams, db), nonce: state.nonce + 1 })
  }

  const write = useCallback((brief: GeneratorBrief | null) => {
    const current = new URLSearchParams(window.location.search)
    const params = new URLSearchParams(current)
    if (brief) writeBriefParams(params, brief)
    else for (const k of GENERATOR_PARAM_KEYS) params.delete(k)
    const next = params.toString()
    if (next === current.toString()) return
    setState((s) => ({ ...s, pending: [...s.pending, next] }))
    window.history.replaceState(null, "", `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`)
  }, [])

  return { parsed: state.parsed, nonce: state.nonce, write }
}
