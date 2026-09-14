"use client"

import { Play } from "lucide-react"
import { SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { ContentPillar, ID } from "@/lib/types"
import { PillarIconTile } from "./pillar-icons"

/** Paused pillars: kept for history, outside the mix and targets. */
export function PausedPillars({
  pillars,
  onOpen,
  onActivate,
}: {
  pillars: ContentPillar[]
  onOpen: (id: ID) => void
  onActivate: (pillar: ContentPillar) => void
}) {
  if (!pillars.length) return null
  return (
    <SectionCard
      title="Paused pillars"
      description="Kept for history — they don't count toward your mix, targets or pickers."
      contentClassName="p-0"
    >
      <ul className="divide-y">
        {pillars.map((pillar) => (
          <li key={pillar.id} className="flex items-center gap-3 px-4 py-2.5">
            <PillarIconTile name={pillar.icon} color={pillar.color} size="sm" />
            <button
              type="button"
              onClick={() => onOpen(pillar.id)}
              className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="block truncate text-sm font-medium">{pillar.name || "Untitled pillar"}</span>
              <span className="block truncate text-xs text-muted-foreground">{pillar.description || "No description yet."}</span>
            </button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onActivate(pillar)}>
              <Play aria-hidden />
              Activate
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
