"use client"

import { useMemo } from "react"
import { pillarMix, pillarPerformance, type PillarAggregate, type PillarMix, type PillarMixRow } from "@/lib/analytics"
import { useUiLang } from "@/lib/i18n"
import { useDb, useSettings } from "@/lib/store"
import type { ContentPillar } from "@/lib/types"
import { sortPillars } from "./pillar-math"

export interface PillarStats {
  pillar: ContentPillar
  /** Share vs target in the window (active pillars only). */
  mix: PillarMixRow | null
  /** Published performance in the window (null when nothing was published). */
  perf: PillarAggregate | null
}

export interface PillarOverview {
  mix: PillarMix
  /** "No pillar" performance row, when published posts lack a pillar. */
  unassignedPerf: PillarAggregate | null
  all: PillarStats[]
  active: PillarStats[]
  paused: PillarStats[]
}

/** Pillars in display order with their mix row and performance for the trailing `days`. */
export function usePillarOverview(days: number, now: Date): PillarOverview {
  const db = useDb()
  const settings = useSettings()
  const lang = useUiLang()
  return useMemo(() => {
    const mix = pillarMix(db, now, settings, { days, lang })
    const perf = pillarPerformance(db, now, { days, settings, lang })
    const mixById = new Map(mix.rows.map((r) => [r.pillar.id, r]))
    const perfById = new Map<string, PillarAggregate>()
    for (const row of perf) if (row.pillar) perfById.set(row.pillar.id, row)
    const all = sortPillars(db.content_pillars).map((pillar) => ({
      pillar,
      mix: mixById.get(pillar.id) ?? null,
      perf: perfById.get(pillar.id) ?? null,
    }))
    return {
      mix,
      unassignedPerf: perf.find((row) => !row.pillar) ?? null,
      all,
      active: all.filter((s) => s.pillar.is_active),
      paused: all.filter((s) => !s.pillar.is_active),
    }
  }, [db, now, settings, days, lang])
}
