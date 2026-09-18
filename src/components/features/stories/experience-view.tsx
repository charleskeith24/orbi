"use client"

import { BookOpen, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useMemo } from "react"
import { toast } from "sonner"
import { AiButton, EmptyState, FormField, PageContainer, PageHeader, PillarSelect, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useRow } from "@/lib/store"
import type { ID, Story } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { AiErrorNotice } from "./ai-error"
import type { AngleOrigin } from "./angle-model"
import { AngleResults } from "./angle-results"
import {
  EXPERIENCE_SESSION,
  generateAngles,
  setExperiencePageState,
  updateSessionStory,
  useAngleSession,
  useExperiencePageState,
} from "./angle-store"
import { experienceMessages } from "./experience-messages"
import { ExperienceStoryCard } from "./experience-story-card"
import { RecentStories } from "./recent-stories"
import { MIN_EXPERIENCE_CHARS } from "./story-model"

const MAX_CHARS = 8000
// Sent to the AI as the experience, so it stays English in both UI languages.
const EXAMPLE =
  "Today I had to talk to my team because deadlines were being missed. Two client reports went out late this week and nobody knew who owned the final check. I paused our Monday meeting, asked each person to walk me through their week, and we agreed on one owner per deliverable plus a Thursday review. By Friday everything shipped on time. The lesson: missed deadlines are usually an ownership problem, not an effort problem."

function mostCommon(values: readonly (ID | null)[]): ID | null {
  const counts = new Map<ID, number>()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best: ID | null = null
  let top = 0
  for (const [value, count] of counts) {
    if (count > top) {
      best = value
      top = count
    }
  }
  return best
}

/**
 * Turn Experience Into Content (spec §31): a real experience → a Story Vault entry plus eight
 * content angles (hook, outline, draft) to save as ideas or turn straight into content.
 * The input and results live in the angle store, so they survive a trip to the Content Studio.
 */
export function ExperienceView() {
  const id = useId()
  const router = useRouter()
  const page = useExperiencePageState()
  const session = useAngleSession(EXPERIENCE_SESSION)
  const savedStory = useRow("stories", page.savedStoryId)
  const text = page.text
  const length = text.trim().length
  const ready = length >= MIN_EXPERIENCE_CHARS
  const pending = session.status === "pending"
  const hasResults = session.drafts.length > 0 || pending
  const extracted = session.story
  const t = useT(experienceMessages)
  const c = useT(commonMessages)

  const origin = useMemo<AngleOrigin>(() => {
    const source = savedStory ?? extracted
    return {
      source: "experience",
      storyId: savedStory?.id ?? null,
      storyTitle: source?.title ?? "",
      lesson: source?.lesson ?? "",
      keywords: source?.keywords ?? [],
      pillarId: savedStory?.pillar_id ?? page.pillarId,
    }
  }, [savedStory, extracted, page.pillarId])

  function generate() {
    const experience = text.trim()
    if (experience.length < MIN_EXPERIENCE_CHARS || pending) return
    // A different experience gets its own Story Vault entry.
    if (page.savedStoryId && experience !== session.input.trim()) setExperiencePageState({ savedStoryId: null })
    void generateAngles(EXPERIENCE_SESSION, { experience, pillar_id: page.pillarId })
  }

  function onStorySaved(story: Story) {
    // Ideas already saved from these angles now point at the new story.
    const saved = new Set(session.drafts.map((d) => d.ideaId).filter((ideaId): ideaId is ID => Boolean(ideaId)))
    const relink = dataActions
      .getDb()
      .content_ideas.filter((idea) => saved.has(idea.id) && !idea.source_ref_id)
      .map((idea) => ({ id: idea.id, patch: { source_ref_id: story.id } }))
    if (relink.length) dataActions.updateMany("content_ideas", relink)
    setExperiencePageState({ savedStoryId: story.id })
    toast.success(t("story_saved"), {
      description: relink.length
        ? t("story_saved_linked", { title: story.title, ideas: t.plural("ideas", relink.length, { count: formatNumber(relink.length) }) })
        : story.title,
      action: { label: c("open"), onClick: () => router.push(`/stories?open=${story.id}`) },
    })
  }

  return (
    <PageContainer>
      <PageHeader
        title="Turn Experience Into Content"
        description={t("description")}
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/stories">
              <BookOpen aria-hidden />
              Story Vault
            </Link>
          </Button>
        }
      />

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <SectionCard
          title={t("what_happened")}
          description={t("what_happened_description")}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              generate()
            }}
            className="flex min-w-0 flex-col gap-3"
          >
            <Textarea
              id={`${id}-experience`}
              aria-label={t("what_happened")}
              rows={6}
              className="min-h-36"
              value={text}
              maxLength={MAX_CHARS}
              placeholder={t("placeholder")}
              onChange={(event) => setExperiencePageState({ text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  generate()
                }
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {length > 0 && !ready ? t("keep_going", { count: MIN_EXPERIENCE_CHARS }) : t("hint")}
              </span>
              <span className="num">
                {formatNumber(text.length)} / {formatNumber(MAX_CHARS)}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <FormField label={t("pillar_optional")} htmlFor={`${id}-pillar`} className="w-full sm:w-64">
                <PillarSelect
                  id={`${id}-pillar`}
                  size="sm"
                  allowNone
                  noneLabel={t("let_ai_choose")}
                  placeholder={t("let_ai_choose")}
                  value={page.pillarId}
                  onChange={(pillarId) => setExperiencePageState({ pillarId })}
                />
              </FormField>
              <div className="ml-auto flex items-center gap-2">
                {text ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExperiencePageState({ text: "" })}>
                    {c("clear")}
                  </Button>
                ) : null}
                <AiButton type="submit" size="sm" variant="default" pending={pending} disabled={!ready}>
                  {t("turn_into_content")}
                </AiButton>
              </div>
            </div>
          </form>
        </SectionCard>
        <RecentStories />
      </div>

      {session.error && !session.drafts.length ? <AiErrorNotice message={session.error} onRetry={generate} /> : null}

      {hasResults ? (
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="min-w-0 xl:sticky xl:top-4">
            {extracted ? (
              <ExperienceStoryCard
                key={session.request}
                story={extracted}
                provider={session.provider}
                model={session.model}
                savedStory={savedStory}
                defaultPillarId={page.pillarId ?? mostCommon(session.drafts.map((d) => d.pillar_id))}
                onChange={(patch) => updateSessionStory(EXPERIENCE_SESSION, patch)}
                onSaved={onStorySaved}
              />
            ) : (
              <Skeleton className="h-[28rem] w-full rounded-lg" aria-hidden />
            )}
          </div>
          <section aria-label={t("angles_label")} className="min-w-0">
            <AngleResults
              sessionKey={EXPERIENCE_SESSION}
              origin={origin}
              canRegenerate={ready}
              onRegenerate={generate}
              columns={2}
              notice={t("results_notice")}
            />
          </section>
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            text ? undefined : (
              <Button type="button" size="sm" variant="outline" onClick={() => setExperiencePageState({ text: EXAMPLE })}>
                {t("try_example")}
              </Button>
            )
          }
        />
      )}
    </PageContainer>
  )
}
