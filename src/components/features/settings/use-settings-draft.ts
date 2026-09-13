"use client"

import { useCallback, useMemo, useState } from "react"
import { useSettings } from "@/lib/store"
import type { AppSettings } from "@/lib/types"

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

export interface SettingsDraft<T extends object> {
  /** The saved settings, mapped into form values. */
  saved: T
  /** Saved values with unsaved edits applied. */
  values: T
  dirty: boolean
  set: <K extends keyof T>(key: K, value: T[K]) => void
  /** Replace every value (e.g. "Reset to defaults") — still a draft until saved. */
  replace: (values: T) => void
  discard: () => void
}

/**
 * Draft state for one settings section. `select` maps the settings row to form values and must be
 * stable (a module-level function). Edits survive tab switches because the view owns the draft.
 */
export function useSettingsDraft<T extends object>(select: (settings: AppSettings) => T): SettingsDraft<T> {
  const settings = useSettings()
  const saved = useMemo(() => select(settings), [select, settings])
  const [edits, setEdits] = useState<Partial<T>>({})
  const values = useMemo(() => ({ ...saved, ...edits }) as T, [saved, edits])
  const dirty = useMemo(() => (Object.keys(edits) as (keyof T)[]).some((key) => !sameValue(edits[key], saved[key])), [edits, saved])

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setEdits((current) => ({ ...current, [key]: value }))
  }, [])
  const replace = useCallback((next: T) => setEdits({ ...next }), [])
  const discard = useCallback(() => setEdits({}), [])

  return { saved, values, dirty, set, replace, discard }
}

/** True when two form-value objects hold the same data. */
export function sameValues<T extends object>(a: T, b: T): boolean {
  return (Object.keys(a) as (keyof T)[]).every((key) => sameValue(a[key], b[key]))
}
