"use client"

import { Lightbulb, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { AiButton, DatePicker, DetailSheet, FormField, InlineText, ListEditor, OptionSelect, PillarSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, todayISO } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions } from "@/lib/store"
import type { Story, UpdateRow } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { storySessionKey, useAngleSession } from "./angle-store"
import { AutosaveInput } from "./autosave-field"
import { storyFormMessages, storyVaultMessages } from "./messages"
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
  const t = useT(storyFormMessages)
  const tv = useT(storyVaultMessages)
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
          placeholder={tv("untitled")}
          aria-label={t("story_title")}
          className="text-base leading-6 font-semibold"
          onSave={(title) => dataActions.update("stories", story.id, { title })}
        />
      }
      description={`${storyTypeLabel(story.type)} · ${story.occurred_on ? formatDate(story.occurred_on) : t("no_date")} · ${
        ideas ? t("used_in", { ideas: tv.plural("ideas", ideas, { count: formatNumber(ideas) }) }) : t("not_used")
      }`}
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
  const t = useT(storyFormMessages)
  const tv = useT(storyVaultMessages)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <FormField label={t("type")} htmlFor={`${id}-type`}>
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
        <FormField label={t("potential_pillar")} htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} size="sm" allowNone value={story.pillar_id} onChange={(pillar_id) => set({ pillar_id })} />
        </FormField>
        <FormField label={t("date")} htmlFor={`${id}-date`}>
          <DatePicker
            id={`${id}-date`}
            size="sm"
            value={story.occurred_on}
            maxDate={today}
            placeholder={t("date_placeholder")}
            onChange={(occurred_on) => set({ occurred_on })}
          />
        </FormField>
        <FormField label={t("emotion")} htmlFor={`${id}-emotion`}>
          <AutosaveInput
            id={`${id}-emotion`}
            className="h-7"
            value={story.emotion}
            maxLength={200}
            placeholder={t("emotion_placeholder")}
            onCommit={(emotion) => set({ emotion })}
          />
        </FormField>
      </div>
      <FormField label={t("keywords")} htmlFor={`${id}-keywords`} description={t("keywords_description")}>
        <ListEditor
          id={`${id}-keywords`}
          value={story.keywords}
          onChange={(keywords) => set({ keywords: keywords.map((k) => k.toLowerCase()) })}
          placeholder={t("keywords_placeholder")}
          maxItems={12}
          aria-label={t("keywords")}
        />
      </FormField>

      <Tabs value={tab} onValueChange={(next) => onTabChange(next as StorySheetTab)} className="min-w-0 gap-4">
        <TabsList>
          <TabsTrigger value="story">{t("tab_story")}</TabsTrigger>
          <TabsTrigger value="angles">
            {t("tab_angles")}
            {angles ? <span className="text-xs text-muted-foreground num">{formatNumber(angles)}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="usage">
            {t("tab_usage")}
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
                {tv("turn_into_ideas")}
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
  const t = useT(storyFormMessages)
  const tv = useT(storyVaultMessages)
  const c = useT(commonMessages)
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="mr-auto text-muted-foreground" onClick={() => void actions.remove(story)}>
        <Trash2 aria-hidden />
        {c("delete")}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.createIdea(story)}>
        <Lightbulb aria-hidden />
        {t("create_idea")}
      </Button>
      <AiButton type="button" size="sm" variant="default" pending={pending} onClick={() => actions.turnIntoIdeas(story)}>
        {tv("turn_into_ideas")}
      </AiButton>
    </>
  )
}
