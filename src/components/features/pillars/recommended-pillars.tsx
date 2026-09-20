"use client"

import { Plus, Sparkles } from "lucide-react"
import { SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import type { PillarPreset } from "./pillar-actions"
import { PillarIconTile } from "./pillar-icons"
import { pillarMessages } from "./pillar-messages"

/** Recommended pillars (spec §6) that aren't in the workspace yet, one click to add. */
export function RecommendedPillars({ presets, onAdd }: { presets: PillarPreset[]; onAdd: (presets: PillarPreset[]) => void }) {
  const t = useT(pillarMessages)
  const c = useT(commonMessages)
  if (!presets.length) return null
  return (
    <SectionCard
      icon={Sparkles}
      title={t("recommended_title")}
      count={presets.length}
      info={t("recommended_description")}
      action={
        presets.length > 1 ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onAdd(presets)}>
            <Plus aria-hidden />
            {t("add_all", { count: presets.length })}
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
                <span className="num font-normal text-muted-foreground"> · {t("pct_target", { pct: preset.target_percentage })}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground" title={`${preset.description} — ${preset.examples.slice(0, 3).join(", ")}`}>
                {preset.description}
              </p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => onAdd([preset])} aria-label={t("add_preset", { name: preset.name })}>
              <Plus aria-hidden />
              {c("add")}
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
