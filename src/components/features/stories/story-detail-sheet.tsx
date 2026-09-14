"use client"

import { Lightbulb, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { AiButton, DatePicker, DetailSheet, FormField, InlineText, ListEditor, OptionSelect, PillarSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, todayISO } from "@/lib/dates"
import { dataActions } from "@/lib/store"
import type { Story, UpdateRow } from "@/lib/types"
import { formatNumber, pluralize } from "@/lib/utils"
import { storySessionKey, useAngleSession } from "./angle-store"
import { AutosaveInput } from "./autosave-field"
import { SourceUsageList } from "./source-usage"
import { useStoryActions } from "./story-actions"
import { StoryActionsMenu } from "./story-actions-menu"
import { StoryAnglesPanel } from "./story-angles-panel"
import { FavoriteToggle, STORY_TYPE_OPTIONS } from "./story-badges"
import { storyTypeLabel, type SourceUsage, type StorySheetTab } from "./story-model"
import { StoryStarFields } from "./story-star-fields"

/** `/stories?open=<id>` — every field editable, content angles, and where the story has been used. */
export function StoryDetailSheet({
  story,
  open,
  tab,
  usage,
  onTabChange,
  onOpenChange,
}: {
  story: Story | null
  open: boolean
  tab: StorySheetTab
  usage: SourceUsage | undefined
  onTabChange: (tab: StorySheetTab) => void
  onOpenChange: (open: boolean) => void
}) {
  if (!story) return null
  const ideas = usage?.ideas.length ?? 0
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={
        <InlineText
          value={story.title}
          required
          maxLength={200}
          placeholder="Untitled story"
          aria-label="Story title"
          className="text-base leading-6 font-semibold"
          onSave={(title) => dataActions.update("stories", story.id, { title })}
        />
      }
      description={`${storyTypeLabel(story.type)} · ${story.occurred_on ? formatDate(story.occurred_on) : "No date"} · ${ideas ? `used in ${pluralize(ideas, "idea")}` : "not used yet"}`}
      actions={
        <>
          <FavoriteToggle story={story} className="size-7" />
          <StoryActionsMenu story={story} inSheet className="size-7" />
        </>
      }
      footer={<SheetFooter story={story} />}
    >
      <SheetBody key={story.id} story={story} tab={tab} usage={usage} onTabChange={onTabChange} />
    </DetailSheet>
  )
}

function SheetBody({
  story,
  tab,
  usage,
  onTabChange,
}: {
  story: Story
  tab: StorySheetTab
  usage: SourceUsage | undefined
  onTabChange: (tab: StorySheetTab) => void
}) {
  const id = useId()
  const actions = useStoryActions()
  const [today] = useState(() => todayISO())
  const angles = useAngleSession(storySessionKey(story.id)).drafts.length
  const ideas = usage?.ideas.length ?? 0
  const set = (patch: UpdateRow<"stories">) => dataActions.update("stories", story.id, patch)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <FormField label="Type" htmlFor={`${id}-type`}>
          <OptionSelect
            id={`${id}-type`}
            size="sm"
            options={STORY_TYPE_OPTIONS}
            value={story.type}
            onChange={(type) => {
              if (type) set({ type })
            }}
          />
        </FormField>
        <FormField label="Potential Content Pillar" htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} size="sm" allowNone value={story.pillar_id} onChange={(pillar_id) => set({ pillar_id })} />
        </FormField>
        <FormField label="Date" htmlFor={`${id}-date`}>
          <DatePicker
            id={`${id}-date`}
            size="sm"
            value={story.occurred_on}
            maxDate={today}
            placeholder="When it happened"
            onChange={(occurred_on) => set({ occurred_on })}
          />
        </FormField>
        <FormField label="Emotion" htmlFor={`${id}-emotion`}>
          <AutosaveInput
            id={`${id}-emotion`}
            className="h-7"
            value={story.emotion}
            maxLength={200}
            placeholder="How it felt"
            onCommit={(emotion) => set({ emotion })}
          />
        </FormField>
      </div>
      <FormField label="Keywords" htmlFor={`${id}-keywords`} description="The AI uses these to find this story when you write about related topics.">
        <ListEditor
          id={`${id}-keywords`}
          value={story.keywords}
          onChange={(keywords) => set({ keywords: keywords.map((k) => k.toLowerCase()) })}
          placeholder="Add a keyword and press Enter"
          maxItems={12}
          aria-label="Keywords"
        />
      </FormField>

      <Tabs value={tab} onValueChange={(next) => onTabChange(next as StorySheetTab)} className="min-w-0 gap-4">
        <TabsList>
          <TabsTrigger value="story">Story</TabsTrigger>
          <TabsTrigger value="angles">
            Content angles
            {angles ? <span className="text-xs text-muted-foreground num">{formatNumber(angles)}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="usage">
            Usage
            {ideas ? <span className="text-xs text-muted-foreground num">{formatNumber(ideas)}</span> : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="story" className="min-w-0">
          <StoryStarFields story={story} />
        </TabsContent>
        <TabsContent value="angles" className="min-w-0">
          <StoryAnglesPanel story={story} />
        </TabsContent>
        <TabsContent value="usage" className="min-w-0">
          <SourceUsageList
            usage={usage}
            noun="story"
            emptyAction={
              <AiButton type="button" size="sm" variant="outline" onClick={() => actions.turnIntoIdeas(story)}>
                Turn into content ideas
              </AiButton>
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SheetFooter({ story }: { story: Story }) {
  const actions = useStoryActions()
  const pending = useAngleSession(storySessionKey(story.id)).status === "pending"
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="mr-auto text-muted-foreground" onClick={() => void actions.remove(story)}>
        <Trash2 aria-hidden />
        Delete
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.createIdea(story)}>
        <Lightbulb aria-hidden />
        Create idea
      </Button>
      <AiButton type="button" size="sm" variant="default" pending={pending} onClick={() => actions.turnIntoIdeas(story)}>
        Turn into content ideas
      </AiButton>
    </>
  )
}
