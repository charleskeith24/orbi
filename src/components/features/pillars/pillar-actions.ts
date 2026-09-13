/** Pillar mutations shared by the card menu, the detail sheet and the page (toasts included). */
import { toast } from "sonner"
import type { PILLAR_PRESETS } from "@/lib/constants"
import { dataActions } from "@/lib/store"
import type { CategoricalColor, ContentPillar } from "@/lib/types"
import { activeTargetTotal, nextPillarColor, nextSortOrder, reorderPatches, TARGET_TOTAL } from "./pillar-math"

export type PillarPreset = (typeof PILLAR_PRESETS)[number]

export interface RebalanceHint {
  description?: string
  action?: { label: string; onClick: () => void }
}

/** Read after a change: nudges a rebalance (with a "Set targets" action) when active targets no longer total 100. */
export function rebalanceHint(onSetTargets?: () => void): RebalanceHint {
  const total = activeTargetTotal(dataActions.getDb().content_pillars)
  if (total === TARGET_TOTAL) return {}
  return {
    description: `Active targets now add up to ${total}% — rebalance them to 100%.`,
    action: onSetTargets ? { label: "Set targets", onClick: onSetTargets } : undefined,
  }
}

/** Swap with the neighbouring pillar (visually obvious, so no toast). */
export function movePillar(id: string, direction: -1 | 1): void {
  const patches = reorderPatches(dataActions.getDb().content_pillars, id, direction)
  if (patches.length) dataActions.updateMany("content_pillars", patches)
}

export function setPillarActive(pillar: ContentPillar, active: boolean, onSetTargets?: () => void): void {
  dataActions.update("content_pillars", pillar.id, { is_active: active })
  const hint = rebalanceHint(onSetTargets)
  toast.success(active ? `${pillar.name} is active again` : `${pillar.name} paused`, {
    description:
      hint.description ??
      (active ? "It counts toward your mix and targets again." : "Paused pillars leave the mix and targets but keep their history."),
    action: hint.action,
  })
}

/** Adds recommended pillars after the existing ones; preset colours already in use move to free slots. */
export function addPresetPillars(presets: PillarPreset[], onSetTargets?: () => void): ContentPillar[] {
  if (!presets.length) return []
  const existing = dataActions.getDb().content_pillars
  const used: { color: CategoricalColor }[] = existing.map((p) => ({ color: p.color }))
  const start = nextSortOrder(existing)
  const values = presets.map((preset, i) => {
    const color = used.some((u) => u.color === preset.color) ? nextPillarColor(used) : preset.color
    used.push({ color })
    return {
      name: preset.name,
      description: preset.description,
      color,
      icon: preset.icon,
      target_percentage: Math.round(preset.target_percentage),
      examples: [...preset.examples],
      sort_order: start + i,
      is_active: true,
    }
  })
  const rows = dataActions.insertMany("content_pillars", values)
  const hint = rebalanceHint(onSetTargets)
  toast.success(rows.length === 1 ? `${rows[0].name} pillar added` : `${rows.length} recommended pillars added`, {
    description: hint.description,
    action: hint.action,
  })
  return rows
}
