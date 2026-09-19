"use client"

import { useDraggable } from "@dnd-kit/core"
import { memo } from "react"
import { ContentCard } from "@/components/common"
import type { ContentItem, PerformanceTier } from "@/lib/types"
import { cn } from "@/lib/utils"
import { cardDomId } from "./board-model"
import { CardActions } from "./card-actions"

interface PipelineCardProps {
  item: ContentItem
  now: Date
  tier: PerformanceTier | null
  highlighted: boolean
}

/**
 * Board card. Mouse: drag anywhere (a plain click opens the Content Studio — dnd-kit only starts
 * after 6px of movement). Keyboard and touch: the "⋯" button is the drag handle.
 */
export const PipelineCard = memo(function PipelineCard({ item, now, tier, highlighted }: PipelineCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { stage: item.stage },
  })

  return (
    <div
      ref={setNodeRef}
      id={cardDomId(item.id)}
      onPointerDown={(event) => listeners?.onPointerDown?.(event)}
      className={cn("group/pcard relative shrink-0 rounded-lg", isDragging && "opacity-40")}
    >
      <ContentCard
        item={item}
        href={`/studio/${item.id}`}
        now={now}
        tier={tier}
        selected={highlighted}
        showFormat={false}
        showPriorityLabel={false}
        actions={<CardActions item={item} drag={{ setActivatorNodeRef, attributes, listeners, isDragging }} />}
      />
    </div>
  )
})
