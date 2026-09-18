"use client"

import { Play } from "lucide-react"
import { SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import type { ContentPillar, ID } from "@/lib/types"
import { PillarIconTile } from "./pillar-icons"
import { pillarMessages } from "./pillar-messages"

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
  const t = useT(pillarMessages)
  if (!pillars.length) return null
  return (
    <SectionCard
      title={t("paused_title")}
      description={t("paused_section_description")}
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
              <span className="block truncate text-sm font-medium">{pillar.name || t("untitled_pillar")}</span>
              <span className="block truncate text-xs text-muted-foreground">{pillar.description || t("no_description")}</span>
            </button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onActivate(pillar)}>
              <Play aria-hidden />
              {t("activate")}
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
