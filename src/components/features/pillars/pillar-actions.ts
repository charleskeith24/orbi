/** Pillar mutations shared by the card menu, the detail sheet and the page (toasts included). */
import { toast } from "sonner"
import type { PILLAR_PRESETS } from "@/lib/constants"
import { translator } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { dataActions } from "@/lib/store"
import type { CategoricalColor, ContentPillar } from "@/lib/types"
import { activeTargetTotal, nextPillarColor, nextSortOrder, reorderPatches, TARGET_TOTAL } from "./pillar-math"
import { pillarMessages } from "./pillar-messages"

const tr = () => translator(pillarMessages, getUiLang())

export type PillarPreset = (typeof PILLAR_PRESETS)[number]

export interface RebalanceHint {
  description?: string
  action?: { label: string; onClick: () => void }
}

/** Read after a change: nudges a rebalance (with a "Set targets" action) when active targets no longer total 100. */
export function rebalanceHint(onSetTargets?: () => void): RebalanceHint {
  const total = activeTargetTotal(dataActions.getDb().content_pillars)
  if (total === TARGET_TOTAL) return {}
  const t = tr()
  return {
    description: t("rebalance_hint", { total }),
    action: onSetTargets ? { label: t("set_targets"), onClick: onSetTargets } : undefined,
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
  const t = tr()
  toast.success(active ? t("active_again", { name: pillar.name }) : t("paused_toast", { name: pillar.name }), {
    description: hint.description ?? (active ? t("active_again_description") : t("paused_description")),
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
  const t = tr()
  toast.success(rows.length === 1 ? t("preset_added", { name: rows[0].name }) : t("presets_added", { count: rows.length }), {
    description: hint.description,
    action: hint.action,
  })
  return rows
}
