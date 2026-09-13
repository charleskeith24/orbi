"use client"

import { subDays } from "date-fns"
import { CircleCheck, Lightbulb, MessageCircleQuestion, Plus, SearchX } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ColorDot,
  EmptyState,
  FacetFilter,
  FilterBar,
  PageContainer,
  PageHeader,
  PlatformIcon,
  ResetFiltersButton,
  SearchInput,
  StatTile,
  type FacetOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import { useTable } from "@/lib/store"
import type { AudienceQuestion, ID, PlatformId } from "@/lib/types"
import { formatNumber, formatPercent, matchesQuery, pluralize, sum, truncate } from "@/lib/utils"
import {
  isQuestionView,
  NONE,
  parseIdList,
  questionPriority,
  questionView,
  sortPersonas,
  type QuestionView,
} from "./audience-model"
import { AnswerDialog } from "./answer-dialog"
import { MissingLinkNotice } from "./missing-link-notice"
import { useQuestionActions } from "./question-actions"
import { QuestionFormDialog } from "./question-form-dialog"
import { QuestionQuickAdd, type QuestionDefaults } from "./question-quick-add"
import { QuestionSheet } from "./question-sheet"
import { QuestionTable } from "./question-table"
import { useUrlState } from "./use-url-state"

const URL_KEYS = ["open", "tab", "q", "persona", "pillar", "platform", "new"] as const
const VIEW_TABS: { value: QuestionView; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "answered", label: "Answered" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
]
const PLATFORM_SET = new Set<string>(PLATFORM_IDS)

function TabCount({ value }: { value: number }) {
  return <span className="text-xs font-normal text-muted-foreground num">{formatNumber(value)}</span>
}

/**
 * Question Bank (spec §54): what the audience asks, counted and prioritised by repeats, turned into
 * ideas and linked to the content that answers it. URL: `?tab=open|answered|dismissed|all`, `?q=`,
 * `?persona=`, `?pillar=`, `?platform=` (comma lists), `?new=1` (add dialog), `?open=<questionId>`.
 */
