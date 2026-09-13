"use client"

import { useMemo } from "react"
import { keywordFilter, PlatformIcon, StageIcon } from "@/components/common"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PIPELINE_STAGE_MAP, PLATFORMS, PUBLISHED_STAGES } from "@/lib/constants"
import { contentItemDate, formatShortDate } from "@/lib/dates"
import { useTable } from "@/lib/store"
import type { AudienceQuestion, ContentItem, ID } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { rankAnswerCandidates } from "./audience-model"

/** "Mark answered": pick the content item that answers the question (suggestions first). */
export function AnswerDialog({
  question,
  open,
  onOpenChange,
  onPick,
}: {
  question: AudienceQuestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (question: AudienceQuestion, itemId: ID) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        {question ? <Picker question={question} onPick={(itemId) => onPick(question, itemId)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Picker({ question, onPick }: { question: AudienceQuestion; onPick: (itemId: ID) => void }) {
  const items = useTable("content_items")
  const { suggested, published, inProgress } = useMemo(() => {
    const ranked = rankAnswerCandidates(question, items)
    return {
      suggested: ranked.suggested,
      published: ranked.others.filter((i) => PUBLISHED_STAGES.includes(i.stage)),
      inProgress: ranked.others.filter((i) => !PUBLISHED_STAGES.includes(i.stage)),
    }
  }, [question, items])

  const option = (item: ContentItem) => (
    <ItemOption key={item.id} item={item} current={item.id === question.content_item_id} onPick={onPick} />
  )

  return (
    <>
      <DialogHeader className="px-4 pt-4 pr-12 pb-3">
        <DialogTitle>Mark answered</DialogTitle>
        <DialogDescription>Link the content that answers “{truncate(question.question, 90)}”.</DialogDescription>
      </DialogHeader>
      <Command filter={keywordFilter} className="rounded-none border-t bg-transparent">
        <CommandInput placeholder="Search content by title, platform or stage…" autoFocus />
        <CommandList className="max-h-[min(24rem,60vh)]">
          <CommandEmpty>No content matches.</CommandEmpty>
          {suggested.length ? <CommandGroup heading="Suggested">{suggested.map(option)}</CommandGroup> : null}
          {published.length ? <CommandGroup heading="Published">{published.map(option)}</CommandGroup> : null}
          {inProgress.length ? <CommandGroup heading="In the pipeline">{inProgress.map(option)}</CommandGroup> : null}
        </CommandList>
      </Command>
    </>
  )
}

function ItemOption({ item, current, onPick }: { item: ContentItem; current: boolean; onPick: (itemId: ID) => void }) {
  const date = contentItemDate(item)
  const stage = PIPELINE_STAGE_MAP[item.stage]?.label ?? item.stage
  return (
    <CommandItem
      value={item.id}
      keywords={[item.title, PLATFORMS[item.platform].label, stage]}
      data-checked={current || undefined}
      onSelect={() => onPick(item.id)}
    >
      <PlatformIcon platform={item.platform} className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{item.title || "Untitled content"}</span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={stage}>
        <StageIcon stage={item.stage} />
        {date ? formatShortDate(date) : stage}
      </span>
    </CommandItem>
  )
}
