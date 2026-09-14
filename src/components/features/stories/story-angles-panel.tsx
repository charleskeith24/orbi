"use client"

import { Sparkles } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"
import { AiButton, EmptyState } from "@/components/common"
import type { Story } from "@/lib/types"
import { AiErrorNotice } from "./ai-error"
import type { AngleOrigin } from "./angle-model"
import { AngleResults } from "./angle-results"
import { storySessionKey, useAngleSession } from "./angle-store"
import { runStoryAngles } from "./story-actions"
import { storyReadyForAi } from "./story-model"

/** Story → eight content angles (experience_to_content); saved angles become ideas linked to the story. */
export function StoryAnglesPanel({ story }: { story: Story }) {
  const key = storySessionKey(story.id)
  const session = useAngleSession(key)
  const ready = storyReadyForAi(story)
  const origin = useMemo<AngleOrigin>(
    () => ({ source: "story", storyId: story.id, storyTitle: story.title, lesson: story.lesson, keywords: story.keywords, pillarId: story.pillar_id }),
    [story]
  )

  function generate() {
    if (!runStoryAngles(story)) {
      toast.info("Add a little more to this story first", { description: "The AI needs the situation, what you did or the lesson." })
    }
  }

  if (!session.drafts.length && session.status !== "pending") {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {session.error ? <AiErrorNotice message={session.error} onRetry={generate} /> : null}
        <EmptyState
          compact
          icon={Sparkles}
          title="Turn this story into content ideas"
          description="Eight angles from one real story — leadership lesson, management framework, personal reflection, storytelling post, educational video, contrarian opinion, LinkedIn and Facebook posts — each with a hook, outline and draft."
          action={
            <AiButton type="button" size="sm" variant="default" disabled={!ready} onClick={generate}>
              Generate angles
            </AiButton>
          }
          className="rounded-lg border border-dashed"
        />
        {ready ? null : (
          <p className="text-center text-xs text-pretty text-muted-foreground">
            Add the situation, what you did or the lesson first — the AI needs a few sentences to work with.
          </p>
        )}
      </div>
    )
  }

  return (
    <AngleResults
      sessionKey={key}
      origin={origin}
      canRegenerate={ready}
      onRegenerate={generate}
      notice="Built only from this story. Edit each draft until it sounds like you, then save the angles you would actually post."
    />
  )
}