export function QuestionBankView() {
  const [url, update] = useUrlState(URL_KEYS)
  const questions = useTable("audience_questions")
  const personas = useTable("audience_personas")
  const pillars = useTable("content_pillars")
  const [now] = useState(() => new Date())
  const [answer, setAnswer] = useState<{ open: boolean; id: ID | null }>({ open: false, id: null })

  const personaById = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])
  const pillarById = useMemo(() => new Map(pillars.map((p) => [p.id, p])), [pillars])

  const view: QuestionView = isQuestionView(url.tab) ? url.tab : "open"
  const personaFilter = useMemo(
    () => parseIdList(url.persona).filter((id) => id === NONE || personaById.has(id)),
    [url.persona, personaById]
  )
  const pillarFilter = useMemo(
    () => parseIdList(url.pillar).filter((id) => id === NONE || pillarById.has(id)),
    [url.pillar, pillarById]
  )
  const platformFilter = useMemo(
    () => parseIdList(url.platform).filter((value) => value === NONE || PLATFORM_SET.has(value)),
    [url.platform]
  )
  const filtering = Boolean(url.q.trim() || personaFilter.length || pillarFilter.length || platformFilter.length)

  // Every filter except the status tab, so each tab can show how many questions match.
  const filtered = useMemo(
    () =>
      questions.filter((q) => {
        if (personaFilter.length && !personaFilter.includes(q.persona_id ?? NONE)) return false
        if (pillarFilter.length && !pillarFilter.includes(q.pillar_id ?? NONE)) return false
        if (platformFilter.length && !platformFilter.includes(q.platform ?? NONE)) return false
        const persona = q.persona_id ? personaById.get(q.persona_id) : undefined
        const pillar = q.pillar_id ? pillarById.get(q.pillar_id) : undefined
        return matchesQuery(
          url.q,
          q.question,
          q.topic,
          q.source_person,
          persona?.name,
          pillar?.name,
          q.platform ? PLATFORMS[q.platform].label : ""
        )
      }),
    [questions, personaFilter, pillarFilter, platformFilter, personaById, pillarById, url.q]
  )

  const viewCounts = useMemo(() => {
    const counts: Record<QuestionView, number> = { open: 0, answered: 0, dismissed: 0, all: filtered.length }
    for (const q of filtered) counts[questionView(q.status)] += 1
    return counts
  }, [filtered])
  const visible = useMemo(
    () => (view === "all" ? filtered : filtered.filter((q) => questionView(q.status) === view)),
    [filtered, view]
  )

  const stats = useMemo(() => {
    const open = questions.filter((q) => questionView(q.status) === "open")
    const weekStart = toISODate(subDays(now, 6))
    return {
      open: open.length,
      highOpen: open.filter((q) => questionPriority(q.frequency) === "high").length,
      recent: questions.filter((q) => q.last_asked_at >= weekStart).length,
      asks: sum(questions.map((q) => q.frequency)),
      ideas: questions.filter((q) => q.idea_id).length,
      answered: questions.filter((q) => q.status === "answered").length,
    }
  }, [questions, now])
  const shareOf = (count: number) => formatPercent(questions.length ? (count / questions.length) * 100 : 0, 0)

  const facets = useMemo(() => {
    const count = (match: (q: AudienceQuestion) => boolean) => questions.filter(match).length
    const persona: FacetOption[] = [
      ...sortPersonas(personas).map((p) => ({
        value: p.id,
        label: p.name || "Untitled persona",
        count: count((q) => q.persona_id === p.id),
        icon: <ColorDot color={p.color} />,
      })),
      { value: NONE, label: "No persona", count: count((q) => !q.persona_id) },
    ]
    const pillar: FacetOption[] = [
      ...pillars
        .filter((p) => p.is_active || questions.some((q) => q.pillar_id === p.id))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({
          value: p.id,
          label: p.name || "Untitled pillar",
          count: count((q) => q.pillar_id === p.id),
          icon: <ColorDot color={p.color} />,
        })),
      { value: NONE, label: "No pillar", count: count((q) => !q.pillar_id) },
    ]
    const platform: FacetOption[] = [
      ...PLATFORM_IDS.map((id) => ({
        value: id,
        label: PLATFORMS[id].label,
        count: count((q) => q.platform === id),
        icon: <PlatformIcon platform={id} className="size-3.5 text-muted-foreground" />,
      })),
      { value: NONE, label: "No platform", count: count((q) => !q.platform) },
    ]
    return { persona, pillar, platform }
  }, [questions, personas, pillars])

  const setOpen = useCallback((id: ID | null) => update({ open: id ?? "" }), [update])
  const actions = useQuestionActions({
    onOpen: setOpen,
    onAnswer: (question) => setAnswer({ open: true, id: question.id }),
    onDeleted: (id) => {
      if (url.open === id) setOpen(null)
    },
  })

  // `?open=<id>` drives the sheet; keep the last question mounted while the sheet animates out.
  const openQuestion = url.open ? questions.find((q) => q.id === url.open) : undefined
  const [shownId, setShownId] = useState<ID | null>(openQuestion ? openQuestion.id : null)
  if (openQuestion && openQuestion.id !== shownId) setShownId(openQuestion.id)
  const shownQuestion = shownId ? (questions.find((q) => q.id === shownId) ?? null) : null
  const answerQuestion = answer.id ? (questions.find((q) => q.id === answer.id) ?? null) : null

  const single = (values: string[]) => (values.length === 1 && values[0] !== NONE ? values[0] : null)
  const defaults: QuestionDefaults = {
    persona_id: single(personaFilter),
    pillar_id: single(pillarFilter),
    platform: single(platformFilter) as PlatformId | null,
  }
  const resetFilters = () => update({ q: "", persona: "", pillar: "", platform: "" })

  function onCreated(question: AudienceQuestion) {
    update({ new: "" })
    toast.success("Question added to the bank", {
      description: truncate(question.question, 80),
      action: { label: "Open", onClick: () => setOpen(question.id) },
    })
  }

  const viewLabel = VIEW_TABS.find((t) => t.value === view)?.label.toLowerCase() ?? ""
  const empty =
    view !== "all" && viewCounts.all > 0 ? (
      <EmptyState
        compact
        icon={view === "open" ? CircleCheck : SearchX}
        title={view === "open" && !filtering ? "No open questions" : `No ${viewLabel} questions${filtering ? " match" : ""}`}
        description={
          view === "open" && !filtering
            ? "Everything your audience asked has an answer or was dismissed. Log new questions above as they come in."
            : `${pluralize(viewCounts.all, "question")} ${viewCounts.all === 1 ? "matches" : "match"} in other tabs.`
        }
        action={
          <Button type="button" size="sm" variant="outline" onClick={() => update({ tab: "all" })}>
            Show all questions
          </Button>
        }
      />
    ) : (
      <EmptyState
        compact
        icon={SearchX}
        title="No questions match"
        description="Try a different search or fewer filters."
        action={
          <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
            Reset filters
          </Button>
        }
      />
    )

  return (
    <PageContainer>
      <PageHeader
        title="Question Bank"
        description="Questions your audience keeps asking — counted, prioritised by repeats and turned into content that answers them."
        actions={
          <Button type="button" size="sm" onClick={() => update({ new: "1" })}>
            <Plus aria-hidden />
            Add question
          </Button>
        }
      />

      {url.open && !openQuestion ? <MissingLinkNotice entity="question" onDismiss={() => setOpen(null)} /> : null}

      {questions.length ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Open questions"
              icon={MessageCircleQuestion}
              value={formatNumber(stats.open)}
              sublabel={`${formatNumber(stats.highOpen)} asked 5+ times`}
            />
            <StatTile
              label="Asked in the last 7 days"
              value={formatNumber(stats.recent)}
              sublabel={`${formatNumber(stats.asks)} asks logged in total`}
            />
            <StatTile label="Turned into ideas" icon={Lightbulb} value={formatNumber(stats.ideas)} sublabel={`${shareOf(stats.ideas)} of questions`} />
            <StatTile
              label="Answered in content"
              icon={CircleCheck}
              value={formatNumber(stats.answered)}
              sublabel={`${shareOf(stats.answered)} of questions`}
            />
          </div>

          <Tabs value={view} onValueChange={(next) => update({ tab: next === "open" ? "" : next })} className="min-w-0 gap-3">
            <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
              <TabsList variant="line" aria-label="Question status">
                {VIEW_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex-none">
                    {tab.label} <TabCount value={viewCounts[tab.value]} />
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <QuestionQuickAdd defaults={defaults} onOpen={setOpen} />

            <FilterBar
              actions={
                <span className="text-xs text-muted-foreground num" aria-live="polite">
                  {visible.length === questions.length
                    ? pluralize(questions.length, "question")
                    : `${formatNumber(visible.length)} of ${pluralize(questions.length, "question")}`}
                </span>
              }
            >
              <SearchInput value={url.q} onChange={(q) => update({ q })} placeholder="Search questions…" />
              <FacetFilter title="Persona" options={facets.persona} value={personaFilter} onChange={(v) => update({ persona: v.join(",") })} />
              <FacetFilter title="Pillar" options={facets.pillar} value={pillarFilter} onChange={(v) => update({ pillar: v.join(",") })} />
              <FacetFilter title="Platform" options={facets.platform} value={platformFilter} onChange={(v) => update({ platform: v.join(",") })} />
              <ResetFiltersButton show={filtering} onClick={resetFilters} />
            </FilterBar>

            <TabsContent value={view} className="min-w-0">
              <QuestionTable questions={visible} pillars={pillarById} now={now} actions={actions} empty={empty} />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <EmptyState
          icon={MessageCircleQuestion}
          title="Your Question Bank is empty"
          description="Log the questions people ask in comments and DMs. The ones asked again and again are your best content ideas."
          action={
            <Button type="button" size="sm" onClick={() => update({ new: "1" })}>
              <Plus aria-hidden />
              Add question
            </Button>
          }
        />
      )}

      <QuestionSheet
        question={shownQuestion}
        open={Boolean(openQuestion)}
        actions={actions}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
      />
      <AnswerDialog
        question={answerQuestion}
        open={answer.open && Boolean(answerQuestion)}
        onOpenChange={(next) => setAnswer((a) => ({ ...a, open: next }))}
        onPick={(question, itemId) => {
          actions.answer(question, itemId)
          setAnswer((a) => ({ ...a, open: false }))
        }}
      />
      <QuestionFormDialog
        open={url.new === "1"}
        defaults={defaults}
        onOpenChange={(next) => update({ new: next ? "1" : "" })}
        onCreated={onCreated}
      />
      {actions.confirmDialog}
    </PageContainer>
  )
}
