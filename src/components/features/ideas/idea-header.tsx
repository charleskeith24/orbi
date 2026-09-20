"use client"

import { IDEA_STATUS_ICONS } from "@/components/common"
import { IDEA_STATUSES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { IdeaStatus } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { SHORT_STATUS_LABEL } from "./idea-badges"
import { ACTIVE_STATUSES, ALL_STATUSES, sameSet } from "./idea-model"
import { ideaBankMessages } from "./messages"

const TAB =
  "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-muted aria-pressed:text-foreground dark:aria-pressed:bg-input/50"

function Count({ n, on }: { n: number; on: boolean }) {
  return <span className={cn("font-medium num", on || n ? "text-foreground" : "text-muted-foreground")}>{formatNumber(n)}</span>
}

/**
 * The status filter as one quiet row of counts (Calm UI): Active (the default — everything but converted and
 * archived), each status on its own, or All. Counts follow the search and facet filters, so the pressed tab's
 * number is what the list shows. A mixed set (from a link or the Kanban's hidden columns) leaves no tab pressed.
 */
export function IdeaStatusTabs({
  counts,
  value,
  onChange,
  className,
}: {
  counts: Record<IdeaStatus, number>
  value: IdeaStatus[]
  onChange: (next: IdeaStatus[]) => void
  className?: string
}) {
  const t = useT(ideaBankMessages)
  const total = (statuses: IdeaStatus[]) => statuses.reduce((acc, s) => acc + (counts[s] ?? 0), 0)
  const only = value.length === 1 ? value[0] : null
  const activeOn = sameSet(value, ACTIVE_STATUSES)
  const allOn = sameSet(value, ALL_STATUSES)

  return (
    <div role="group" aria-label={t("by_status")} className={cn("scrollbar-none -mx-1 min-w-0 overflow-x-auto px-1", className)}>
      <div className="flex w-max items-center gap-0.5">
        <button type="button" aria-pressed={activeOn} title={t("status_active_description")} onClick={() => onChange(ACTIVE_STATUSES)} className={TAB}>
          {t("status_active")}
          <Count n={total(ACTIVE_STATUSES)} on={activeOn} />
        </button>
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        {IDEA_STATUSES.map((status) => {
          const Icon = IDEA_STATUS_ICONS[status.id]
          const pressed = only === status.id
          return (
            <button
              key={status.id}
              type="button"
              aria-pressed={pressed}
              title={`${status.label} — ${status.description}`}
              onClick={() => onChange(pressed ? ACTIVE_STATUSES : [status.id])}
              className={TAB}
            >
              <Icon className="size-3.5" aria-hidden />
              {SHORT_STATUS_LABEL[status.id]}
              <Count n={counts[status.id] ?? 0} on={pressed} />
            </button>
          )
        })}
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        <button type="button" aria-pressed={allOn} onClick={() => onChange(ALL_STATUSES)} className={TAB}>
          {t("status_all")}
          <Count n={total(ALL_STATUSES)} on={allOn} />
        </button>
      </div>
    </div>
  )
}
