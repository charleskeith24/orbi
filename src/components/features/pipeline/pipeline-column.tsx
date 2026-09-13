"use client"

import { useDroppable } from "@dnd-kit/core"
import { AlarmClock, ArrowUpRight, ChevronsLeft, ChevronsRight, Plus } from "lucide-react"
import Link from "next/link"
import { memo } from "react"
import { StageIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { PIPELINE_STAGE_MAP } from "@/lib/constants"
import type { ID, PerformanceTier, PipelineStage } from "@/lib/types"
import { cn, formatNumber, pluralize } from "@/lib/utils"
import {
  columnDomId,
  droppableId,
  PUBLISHED_COLUMN_DAYS,
  QUICK_ADD_STAGES,
  type QuickAddDefaults,
  type StageColumnData,
} from "./board-model"
import { PipelineCard } from "./pipeline-card"
import { QuickAddForm } from "./quick-add"

/** One line per stage explaining what belongs there (shown when the column is empty). */
export const STAGE_EMPTY_HINTS: Record<PipelineStage, string> = {
  idea: "Park raw ideas here before you commit to them.",
  selected: "Ideas you've chosen to produce next.",
  brief: "Pieces waiting for an objective, audience and message.",
  scripting: "Nothing is being written right now.",
  ready_for_production: "No approved scripts waiting to be recorded.",
  recording: "Nothing is being recorded or designed.",
  editing: "Nothing is in the edit.",
  review: "Nothing is waiting for approval.",
  revision: "No changes requested.",
  ready_to_post: "Approved pieces without a publish time land here.",
  scheduled: "Nothing is scheduled to go live.",
  published: `Nothing published in the last ${PUBLISHED_COLUMN_DAYS} days.`,
  repurpose: "Queue published winners here to repurpose them.",
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
  const { stage, items, total, overdue } = column
  const meta = PIPELINE_STAGE_MAP[stage]
  const { setNodeRef, isOver } = useDroppable({ id: droppableId(stage), data: { stage } })
  const count = items.length
  const countText = filtered && count !== total ? `${formatNumber(count)} of ${formatNumber(total)}` : formatNumber(count)
  const surface = isOver ? "border-brand/50 bg-brand-soft" : "bg-muted/40 dark:bg-muted/20"
  const overdueText = overdue ? `, ${formatNumber(overdue)} overdue` : ""

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        id={columnDomId(stage)}
        aria-label={`${meta.label} (collapsed)`}
        className={cn(FRAME, "flex h-full w-11 flex-col", surface)}
      >
        <button
          type="button"
          onClick={() => onCollapsedChange(stage, false)}
          aria-label={`Expand ${meta.label}: ${pluralize(count, "card")}${overdueText}`}
          title={`Expand ${meta.label}`}
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
  const canQuickAdd = QUICK_ADD_STAGES.includes(stage)

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
        <span className="shrink-0 text-xs text-muted-foreground num" title={filtered ? "Shown of all cards in this stage" : undefined}>
          {countText}
        </span>
        {overdue ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-critical-fg"
            title={`${pluralize(overdue, "card")} past deadline or scheduled time`}
          >
            <AlarmClock className="size-3.5" aria-hidden />
            <span className="num">{formatNumber(overdue)}</span>
            <span className="sr-only">overdue</span>
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto text-muted-foreground"
          aria-label={`Collapse ${meta.label}`}
          title="Collapse column"
          onClick={() => onCollapsedChange(stage, true)}
        >
          <ChevronsLeft aria-hidden />
        </Button>
      </header>

      {stage === "published" ? (
        <div className="-mt-1 flex shrink-0 items-center justify-between gap-2 px-3 pb-2 text-xs text-muted-foreground">
          <span>Last {PUBLISHED_COLUMN_DAYS} days</span>
          <Link
            href="/analytics/posts"
            className="inline-flex items-center gap-0.5 rounded-sm font-medium text-foreground/80 underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            All posts in Analytics
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-2 pb-2">
        {canQuickAdd ? (
          quickAddOpen ? (
            <QuickAddForm stage={stage} defaults={quickAddDefaults} onClose={() => onQuickAdd(null)} />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full shrink-0 justify-start text-muted-foreground"
              onClick={() => onQuickAdd(stage)}
            >
              <Plus aria-hidden />
              Add to {meta.label}
            </Button>
          )
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
        {!count ? (
          <div
            className={cn(
              "flex min-h-24 shrink-0 items-center justify-center rounded-md border border-dashed px-4 py-5 text-center text-xs text-pretty text-muted-foreground",
              dragging && "border-brand/40"
            )}
          >
            {dragging
              ? `Drop here to move to ${meta.label}`
              : filtered && total
                ? "No cards here match your filters."
                : STAGE_EMPTY_HINTS[stage]}
          </div>
        ) : null}
      </div>
    </section>
  )
})
