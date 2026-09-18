"use client"

import { ArrowUpRight, BookmarkPlus, Check, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { InlineText, PillarBadge, PlatformLabel } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { createIdea, dataActions, useDataStore, useTable } from "@/lib/store"
import type { ContentIdea, Database, ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { strategistIdeasMessages } from "./strategist-messages"
import { clip, withSavedIdeas, type StrategistTurn, type SuggestedIdea } from "./turns"

const INITIAL = 3

interface Draft {
  title: string
  hook: string
}

function formatIdByName(db: Database, name: string): ID | null {
  const key = name.trim().toLowerCase()
  return key ? (db.content_formats.find((f) => f.name.trim().toLowerCase() === key)?.id ?? null) : null
}

function saveIdea(db: Database, idea: SuggestedIdea, draft: Draft, question: string): ContentIdea {
  return createIdea({
    title: draft.title.trim() || idea.title,
    hook: draft.hook.trim(),
    pillar_id: idea.pillar_id && db.content_pillars.some((p) => p.id === idea.pillar_id) ? idea.pillar_id : null,
    platforms: [idea.platform],
    format_id: formatIdByName(db, idea.format),
    source: "strategist",
    status: "inbox",
    inspiration: question ? `Content Strategist · “${clip(question, 160)}”` : "Content Strategist",
  })
}

/** Records saved suggestions on the turn's log row, so "Saved" survives reloads and edited titles. */
function recordSaved(turnId: ID, saved: Record<string, ID>) {
  const row = useDataStore.getState().db.ai_generations.find((r) => r.id === turnId)
  if (row) dataActions.update("ai_generations", turnId, { input: withSavedIdeas(row.input, saved) })
}

/** Ideas the strategist suggested in one answer: editable, then saved to the Idea Bank (source "strategist"). */
export function SuggestedIdeas({ turn, onNavigate }: { turn: StrategistTurn; onNavigate?: () => void }) {
  const router = useRouter()
  const ideaRows = useTable("content_ideas")
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [expanded, setExpanded] = useState(false)
  const t = useT(strategistIdeasMessages)
  const c = useT(commonMessages)

  const savedIdeas = useMemo(() => {
    const byId = new Map(ideaRows.map((idea) => [idea.id, idea]))
    const byTitle = new Map(
      ideaRows.filter((idea) => idea.source === "strategist").map((idea) => [idea.title.trim().toLowerCase(), idea])
    )
    return turn.ideas.map((idea, index) => {
      const recorded = turn.saved[String(index)]
      return (recorded ? byId.get(recorded) : undefined) ?? byTitle.get(idea.title.trim().toLowerCase()) ?? null
    })
  }, [ideaRows, turn])

  const draftOf = (index: number): Draft => drafts[index] ?? { title: turn.ideas[index].title, hook: turn.ideas[index].hook }

  function open(href: string) {
    onNavigate?.()
    router.push(href)
  }

  function save(index: number) {
    const created = saveIdea(useDataStore.getState().db, turn.ideas[index], draftOf(index), turn.question)
    recordSaved(turn.id, { [String(index)]: created.id })
    toast.success(t("saved"), {
      description: created.title,
      action: { label: c("open"), onClick: () => open(`/ideas?open=${created.id}`) },
    })
  }

  function saveAll() {
    const db = useDataStore.getState().db
    const saved: Record<string, ID> = {}
    turn.ideas.forEach((idea, index) => {
      if (!savedIdeas[index]) saved[String(index)] = saveIdea(db, idea, draftOf(index), turn.question).id
    })
    const count = Object.keys(saved).length
    if (!count) return
    recordSaved(turn.id, saved)
    toast.success(t("saved_all", { count }), { action: { label: t("open_bank"), onClick: () => open("/ideas") } })
  }

  const unsaved = savedIdeas.filter((idea) => !idea).length
  const shown = expanded ? turn.ideas : turn.ideas.slice(0, INITIAL)

  return (
    <section aria-label={t("section_label")} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">{t("heading", { count: turn.ideas.length })}</h4>
        {unsaved > 1 ? (
          <Button type="button" variant="ghost" size="xs" onClick={saveAll}>
            <BookmarkPlus aria-hidden />
            {t("save_all", { count: unsaved })}
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((idea, index) => (
          <IdeaCard
            key={`${index}-${idea.title}`}
            idea={idea}
            draft={draftOf(index)}
            saved={savedIdeas[index]}
            onChange={(draft) => setDrafts((prev) => ({ ...prev, [index]: draft }))}
            onSave={() => save(index)}
            onOpen={(id) => open(`/ideas?open=${id}`)}
          />
        ))}
      </ul>
      {turn.ideas.length > INITIAL ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="self-start text-muted-foreground"
        >
          {expanded ? t("show_fewer") : t("show_all", { count: turn.ideas.length })}
          <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
        </Button>
      ) : null}
    </section>
  )
}

function IdeaCard({
  idea,
  draft,
  saved,
  onChange,
  onSave,
  onOpen,
}: {
  idea: SuggestedIdea
  draft: Draft
  saved: ContentIdea | null
  onChange: (draft: Draft) => void
  onSave: () => void
  onOpen: (id: ID) => void
}) {
  const hook = saved ? saved.hook : draft.hook
  const t = useT(strategistIdeasMessages)
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-3 dark:bg-input/20">
      {saved ? (
        <p className="text-sm leading-5 font-medium break-words">{saved.title}</p>
      ) : (
        <InlineText
          value={draft.title}
          onSave={(title) => onChange({ ...draft, title })}
          required
          maxLength={200}
          aria-label={t("idea_title")}
          className="font-medium"
        />
      )}
      <div className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
        <span className="shrink-0 font-medium">{t("hook")}</span>
        {saved ? (
          <span className="min-w-0 break-words">{hook || "—"}</span>
        ) : (
          <InlineText
            value={draft.hook}
            onSave={(value) => onChange({ ...draft, hook: value })}
            multiline
            maxLength={300}
            placeholder={t("add_hook")}
            aria-label={t("hook")}
            className="min-w-0 flex-1 text-xs leading-5"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <PlatformLabel platform={idea.platform} className="text-xs text-muted-foreground" />
          {idea.pillar_id ? <PillarBadge pillarId={idea.pillar_id} /> : null}
          {idea.format ? <span className="text-xs text-muted-foreground">{idea.format}</span> : null}
        </div>
        {saved ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => onOpen(saved.id)}>
            <Check className="text-good-fg" aria-hidden />
            {t("saved_open")}
            <ArrowUpRight aria-hidden />
          </Button>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={onSave}>
            <BookmarkPlus aria-hidden />
            {t("save")}
          </Button>
        )}
      </div>
    </li>
  )
}
