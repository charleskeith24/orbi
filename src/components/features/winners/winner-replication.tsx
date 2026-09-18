"use client"

import { BookmarkPlus, Check, Lightbulb } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, IdeaStatusBadge, InlineText, PageSection, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { buildWinnerReplicationInput, useAiTask } from "@/lib/ai"
import { useT } from "@/lib/i18n"
import { createIdea, useDataStore, useTable } from "@/lib/store"
import type { ContentIdea, ContentItem, ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { AiErrorNotice } from "./ai-error-notice"
import { winnersMessages } from "./messages"
import {
  draftsFromOutput,
  getReplicationSession,
  ideaSignature,
  ideasFromWinner,
  REPLICATION_GROUPS,
  replicationIdeaValues,
  setReplicationSession,
  type ReplicationDraft,
  type ReplicationSession,
} from "./replication-model"

const SAVED_LIMIT = 5

function DraftRow({
  draft,
  savedId,
  onEdit,
  onSave,
}: {
  draft: ReplicationDraft
  savedId: ID | null
  onEdit: (key: string, patch: Partial<Pick<ReplicationDraft, "title" | "hook">>) => void
  onSave: (draft: ReplicationDraft) => void
}) {
  const t = useT(winnersMessages)
  return (
    <li className="flex min-w-0 flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <InlineText
          value={draft.title}
          onSave={(title) => onEdit(draft.key, { title })}
          required
          maxLength={200}
          placeholder={t("untitled_idea")}
          aria-label={t("idea_title_aria")}
          className="font-medium"
        />
        <InlineText
          value={draft.hook}
          onSave={(hook) => onEdit(draft.key, { hook })}
          multiline
          maxLength={500}
          placeholder={t("add_hook")}
          aria-label={t("hook")}
          className="text-xs text-muted-foreground"
        />
        {draft.angle ? (
          <span className="mt-1 inline-flex h-5 w-fit items-center rounded-md border px-1.5 text-xs text-muted-foreground">{draft.angle}</span>
        ) : null}
      </div>
      {savedId ? (
        <Button asChild variant="ghost" size="xs" className="shrink-0 text-good-fg">
          <Link href={`/ideas?open=${savedId}`}>
            <Check aria-hidden />
            {t("saved_open")}
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" size="xs" className="shrink-0" onClick={() => onSave(draft)} disabled={!draft.title.trim()}>
          <BookmarkPlus aria-hidden />
          {t("save_as_idea")}
        </Button>
      )}
    </li>
  )
}

function SavedIdeas({ ideas }: { ideas: ContentIdea[] }) {
  const t = useT(winnersMessages)
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? ideas : ideas.slice(0, SAVED_LIMIT)
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="border-b pb-1.5 text-xs font-medium text-muted-foreground">{t("saved_from", { count: ideas.length })}</h4>
      <ul className="flex flex-col">
        {shown.map((idea) => (
          <li key={idea.id} className="flex min-w-0 items-center gap-2 py-1">
            <Lightbulb className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <Link
              href={`/ideas?open=${idea.id}`}
              className="min-w-0 flex-1 truncate text-sm outline-none hover:underline focus-visible:underline"
              title={idea.title}
            >
              {idea.title || t("untitled_idea")}
            </Link>
            <IdeaStatusBadge status={idea.status} />
          </li>
        ))}
      </ul>
      {ideas.length > SAVED_LIMIT ? (
        <Button type="button" variant="ghost" size="xs" className="self-start text-muted-foreground" onClick={() => setShowAll((v) => !v)}>
          {showAll ? t("show_less") : t("show_all", { count: ideas.length })}
        </Button>
      ) : null}
    </div>
  )
}

