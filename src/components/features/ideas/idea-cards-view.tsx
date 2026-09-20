"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import type { ContentIdea, ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { IdeaActionsMenu } from "./idea-actions-menu"
import { IdeaCard } from "./idea-card"
import type { IdeaLookups } from "./idea-table"
import { ideaBankMessages } from "./messages"

const PAGE_SIZE = 48

/** Card grid view — every card opens the detail sheet; "⋯" has the quick actions. */
export function IdeaCardsView({
  ideas,
  lookups,
  now,
  onOpen,
  empty,
  showStatus = true,
}: {
  ideas: ContentIdea[]
  lookups: IdeaLookups
  now: Date
  onOpen: (id: ID) => void
  empty: React.ReactNode
  /** Off when the list shows a single status (every chip would say the same). */
  showStatus?: boolean
}) {
  const t = useT(ideaBankMessages)
  const c = useT(commonMessages)
  const [limit, setLimit] = useState(PAGE_SIZE)
  if (!ideas.length) return <div className="rounded-lg border bg-card">{empty}</div>
  const shown = ideas.slice(0, limit)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ul aria-label={t("ideas")} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {shown.map((idea) => (
          <li key={idea.id} className="flex min-w-0">
            <IdeaCard
              idea={idea}
              pillar={idea.pillar_id ? lookups.pillars.get(idea.pillar_id) : undefined}
              format={idea.format_id ? lookups.formats.get(idea.format_id) : undefined}
              now={now}
              showStatus={showStatus}
              onOpen={onOpen}
              actions={<IdeaActionsMenu idea={idea} />}
              className="w-full"
            />
          </li>
        ))}
      </ul>
      {shown.length < ideas.length ? (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="num">{t("showing", { shown: formatNumber(shown.length), total: formatNumber(ideas.length) })}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            {c("show_more")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
