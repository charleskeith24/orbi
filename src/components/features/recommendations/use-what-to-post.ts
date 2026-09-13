"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useNow } from "@/components/features/today/use-now"
import { buildWhatToPostInput, useAiTask } from "@/lib/ai"
import { recommendNextContent } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { convertIdeaToContent, dataActions, ensureBrief, useDb, useSettings } from "@/lib/store"
import type { ID, UpdateRow } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { fromAiOutput, fromRecommendation, type Suggestion, type SuggestionEdit, type SuggestionLookups } from "./suggestion"

export type SuggestionMode = "engine" | "ai"

/** Candidates the engine ranks (and the AI chooses from). */
const CANDIDATES = 6

/** A brief CTA is only overwritten when it's empty or the creator chose this one. */
function applyCta(itemId: ID, cta: string, force: boolean) {
  if (!cta) return
  const brief = ensureBrief(itemId)
  const current = brief.cta.trim()
  if (current === cta || (current && !force)) return
  dataActions.update("content_briefs", brief.id, { cta })
}

/**
 * State and actions behind <WhatToPost>: the deterministic ranking, the optional AI refinement
 * (the engine pick stays visible until the AI answers), cycling, inline edits and "Create this content".
 */
export function useWhatToPost() {
  const router = useRouter()
  const db = useDb()
  const settings = useSettings()
  const now = useNow()
  const ai = useAiTask("what_to_post")
  const [mode, setMode] = useState<SuggestionMode>("engine")
  const [index, setIndex] = useState(0)
  const [edits, setEdits] = useState<Record<string, SuggestionEdit>>({})

  const lookups = useMemo<SuggestionLookups>(
    () => ({
      formats: new Map(db.content_formats.map((f) => [f.id, f])),
      angles: new Map(db.angles.map((a) => [a.id, a])),
      ideas: new Map(db.content_ideas.map((i) => [i.id, i])),
      items: new Map(db.content_items.map((i) => [i.id, i])),
    }),
    [db.content_formats, db.angles, db.content_ideas, db.content_items]
  )
  const engine = useMemo(
    () => recommendNextContent(db, now, settings, { limit: CANDIDATES }).map((rec) => fromRecommendation(rec, lookups)),
    [db, now, settings, lookups]
  )
  const aiList = useMemo(() => (ai.data ? fromAiOutput(ai.data, engine, lookups) : []), [ai.data, engine, lookups])

  const activeMode: SuggestionMode = mode === "ai" && aiList.length ? "ai" : "engine"
  const list = activeMode === "ai" ? aiList : engine
  const position = list.length ? Math.min(index, list.length - 1) : 0
  const current: Suggestion | null = list[position] ?? null
  const editKey = current ? `${activeMode}:${current.key}` : ""
  const edit = current ? edits[editKey] : undefined

  async function refine() {
    const input = buildWhatToPostInput(dataActions.getDb(), new Date())
    if (!input.candidates.length) return
    const result = await ai.run(input)
    if (!result) return
    setMode("ai")
    setIndex(0)
    setEdits({})
  }

  function next() {
    if (list.length > 1) setIndex((position + 1) % list.length)
  }

  function select(i: number) {
    setIndex(Math.max(0, Math.min(i, list.length - 1)))
  }

  function showEngine() {
    setMode("engine")
    setIndex(0)
  }

  function updateEdit(patch: SuggestionEdit) {
    if (!editKey) return
    setEdits((all) => ({ ...all, [editKey]: { ...all[editKey], ...patch } }))
  }

  /** Idea → one item on the recommended platform (format, angle, hook and CTA carried over) → Studio; item → Studio. */
  function create(s: Suggestion) {
    const hook = (edit?.hook ?? s.hook).trim()
    const cta = (edit?.cta ?? s.cta).trim()
    try {
      if (s.kind === "idea") {
        const [item] = convertIdeaToContent(s.id, { platforms: [s.platform] })
        if (!item) throw new Error("Nothing was created.")
        const patch: UpdateRow<"content_items"> = {}
        if (!item.format_id && s.formatId) patch.format_id = s.formatId
        if (!item.angle_id && s.angleId) patch.angle_id = s.angleId
        if (hook && hook !== item.hook) patch.hook = hook
        if (Object.keys(patch).length) dataActions.update("content_items", item.id, patch)
        applyCta(item.id, cta, true)
        toast.success("Content created", {
          description: `${truncate(item.title, 60)} · ${PLATFORMS[item.platform]?.label ?? item.platform}`,
        })
        router.push(`/studio/${item.id}`)
        return
      }
      const item = dataActions.getDb().content_items.find((i) => i.id === s.id)
      if (!item) throw new Error("That content no longer exists.")
      const patch: UpdateRow<"content_items"> = {}
      if (!item.format_id && s.formatId) patch.format_id = s.formatId
      if (!item.angle_id && s.angleId) patch.angle_id = s.angleId
      if (hook && hook !== item.hook && (edit?.hook !== undefined || !item.hook.trim())) patch.hook = hook
      if (Object.keys(patch).length) {
        dataActions.update("content_items", item.id, patch)
        toast.success("Suggestion applied", { description: `${truncate(item.title, 60)} · missing details filled in` })
      }
      applyCta(item.id, cta, edit?.cta !== undefined)
      router.push(`/studio/${item.id}`)
    } catch (error) {
      toast.error("Couldn't create the content", { description: error instanceof Error ? error.message : String(error) })
    }
  }

  return {
    list,
    current,
    position,
    mode: activeMode,
    edit,
    ai,
    canRefine: engine.length > 0,
    refine,
    next,
    select,
    showEngine,
    updateEdit,
    create,
  }
}

export type WhatToPostState = ReturnType<typeof useWhatToPost>