/** "Create more content like this": winner_replication drafts, editable, saved to the Idea Bank one by one or all at once. */
export function WinnerReplication({ item, ratio }: { item: ContentItem; ratio: number | null }) {
  const t = useT(winnersMessages)
  const router = useRouter()
  const ai = useAiTask("winner_replication")
  const ideas = useTable("content_ideas")
  const [session, setSession] = useState<ReplicationSession | null>(() => getReplicationSession(item.id))

  const saved = useMemo(() => ideasFromWinner(ideas, item.id), [ideas, item.id])
  const savedIds = useMemo(() => new Set(saved.map((i) => i.id)), [saved])
  const bySignature = useMemo(() => new Map(saved.map((i) => [ideaSignature(i), i.id])), [saved])

  function savedIdOf(draft: ReplicationDraft): ID | null {
    const recorded = session?.saved[draft.key]
    if (recorded && savedIds.has(recorded)) return recorded
    return bySignature.get(ideaSignature(draft)) ?? null
  }

  function commit(next: ReplicationSession) {
    setReplicationSession(item.id, next)
    setSession(next)
  }

  async function generate() {
    const input = buildWinnerReplicationInput(useDataStore.getState().db, item.id, new Date())
    if (!input) {
      toast.error(t("only_published_replicated"))
      return
    }
    const result = await ai.run(input, { entityType: "content_items", entityId: item.id })
    if (!result) return
    commit({ drafts: draftsFromOutput(result.output), provider: result.provider, model: result.model, saved: {} })
  }

  function editDraft(key: string, patch: Partial<Pick<ReplicationDraft, "title" | "hook">>) {
    if (!session) return
    commit({ ...session, drafts: session.drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)) })
  }

  function saveDraft(draft: ReplicationDraft) {
    if (!session || !draft.title.trim()) return
    const idea = createIdea(replicationIdeaValues(useDataStore.getState().db, item, draft, ratio))
    commit({ ...session, saved: { ...session.saved, [draft.key]: idea.id } })
    toast.success(t("saved_to_bank"), {
      description: idea.title,
      action: { label: t("open"), onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
  }

  function saveAll() {
    if (!session) return
    const todo = session.drafts.filter((d) => d.title.trim() && !savedIdOf(d))
    if (!todo.length) return
    const db = useDataStore.getState().db
    const next = { ...session.saved }
    for (const draft of todo) next[draft.key] = createIdea(replicationIdeaValues(db, item, draft, ratio)).id
    commit({ ...session, saved: next })
    toast.success(t.plural("saved_all", todo.length, { count: formatNumber(todo.length) }), {
      description: t("source_replication"),
      action: { label: t("open_bank"), onClick: () => router.push("/ideas") },
    })
  }

  const unsaved = session ? session.drafts.filter((d) => d.title.trim() && !savedIdOf(d)).length : 0

  return (
    <PageSection
      id="winner-replicate"
      title={t("replicate_title")}
      description={t("replicate_description")}
      action={
        <AiButton size="sm" variant={session ? "outline" : "default"} pending={ai.isPending} onClick={generate}>
          {session ? t("regenerate") : t("generate_ideas")}
        </AiButton>
      }
    >
      <AiErrorNotice error={ai.error} onRetry={generate} pending={ai.isPending} />
      {session ? (
        <div className="flex flex-col gap-4" aria-busy={ai.isPending || undefined}>
          <div className="flex flex-wrap items-center gap-2">
            <ProviderBadge provider={session.provider} model={session.model} />
            <AiNotice className="min-w-0 flex-1 basis-48">{t("click_to_edit")}</AiNotice>
            <Button type="button" size="sm" variant="outline" onClick={saveAll} disabled={!unsaved}>
              <BookmarkPlus aria-hidden />
              {unsaved ? t("save_all", { count: unsaved }) : t("all_saved")}
            </Button>
          </div>
          {REPLICATION_GROUPS.map((group) => {
            const drafts = session.drafts.filter((d) => d.group === group.key)
            if (!drafts.length) return null
            return (
              <div key={group.key} className="flex min-w-0 flex-col">
                <h4 className="flex flex-wrap items-baseline gap-x-2 border-b pb-1.5 text-xs font-medium">
                  {t(`group_${group.key}`)}
                  <span className="font-normal text-muted-foreground">{t(`group_${group.key}_description`)}</span>
                </h4>
                <ul className="divide-y divide-border/60">
                  {drafts.map((draft) => (
                    <DraftRow key={draft.key} draft={draft} savedId={savedIdOf(draft)} onEdit={editDraft} onSave={saveDraft} />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ) : ai.isPending ? (
        <div className="flex flex-col gap-3" aria-label={t("generating_aria")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-pretty text-muted-foreground">
          {t("replicate_empty")}
        </p>
      )}
      {saved.length ? <SavedIdeas ideas={saved} /> : null}
    </PageSection>
  )
}
