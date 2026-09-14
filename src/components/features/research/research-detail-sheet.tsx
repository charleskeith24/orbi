"use client"

import { Trash2, WandSparkles } from "lucide-react"
import Link from "next/link"
import { useId } from "react"
import { AiButton, DetailSheet, FormField, InlineText, OptionSelect, PillarSelect, PlatformSelect } from "@/components/common"
import { SourceUsageList } from "@/components/features/stories/source-usage"
import type { SourceUsage } from "@/components/features/stories/story-model"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/dates"
import { dataActions } from "@/lib/store"
import type { ResearchItem, UpdateRow } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { useAnalysisSession } from "./analysis-store"
import { useResearchActions } from "./research-actions"
import { ResearchActionsMenu } from "./research-actions-menu"
import { ResearchAnalysisPanel } from "./research-analysis-panel"
import { RESEARCH_STATUS_OPTIONS, RESEARCH_TYPE_OPTIONS } from "./research-badges"
import { ResearchFields } from "./research-fields"
import { researchStatusLabel, researchTypeLabel, type ResearchSheetTab } from "./research-model"

/** `/research?open=<id>` — every field editable, the analysis, and the ideas that came from it. */
export function ResearchDetailSheet({
  item,
  open,
  tab,
  usage,
  onTabChange,
  onOpenChange,
}: {
  item: ResearchItem | null
  open: boolean
  tab: ResearchSheetTab
  usage: SourceUsage | undefined
  onTabChange: (tab: ResearchSheetTab) => void
  onOpenChange: (open: boolean) => void
}) {
  if (!item) return null
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={
        <InlineText
          value={item.title}
          required
          maxLength={300}
          placeholder="Untitled reference"
          aria-label="Reference title"
          className="text-base leading-6 font-semibold"
          onSave={(title) => dataActions.update("research_items", item.id, { title })}
        />
      }
      description={`${researchTypeLabel(item.type)} · ${researchStatusLabel(item.status)} · saved ${formatDate(item.created_at)}`}
      actions={<ResearchActionsMenu item={item} inSheet className="size-7" />}
      footer={<SheetFooter item={item} />}
    >
      <SheetBody key={item.id} item={item} tab={tab} usage={usage} onTabChange={onTabChange} />
    </DetailSheet>
  )
}

function SheetBody({
  item,
  tab,
  usage,
  onTabChange,
}: {
  item: ResearchItem
  tab: ResearchSheetTab
  usage: SourceUsage | undefined
  onTabChange: (tab: ResearchSheetTab) => void
}) {
  const id = useId()
  const drafting = Boolean(useAnalysisSession(item.id).draft)
  const ideas = usage?.ideas.length ?? 0
  const set = (patch: UpdateRow<"research_items">) => dataActions.update("research_items", item.id, patch)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <FormField label="Type" htmlFor={`${id}-type`}>
          <OptionSelect
            id={`${id}-type`}
            size="sm"
            options={RESEARCH_TYPE_OPTIONS}
            value={item.type}
            onChange={(type) => {
              if (type) set({ type })
            }}
          />
        </FormField>
        <FormField label="Status" htmlFor={`${id}-status`}>
          <OptionSelect
            id={`${id}-status`}
            size="sm"
            options={RESEARCH_STATUS_OPTIONS}
            value={item.status}
            onChange={(status) => {
              if (status) set({ status })
            }}
          />
        </FormField>
        <FormField label="Platform" htmlFor={`${id}-platform`}>
          <PlatformSelect id={`${id}-platform`} size="sm" allowNone value={item.platform} onChange={(platform) => set({ platform })} />
        </FormField>
        <FormField label="Content Pillar" htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} size="sm" allowNone value={item.pillar_id} onChange={(pillar_id) => set({ pillar_id })} />
        </FormField>
      </div>

      <Tabs value={tab} onValueChange={(next) => onTabChange(next as ResearchSheetTab)} className="min-w-0 gap-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="analysis">
            Analysis
            {drafting ? (
              <>
                <span aria-hidden className="size-1.5 rounded-full bg-brand" />
                <span className="sr-only">(unsaved)</span>
              </>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="usage">
            Usage
            {ideas ? <span className="text-xs text-muted-foreground num">{formatNumber(ideas)}</span> : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="min-w-0">
          <ResearchFields item={item} />
        </TabsContent>
        <TabsContent value="analysis" className="min-w-0">
          <ResearchAnalysisPanel item={item} />
        </TabsContent>
        <TabsContent value="usage" className="min-w-0">
          <SourceUsageList
            usage={usage}
            noun="reference"
            emptyAction={
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={`/research/adapt?from=${item.id}`}>
                  <WandSparkles aria-hidden />
                  Adapt into original
                </Link>
              </Button>
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SheetFooter({ item }: { item: ResearchItem }) {
  const actions = useResearchActions()
  const pending = useAnalysisSession(item.id).status === "pending"
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="mr-auto text-muted-foreground" onClick={() => void actions.remove(item)}>
        <Trash2 aria-hidden />
        Delete
      </Button>
      <AiButton type="button" size="sm" variant="outline" pending={pending} pendingLabel="Analyzing…" onClick={() => actions.analyze(item)}>
        {item.analysis ? "Re-analyze" : "Analyze"}
      </AiButton>
      <Button type="button" size="sm" asChild>
        <Link href={`/research/adapt?from=${item.id}`}>
          <WandSparkles aria-hidden />
          Adapt into original
        </Link>
      </Button>
    </>
  )
}
