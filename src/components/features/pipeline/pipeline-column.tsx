"use client"

import { useDroppable } from "@dnd-kit/core"
import { AlarmClock, ArrowUpRight, ChevronsLeft, ChevronsRight, Plus } from "lucide-react"
import Link from "next/link"
import { memo } from "react"
import { StageIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT, type Translator } from "@/lib/i18n"
import { PIPELINE_STAGE_MAP } from "@/lib/constants"
import { useCanWrite } from "@/lib/store"
import type { ID, PerformanceTier, PipelineStage } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import {
  columnDomId,
  droppableId,
  PUBLISHED_COLUMN_DAYS,
  QUICK_ADD_STAGES,
  type QuickAddDefaults,
  type StageColumnData,
} from "./board-model"
import { pipelineMessages } from "./messages"
import { PipelineCard } from "./pipeline-card"
import { QuickAddForm } from "./quick-add"

/** One line per stage explaining what belongs there (phone empty state; the empty column's tooltip on desktop). */
export function stageEmptyHint(t: Translator<(typeof pipelineMessages)["en"]>, stage: PipelineStage): string {
  return t(`hint_${stage}`, { days: PUBLISHED_COLUMN_DAYS })
}

interface PipelineColumnProps {
  column: StageColumnData
  collapsed: boolean
  filtered: boolean
  /** A card is being dragged somewhere on the board. */
  dragging: boolean
  now: Date
  tiers: Map<ID, PerformanceTier>
  highlightId: ID | null
  quickAddOpen: boolean
  quickAddDefaults: QuickAddDefaults
  onQuickAdd: (stage: PipelineStage | null) => void
  onCollapsedChange: (stage: PipelineStage, collapsed: boolean) => void
}

// `relative` keeps absolutely positioned descendants (sr-only text) inside the board's scroll
// container — otherwise they resolve against <main> and widen the page.
const FRAME =
  "relative shrink-0 rounded-lg border transition-[background-color,border-color,box-shadow] duration-150 data-flash:ring-2 data-flash:ring-brand/50"

export const PipelineColumn = memo(function PipelineColumn({
  column,
  collapsed,
  filtered,
  dragging,
  now,
  tiers,
  highlightId,
  quickAddOpen,
  quickAddDefaults,
  onQuickAdd,
  onCollapsedChange,
}: PipelineColumnProps) {
  const t = useT(pipelineMessages)
  const { stage, items, total, overdue } = column
  const meta = PIPELINE_STAGE_MAP[stage]
  const { setNodeRef, isOver } = useDroppable({ id: droppableId(stage), data: { stage } })
  // Viewers create nothing, so the column's "＋" isn't offered at all (§10: no dead buttons).
  const canWrite = useCanWrite("content_items")
  const count = items.length
  const countText = filtered && count !== total ? t("count_of", { count: formatNumber(count), total: formatNumber(total) }) : formatNumber(count)
  const surface = isOver ? "border-brand/50 bg-brand-soft" : "bg-muted/40 dark:bg-muted/20"
  const overdueText = overdue ? t("overdue_suffix", { count: formatNumber(overdue) }) : ""

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        id={columnDomId(stage)}
        aria-label={t("collapsed_label", { stage: meta.label })}
        className={cn(FRAME, "flex h-full w-11 flex-col", surface)}
      >
        <button
          type="button"
          onClick={() => onCollapsedChange(stage, false)}
          aria-label={t("expand_stage_aria", {
            stage: meta.label,
            cards: t.plural("cards", count, { count: formatNumber(count) }),
            overdue: overdueText,
          })}
          title={t("expand_stage", { stage: meta.label })}
          className="flex h-full w-full flex-col items-center gap-2 rounded-lg py-2.5 outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-muted/40"
        >
          <ChevronsRight className="size-3.5 text-muted-foreground" aria-hidden />
          <StageIcon stage={stage} />
          <span className="text-xs font-medium num">{formatNumber(count)}</span>
          {overdue ? <AlarmClock className="size-3.5 text-critical-fg" aria-hidden /> : null}
          <span className="text-sm font-medium whitespace-nowrap [writing-mode:vertical-rl]">{meta.label}</span>
        </button>
      </section>
    )
  }

  const titleId = `${columnDomId(stage)}-title`
  const canQuickAdd = QUICK_ADD_STAGES.includes(stage) && canWrite

  return (
    <section
      ref={setNodeRef}
      id={columnDomId(stage)}
      aria-labelledby={titleId}
      className={cn(FRAME, "flex h-full w-[272px] flex-col", surface)}
    >
      <header className="flex h-10 shrink-0 items-center gap-1.5 pr-1.5 pl-3">
        <StageIcon stage={stage} />
        <h2 id={titleId} className="min-w-0 truncate text-sm font-medium" title={meta.description}>
          {meta.label}
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground num" title={filtered ? t("shown_of_all") : undefined}>
          {countText}
        </span>
        {overdue ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-critical-fg"
            title={t.plural("past_deadline", overdue, { count: formatNumber(overdue) })}
          >
            <AlarmClock className="size-3.5" aria-hidden />
            <span className="num">{formatNumber(overdue)}</span>
            <span className="sr-only">{t("overdue")}</span>
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center">
          {stage === "published" ? (
            <Button asChild variant="ghost" size="icon-xs" className="text-muted-foreground">
              {/* The column holds the last PUBLISHED_COLUMN_DAYS days; every post is in Analytics. */}
              <Link href="/analytics/posts" aria-label={t("all_posts")} title={`${t("last_days", { days: PUBLISHED_COLUMN_DAYS })} · ${t("all_posts")}`}>
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          ) : null}
          {canQuickAdd ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              aria-label={t("add_to", { stage: meta.label })}
              title={t("add_to", { stage: meta.label })}
              aria-expanded={quickAddOpen}
              onClick={() => onQuickAdd(quickAddOpen ? null : stage)}
            >
              <Plus aria-hidden />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={t("collapse_stage", { stage: meta.label })}
            title={t("collapse_column")}
            onClick={() => onCollapsedChange(stage, true)}
          >
            <ChevronsLeft aria-hidden />
          </Button>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-2 pb-2">
        {canQuickAdd && quickAddOpen ? (
          <QuickAddForm stage={stage} defaults={quickAddDefaults} onClose={() => onQuickAdd(null)} />
        ) : null}
        {items.map((item) => (
          <PipelineCard
            key={item.id}
            item={item}
            now={now}
            tier={tiers.get(item.id) ?? null}
            highlighted={item.id === highlightId}
          />
        ))}
        {!count && !(canQuickAdd && quickAddOpen) ? (
          // A quiet drop target; what belongs here is the header's tooltip (and the phone board's empty state).
          <div
            title={stageEmptyHint(t, stage)}
            className={cn(
              "flex min-h-20 shrink-0 items-center justify-center rounded-md border border-dashed px-4 py-4 text-center text-xs text-pretty text-muted-foreground",
              dragging && "border-brand/40"
            )}
          >
            {dragging ? t("drop_here", { stage: meta.label }) : filtered && total ? t("no_matches_column") : null}
          </div>
        ) : null}
      </div>
    </section>
  )
})
