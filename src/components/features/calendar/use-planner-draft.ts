"use client"

import { useEffect, useState } from "react"
import type { AiProviderId, ID, ISODate } from "@/lib/types"
import type { PlanPick } from "./planner-model"

/** The Weekly Planner's work in progress for one week (kept in this browser so a refresh loses nothing). */
export interface PlannerDraft {
  version: 1
  weekStart: ISODate
  /** 0-based step index. */
  step: number
  focus: string
  picks: PlanPick[]
  /** Engine that drafted steps 4–6, when "Draft the plan with AI" was used. */
  aiProvider: AiProviderId | null
  aiModel: string | null
  /** Content items created on step 7 (the brief step lists them). */
  createdItemIds: ID[]
}

const keyFor = (weekStart: ISODate) => `pbos:planner:${weekStart}`

function isPick(value: unknown): value is PlanPick {
  if (!value || typeof value !== "object") return false
  const pick = value as Partial<PlanPick>
  return typeof pick.key === "string" && Boolean(pick.source) && typeof pick.source === "object" && Array.isArray(pick.entries)
}

export function emptyDraft(weekStart: ISODate, focus = ""): PlannerDraft {
  return { version: 1, weekStart, step: 0, focus, picks: [], aiProvider: null, aiModel: null, createdItemIds: [] }
}

export function loadDraft(weekStart: ISODate): PlannerDraft | null {
  try {
    const raw = window.localStorage.getItem(keyFor(weekStart))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PlannerDraft> | null
    if (!parsed || parsed.version !== 1 || parsed.weekStart !== weekStart) return null
    return {
      ...emptyDraft(weekStart),
      step: typeof parsed.step === "number" ? Math.min(6, Math.max(0, Math.round(parsed.step))) : 0,
      focus: typeof parsed.focus === "string" ? parsed.focus : "",
      picks: Array.isArray(parsed.picks) ? parsed.picks.filter(isPick) : [],
      aiProvider: parsed.aiProvider ?? null,
      aiModel: parsed.aiModel ?? null,
      createdItemIds: Array.isArray(parsed.createdItemIds) ? parsed.createdItemIds.filter((id): id is ID => typeof id === "string") : [],
    }
  } catch {
    return null
  }
}

/** Draft state for a week, persisted to localStorage on every change. Mount one per week (key by week). */
export function usePlannerDraft(weekStart: ISODate, initial: () => PlannerDraft) {
  const [draft, setDraft] = useState<PlannerDraft>(() => loadDraft(weekStart) ?? initial())
  useEffect(() => {
    try {
      window.localStorage.setItem(keyFor(weekStart), JSON.stringify(draft))
    } catch {
      // Storage unavailable: the draft just isn't remembered.
    }
  }, [draft, weekStart])
  return [draft, setDraft] as const
}
