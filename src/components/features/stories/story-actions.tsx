"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { dataActions } from "@/lib/store"
import type { ID, Story } from "@/lib/types"
import { generateAngles, storySessionKey } from "./angle-store"
import { copyText } from "./clipboard"
import { storyCopyValues, storyExperienceText, storyReadyForAi, type StorySheetTab } from "./story-model"
import { StoryIdeaDialog } from "./story-idea-dialog"

/** Start experience_to_content for a story (drafts land in the angle store). False when the story is too thin. */
export function runStoryAngles(story: Story): boolean {
  if (!storyReadyForAi(story)) return false
  void generateAngles(
    storySessionKey(story.id),
    { experience: storyExperienceText(story), pillar_id: story.pillar_id },
    { entityType: "stories", entityId: story.id }
  )
  return true
}

export interface StoryActions {
  open: (id: ID | null, tab?: StorySheetTab) => void
  turnIntoIdeas: (story: Story) => void
  createIdea: (story: Story) => void
  toggleFavorite: (story: Story) => void
  duplicate: (story: Story) => void
  copyLink: (story: Story) => void
  remove: (story: Story) => Promise<void>
}

const StoryActionsContext = createContext<StoryActions | null>(null)

export function useStoryActions(): StoryActions {
  const actions = useContext(StoryActionsContext)
  if (!actions) throw new Error("useStoryActions must be used inside <StoryActionsProvider>")
  return actions
}

/** Story actions shared by cards, rows, menus and the detail sheet — plus the confirm and create-idea dialogs. */
export function StoryActionsProvider({
  onOpen,
  onRemoved,
  children,
}: {
  onOpen: (id: ID | null, tab?: StorySheetTab) => void
  onRemoved: (id: ID) => void
  children: React.ReactNode
}) {
  const [confirm, confirmDialog] = useConfirm()
  const [ideaStory, setIdeaStory] = useState<Story | null>(null)
  const [ideaOpen, setIdeaOpen] = useState(false)

  const actions = useMemo<StoryActions>(
    () => ({
      open: onOpen,
      turnIntoIdeas(story) {
        if (runStoryAngles(story)) {
          onOpen(story.id, "angles")
          return
        }
        toast.info("Add a little more to this story first", {
          description: "The AI needs the situation, what you did or the lesson to work with.",
        })
        onOpen(story.id, "story")
      },
      createIdea(story) {
        setIdeaStory(story)
        setIdeaOpen(true)
      },
      toggleFavorite(story) {
        dataActions.update("stories", story.id, { is_favorite: !story.is_favorite })
      },
      duplicate(story) {
        const copy = dataActions.insert("stories", storyCopyValues(story))
        toast.success("Story duplicated", { description: copy.title, action: { label: "Open", onClick: () => onOpen(copy.id) } })
      },
      copyLink(story) {
        void copyText(`${window.location.origin}/stories?open=${story.id}`, "Link copied")
      },
      async remove(story) {
        const title = story.title.trim() || "Untitled story"
        const cited = dataActions.getDb().content_ideas.filter((i) => i.source_ref_id === story.id).length
        const ok = await confirm({
          title: "Delete this story?",
          description:
            cited === 0
              ? `“${title}” will be removed from your Story Vault. This can't be undone.`
              : cited === 1
                ? `“${title}” will be removed from your Story Vault. The idea created from it stays in your Idea Bank.`
                : `“${title}” will be removed from your Story Vault. The ${cited} ideas created from it stay in your Idea Bank.`,
        })
        if (!ok) return
        // Ideas keep their content but stop pointing at a story that no longer exists.
        const linked = dataActions.getDb().content_ideas.filter((i) => i.source_ref_id === story.id)
        if (linked.length) dataActions.updateMany("content_ideas", linked.map((i) => ({ id: i.id, patch: { source_ref_id: null } })))
        dataActions.remove("stories", story.id)
        onRemoved(story.id)
        toast.success("Story deleted", { description: title })
      },
    }),
    [confirm, onOpen, onRemoved]
  )

  return (
    <StoryActionsContext.Provider value={actions}>
      {children}
      {confirmDialog}
      <StoryIdeaDialog story={ideaStory} open={ideaOpen} onOpenChange={setIdeaOpen} />
    </StoryActionsContext.Provider>
  )
}
