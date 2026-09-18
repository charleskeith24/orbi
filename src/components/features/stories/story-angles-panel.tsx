"use client"

import { Sparkles } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"
import { AiButton, EmptyState } from "@/components/common"
import { useT } from "@/lib/i18n"
import type { Story } from "@/lib/types"
import { AiErrorNotice } from "./ai-error"
import type { AngleOrigin } from "./angle-model"
import { AngleResults } from "./angle-results"
import { storySessionKey, useAngleSession } from "./angle-store"
import { experienceMessages } from "./experience-messages"
import { runStoryAngles } from "./story-actions"
import { storyReadyForAi } from "./story-model"

/** Story → eight content angles (experience_to_content); saved angles become ideas linked to the story. */
export function StoryAnglesPanel({ story }: { story: Story }) {
  const key = storySessionKey(story.id)
  const session = useAngleSession(key)
  const ready = storyReadyForAi(story)
  const t = useT(experienceMessages)
  const origin = useMemo<AngleOrigin>(
    () => ({ source: "story", storyId: story.id, storyTitle: story.title, lesson: story.lesson, keywords: story.keywords, pillarId: story.pillar_id }),
    [story]
  )

  function generate() {
    if (!runStoryAngles(story)) {
      toast.info(t("story_too_thin_toast"), { description: t("story_too_thin_toast_description") })
    }
  }

  if (!session.drafts.length && session.status !== "pending") {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {session.error ? <AiErrorNotice message={session.error} onRetry={generate} /> : null}
        <EmptyState
          compact
          icon={Sparkles}
          title={t("story_empty_title")}
          description={t("story_empty_description")}
          action={
            <AiButton type="button" size="sm" variant="default" disabled={!ready} onClick={generate}>
              {t("generate_angles")}
            </AiButton>
          }
          className="rounded-lg border border-dashed"
        />
        {ready ? null : (
          <p className="text-center text-xs text-pretty text-muted-foreground">{t("story_too_thin")}</p>
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
      notice={t("story_notice")}
    />
  )
}
