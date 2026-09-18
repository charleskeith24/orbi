"use client"

import { useMemo } from "react"
import { ColorDot, PlatformIcon, StageIcon, type FacetOption } from "@/components/common"
import { PLATFORM_IDS, PLATFORMS, STAGE_GROUPS } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { useLookup, useTable } from "@/lib/store"
import type { ContentItem, ISODate, PipelineStage, StageGroup } from "@/lib/types"
import { filterValue, NONE_KEY, trayGroupOf, type FilterKey, type Placement } from "./calendar-model"
import { calendarMessages } from "./messages"

/** A representative stage per roll-up group, for the Status filter glyphs. */
const GROUP_STAGE: Record<StageGroup, PipelineStage> = {
  idea: "idea",
  brief: "brief",
  script: "scripting",
  production: "recording",
  review: "review",
  ready: "ready_to_post",
  scheduled: "scheduled",
  published: "published",
}

/** Filter options for platform, pillar, goal, format and status, counted over what the period shows plus the tray. */
export function useCalendarFacets(dayDates: Date[], byDay: Map<ISODate, Placement[]>, items: ContentItem[]): Record<FilterKey, FacetOption[]> {
  const goals = useTable("content_goals")
  const formats = useTable("content_formats")
  const pillars = useLookup("content_pillars")
  const t = useT(calendarMessages)
  return useMemo(() => {
    const pool: ContentItem[] = []
    for (const date of dayDates) for (const p of byDay.get(toISODate(date)) ?? []) pool.push(p.item)
    for (const item of items) if (trayGroupOf(item)) pool.push(item)
    const counts = (key: FilterKey) => {
      const map = new Map<string, number>()
      for (const item of pool) {
        const value = filterValue(item, key)
        map.set(value, (map.get(value) ?? 0) + 1)
      }
      return map
    }
    const none = (map: Map<string, number>, label: string): FacetOption[] =>
      map.has(NONE_KEY) ? [{ value: NONE_KEY, label, count: map.get(NONE_KEY) }] : []
    const platform = counts("platform")
    const pillar = counts("pillar")
    const goal = counts("goal")
    const format = counts("format")
    const status = counts("status")
    return {
      platform: PLATFORM_IDS.filter((p) => platform.has(p)).map((p) => ({
        value: p,
        label: PLATFORMS[p].label,
        count: platform.get(p),
        icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
      })),
      pillar: [
        ...[...pillars.values()]
          .filter((p) => p.is_active || pillar.has(p.id))
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({ value: p.id, label: p.name || t("untitled_pillar"), count: pillar.get(p.id) ?? 0, icon: <ColorDot color={p.color} /> })),
        ...none(pillar, t("no_pillar")),
      ],
      goal: [
        ...goals.filter((g) => g.is_active || goal.has(g.id)).map((g) => ({ value: g.id, label: g.name || t("untitled_goal"), count: goal.get(g.id) ?? 0 })),
        ...none(goal, t("no_goal")),
      ],
      format: [
        ...formats
          .filter((f) => format.has(f.id))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((f) => ({ value: f.id, label: f.name || t("untitled_format"), count: format.get(f.id) })),
        ...none(format, t("no_format")),
      ],
      status: STAGE_GROUPS.map((g) => ({ value: g.id, label: g.label, count: status.get(g.id) ?? 0, icon: <StageIcon stage={GROUP_STAGE[g.id]} /> })),
    }
  }, [dayDates, byDay, items, pillars, goals, formats, t])
}
