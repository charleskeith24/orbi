"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { dataActions, ensureBrief, useTable } from "@/lib/store"
import type { ContentBrief, ID, UpdateRow } from "@/lib/types"

export const BRIEF_TEXT_KEYS = ["objective", "main_message", "cta", "visual_direction", "reference", "caption", "production_notes"] as const
export const BRIEF_LIST_KEYS = ["supporting_points", "b_roll", "on_screen_text"] as const
export const BRIEF_KEYS = [...BRIEF_TEXT_KEYS, ...BRIEF_LIST_KEYS] as const

export type BriefTextKey = (typeof BRIEF_TEXT_KEYS)[number]
export type BriefListKey = (typeof BRIEF_LIST_KEYS)[number]
export type BriefKey = BriefTextKey | BriefListKey
export type BriefDraft = Pick<ContentBrief, BriefKey>
export type SaveState = "idle" | "saving" | "saved"

export function isListKey(key: BriefKey): key is BriefListKey {
  return (BRIEF_LIST_KEYS as readonly string[]).includes(key)
}

function valuesOf(brief: ContentBrief | undefined): BriefDraft {
  return {
    objective: brief?.objective ?? "",
    main_message: brief?.main_message ?? "",
    cta: brief?.cta ?? "",
    visual_direction: brief?.visual_direction ?? "",
    reference: brief?.reference ?? "",
    caption: brief?.caption ?? "",
    production_notes: brief?.production_notes ?? "",
    supporting_points: brief?.supporting_points ?? [],
    b_roll: brief?.b_roll ?? [],
    on_screen_text: brief?.on_screen_text ?? [],
  }
}

const AUTOSAVE_MS = 700

/**
 * The item's brief as an editable draft that saves itself ~0.7s after the last keystroke
 * (and on unmount / ⌘S via `flush`). Creates the brief row on first save when it's missing.
 */
export function useBriefAutosave(itemId: ID) {
  const briefs = useTable("content_briefs")
  const brief = useMemo(() => briefs.find((b) => b.content_item_id === itemId), [briefs, itemId])
  const [draft, setDraft] = useState<BriefDraft>(() => valuesOf(brief))
  const [state, setState] = useState<SaveState>("idle")
  const [synced, setSynced] = useState(brief)
  const latest = useRef(draft)
  const pending = useRef(new Set<BriefKey>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Adopt changes made elsewhere (e.g. a teammate's tab, an import) while nothing is waiting to save.
  if (brief !== synced) {
    setSynced(brief)
    if (state !== "saving") setDraft(valuesOf(brief))
  }
  useEffect(() => {
    if (!pending.current.size) latest.current = draft
  }, [draft])

  const flush = useCallback((): boolean => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!pending.current.size) return false
    const patch = Object.fromEntries([...pending.current].map((key) => [key, latest.current[key]])) as UpdateRow<"content_briefs">
    pending.current.clear()
    dataActions.update("content_briefs", ensureBrief(itemId).id, patch)
    setState("saved")
    return true
  }, [itemId])

  const set = useCallback(
    <K extends BriefKey>(key: K, value: BriefDraft[K]) => {
      latest.current = { ...latest.current, [key]: value }
      pending.current.add(key)
      setDraft(latest.current)
      setState("saving")
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, AUTOSAVE_MS)
    },
    [flush]
  )

  /** For item fields saved immediately elsewhere in the brief (selects, title, hook). */
  const markSaved = useCallback(() => setState((s) => (s === "saving" ? s : "saved")), [])

  useEffect(() => () => void flush(), [flush])

  return { draft, set, flush, state, markSaved }
}
