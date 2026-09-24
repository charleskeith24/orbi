"use client"

import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Plus, SquareKanban } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { ContentCard, EmptyState, OptionSelect, StageIcon, type SelectOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { PIPELINE_STAGE_MAP } from "@/lib/constants"
import { useCanWrite } from "@/lib/store"
import type { ContentItem, ID, PerformanceTier, PipelineStage } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import {
  adjacentStages,
  cardDomId,
  PUBLISHED_COLUMN_DAYS,
  QUICK_ADD_STAGES,
  STAGE_IDS,
  type QuickAddDefaults,
  type StageColumnData,
} from "./board-model"
import { CardActions } from "./card-actions"
import { pipelineMessages } from "./messages"
import { usePipelineActions } from "./pipeline-actions"
import { stageEmptyHint } from "./pipeline-column"
import { QuickAddForm } from "./quick-add"

const label = (stage: PipelineStage) => PIPELINE_STAGE_MAP[stage]?.label ?? stage

export const MOBILE_STAGE_LIST_ID = "pipeline-mobile-stage"

interface MobileBoardProps {
  columns: Record<PipelineStage, StageColumnData>
  stage: PipelineStage
  onStageChange: (stage: PipelineStage) => void
  filtered: boolean
  now: Date
  tiers: Map<ID, PerformanceTier>
  highlightId: ID | null
  quickAdd: PipelineStage | null
  quickAddDefaults: QuickAddDefaults
  onQuickAdd: (stage: PipelineStage | null) => void
  onResetFilters: () => void
}

/** Phones: one stage at a time, with a stage picker and move buttons on every card. */
export function MobileBoard({
  columns,
  stage,
  onStageChange,
  filtered,
  now,
  tiers,
  highlightId,
  quickAdd,
  quickAddDefaults,
  onQuickAdd,
  onResetFilters,
}: MobileBoardProps) {
  const t = useT(pipelineMessages)
  // Viewers create nothing, so the stage's "Add" isn't offered (§10: no dead buttons).
  const canWrite = useCanWrite("content_items")
  const column = columns[stage]
  const { prev, next } = adjacentStages(stage)
  const options = useMemo<SelectOption<PipelineStage>[]>(
    () =>
      STAGE_IDS.map((s) => ({
        value: s,
        label: `${label(s)} · ${formatNumber(columns[s].items.length)}`,
        icon: <StageIcon stage={s} />,
      })),
    [columns]
  )
  // The nearest stage (after, then before) that has cards — the empty state's way forward.
  const index = STAGE_IDS.indexOf(stage)
  const nearest =
    STAGE_IDS.slice(index + 1).find((s) => columns[s].items.length) ??
    [...STAGE_IDS.slice(0, index)].reverse().find((s) => columns[s].items.length) ??
    null
  const noMatches = filtered && column.total > 0

  return (
    <section id={MOBILE_STAGE_LIST_ID} aria-label={t("mobile_stage")} className="flex scroll-mt-14 flex-col gap-3">
      <div className="sticky top-12 z-10 -mx-4 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!prev}
          aria-label={prev ? t("previous_stage", { stage: label(prev) }) : t("no_previous_stage")}
          onClick={() => prev && onStageChange(prev)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <OptionSelect
          options={options}
          value={stage}
          onChange={(value) => {
            if (value) onStageChange(value)
          }}
          aria-label={t("stage")}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!next}
          aria-label={next ? t("next_stage", { stage: label(next) }) : t("no_next_stage")}
          onClick={() => next && onStageChange(next)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {stage === "published" ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("last_days", { days: PUBLISHED_COLUMN_DAYS })}</span>
          <Link href="/analytics/posts" className="inline-flex items-center gap-0.5 font-medium text-foreground/80 hover:underline">
            {t("all_posts")}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      {QUICK_ADD_STAGES.includes(stage) && canWrite ? (
        quickAdd === stage ? (
          <QuickAddForm stage={stage} defaults={quickAddDefaults} onClose={() => onQuickAdd(null)} />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-dashed text-muted-foreground"
            aria-label={t("add_to", { stage: label(stage) })}
            onClick={() => onQuickAdd(stage)}
          >
            <Plus aria-hidden />
            {t("add")}
          </Button>
        )
      ) : null}

      {column.items.length ? (
        <ul className="flex flex-col gap-2" aria-label={t("stage_cards", { stage: label(stage) })}>
          {column.items.map((item) => (
            <li key={item.id}>
              <MobileCard item={item} now={now} tier={tiers.get(item.id) ?? null} highlighted={item.id === highlightId} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={SquareKanban}
          title={noMatches ? t("no_matches_stage") : t("nothing_in", { stage: label(stage) })}
          description={noMatches ? t("no_matches_stage_description") : stageEmptyHint(t, stage)}
          action={
            noMatches ? (
              <Button type="button" size="sm" variant="outline" onClick={onResetFilters}>
                {t("reset_filters")}
              </Button>
            ) : nearest ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onStageChange(nearest)}>
                {t("show_stage", { stage: label(nearest), count: formatNumber(columns[nearest].items.length) })}
              </Button>
            ) : undefined
          }
          className="rounded-lg border border-dashed"
        />
      )}
    </section>
  )
}

function MobileCard({
  item,
  now,
  tier,
  highlighted,
}: {
  item: ContentItem
  now: Date
  tier: PerformanceTier | null
  highlighted: boolean
}) {
  const t = useT(pipelineMessages)
  const actions = usePipelineActions()
  // Moving a card writes the item, so a Viewer gets the card without the stage buttons (§17).
  const canWrite = useCanWrite("content_items")
  const { prev, next } = canWrite ? adjacentStages(item.stage) : { prev: null, next: null }
  return (
    <div
      id={cardDomId(item.id)}
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-xs",
        highlighted && "border-brand/60 ring-2 ring-brand/25"
      )}
    >
      <ContentCard
        item={item}
        href={`/studio/${item.id}`}
        now={now}
        tier={tier}
        showFormat={false}
        showPriorityLabel={false}
        actions={<CardActions item={item} />}
        className="rounded-none border-0 shadow-none hover:shadow-none"
      />
      {prev || next ? (
        <div className="flex divide-x border-t">
          {prev ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 min-w-0 flex-1 justify-start rounded-none px-3 font-normal text-muted-foreground"
              aria-label={t("move_back_to", { stage: label(prev) })}
              onClick={() => actions.moveItem(item, prev)}
            >
              <ArrowLeft aria-hidden />
              <span className="truncate">{label(prev)}</span>
            </Button>
          ) : null}
          {next ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 min-w-0 flex-1 justify-end rounded-none px-3"
              aria-label={t("move_to_stage", { stage: label(next) })}
              onClick={() => actions.moveItem(item, next)}
            >
              <span className="truncate">{label(next)}</span>
              <ArrowRight aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
