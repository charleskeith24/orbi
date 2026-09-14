"use client"

import { Plus, Sparkles } from "lucide-react"
import { SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { PillarPreset } from "./pillar-actions"
import { PillarIconTile } from "./pillar-icons"

/** Recommended pillars (spec §6) that aren't in the workspace yet, one click to add. */
export function RecommendedPillars({ presets, onAdd }: { presets: PillarPreset[]; onAdd: (presets: PillarPreset[]) => void }) {
  if (!presets.length) return null
  return (
    <SectionCard
      icon={Sparkles}
      title="Recommended pillars"
      description="Most personal brands balance these themes. Add the ones you're missing — rename or retarget them anytime."
      action={
        presets.length > 1 ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onAdd(presets)}>
            <Plus aria-hidden />
            Add all {presets.length}
          </Button>
        ) : null
      }
      contentClassName="p-0"
    >
      <ul className="divide-y">
        {presets.map((preset) => (
          <li key={preset.name} className="flex items-center gap-3 px-4 py-2.5">
            <PillarIconTile name={preset.icon} color={preset.color} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {preset.name}
                <span className="num font-normal text-muted-foreground"> · {preset.target_percentage}% target</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {preset.description} — {preset.examples.slice(0, 3).join(", ")}
              </p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => onAdd([preset])} aria-label={`Add the ${preset.name} pillar`}>
              <Plus aria-hidden />
              Add
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
