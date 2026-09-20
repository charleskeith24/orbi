"use client"

import { Meter } from "@/components/common"
import { useT } from "@/lib/i18n"
import { formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { MixStatusPill } from "./mix-status"
import { PillarActionsMenu } from "./pillar-actions-menu"
import { PillarIconTile } from "./pillar-icons"
import { pillarMessages } from "./pillar-messages"
import type { PillarStats } from "./use-pillar-overview"

/** Visual pillar card: identity, actual vs target share and published performance (description and examples live in the detail sheet). */
export function PillarCard({
  stats,
  enoughData,
  scaleMax,
  windowLabel,
  canMoveUp,
  canMoveDown,
  onOpen,
  onEdit,
  onMove,
  onToggleActive,
  onDelete,
}: {
  stats: PillarStats
  enoughData: boolean
  /** Shared meter scale so shares compare across cards. */
  scaleMax: number
  windowLabel: string
  canMoveUp: boolean
  canMoveDown: boolean
  onOpen: () => void
  onEdit: () => void
  onMove: (direction: -1 | 1) => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const t = useT(pillarMessages)
  const { pillar, mix, perf } = stats
  const name = pillar.name || t("untitled_pillar")
  const actual = mix?.actualPct ?? 0

  return (
    <article className="relative flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm has-[[data-card-link]:focus-visible]:border-ring has-[[data-card-link]:focus-visible]:ring-3 has-[[data-card-link]:focus-visible]:ring-ring/50">
      <header className="flex min-w-0 items-center gap-3">
        <PillarIconTile name={pillar.icon} color={pillar.color} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm leading-5 font-semibold">
            <button
              type="button"
              data-card-link
              title={pillar.description || undefined}
              onClick={onOpen}
              className="block w-full truncate text-left outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
            >
              {name}
            </button>
          </h3>
        </div>
        <PillarActionsMenu
          pillar={pillar}
          className="relative z-10 -mt-1 -mr-1.5"
          onEdit={onEdit}
          onMove={onMove}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onToggleActive={onToggleActive}
          onDelete={onDelete}
        />
      </header>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="text-xs text-muted-foreground">
            <span className="num text-base leading-none font-semibold text-foreground">{Math.round(actual)}%</span> {t("actual_word")}
            <span aria-hidden> · </span>
            {t("target_word")} <span className="num font-medium text-foreground">{pillar.target_percentage}%</span>
          </p>
          <MixStatusPill status={mix?.status} deviation={mix?.deviation ?? 0} enoughData={enoughData} />
        </div>
        <Meter
          value={actual}
          max={scaleMax}
          target={pillar.target_percentage}
          color={pillar.color}
          aria-label={t("share_aria", { name })}
          valueText={t("actual_value", { actual: Math.round(actual), target: pillar.target_percentage })}
        />
      </div>

      <dl className="grid grid-cols-4 gap-3 border-t pt-3" aria-label={t("performance_aria", { window: windowLabel })}>
        <MiniStat label={t("posts")} value={formatNumber(perf?.posts ?? 0)} />
        <MiniStat label={t("avg_views")} value={formatCompact(perf?.avgViews ?? null)} />
        <MiniStat label={t("engagement")} value={formatPercent(perf?.engagementRate ?? null)} />
        <MiniStat label={t("leads")} value={formatNumber(perf?.leads ?? 0)} />
      </dl>

    </article>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] leading-4 text-muted-foreground">{label}</dt>
      <dd className="num truncate text-sm font-medium">{value}</dd>
    </div>
  )
}
