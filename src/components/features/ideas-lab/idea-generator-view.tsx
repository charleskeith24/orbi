"use client"

import { Lightbulb, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AiNotice, PageContainer, PageHeader, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useAiStatus, useAiTask } from "@/lib/ai"
import { createIdea, dataActions, useDb, useLookup, useSettings } from "@/lib/store"
import type { ContentIdea } from "@/lib/types"
import { uid } from "@/lib/utils"
import type { DraftLookups } from "./generated-idea-card"
import { GeneratorEmptyState } from "./generator-empty"
import { GeneratorBriefForm } from "./generator-form"
import {
  briefToInput,
  clampCount,
  draftFromIdea,
  draftToIdeaValues,
  EMPTY_BRIEF,
  exampleBriefs,
  moreLikeThisBrief,
  recentGenerations,
  titleKey,
  type ExampleBrief,
  type GeneratedBatch,
  type GeneratedDraft,
  type GeneratorBrief,
  type LoggedGeneration,
} from "./generator-model"
import { GeneratorResults, type PendingJob } from "./generator-results"
import { generatorActions, useGeneratorStore } from "./generator-store"
import { LabAiError } from "./lab-ai-error"
import { RecentGenerations } from "./recent-generations"
import { useGeneratorUrl } from "./use-generator-url"
import { useNow } from "./use-now"

interface Job extends PendingJob {
  /** Mirror the brief to the URL and remember it (form, examples, recent briefs — not "More like this"). */
  writeUrl: boolean
}

function isNarrowScreen(): boolean {
  return window.matchMedia("(max-width: 1023px)").matches
}

const selectableKeys = (batch: GeneratedBatch) => batch.drafts.filter((d) => !d.saved_idea_id && d.title.trim()).map((d) => d.key)

/**
 * Content Idea Generator (spec §11): a brief — pillar, audience, platform, goal, topic, funnel stage,
 * angle, problem, format, count — becomes strategic ideas via `generate_ideas`. Prefilled from the URL
 * (`run=1` generates on load); results stay editable until saved to the Idea Bank; every batch can be
 * regenerated, expanded ("More like this") or restored from the AI log.
 */
export function IdeaGeneratorView() {
  const router = useRouter()
  const db = useDb()
  const settings = useSettings()
  const status = useAiStatus()
  const ai = useAiTask("generate_ideas")
  const now = useNow()
  const url = useGeneratorUrl(db)
  const batches = useGeneratorStore((s) => s.batches)
  const hidden = useGeneratorStore((s) => s.hidden)
  const pillars = useLookup("content_pillars")
  const personas = useLookup("audience_personas")
  const problems = useLookup("audience_problems")
  const formats = useLookup("content_formats")
  const angles = useLookup("angles")
  const lookups = useMemo<DraftLookups>(() => ({ pillars, personas, problems, formats, angles }), [pillars, personas, problems, formats, angles])

  // The brief form owns its state; it remounts (new key) when a brief is loaded from outside it.
  const [form, setForm] = useState(() => ({
    key: 0,
    brief: url.parsed.hasBrief ? url.parsed.brief : (useGeneratorStore.getState().lastBrief ?? EMPTY_BRIEF),
  }))
  const [urlNonce, setUrlNonce] = useState(url.nonce)
  const [ignored, setIgnored] = useState(url.parsed.ignored)
  const [autoRun, setAutoRun] = useState(url.parsed.run ? 1 : 0)
  if (url.nonce !== urlNonce) {
    setUrlNonce(url.nonce)
    setIgnored(url.parsed.ignored)
    if (url.parsed.hasBrief) setForm((f) => ({ key: f.key + 1, brief: url.parsed.brief }))
    if (url.parsed.run) setAutoRun((n) => n + 1)
  }

  const [job, setJob] = useState<Job | null>(null)
  const [lastJob, setLastJob] = useState<Job | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const formRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(() => batches.filter((b) => !hidden.includes(b.id)), [batches, hidden])
  const visibleIds = useMemo(() => new Set(visible.map((b) => b.generationId ?? b.id)), [visible])
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const examples = useMemo(() => exampleBriefs(db, now, settings), [db, now, settings])
  const recent = useMemo(() => recentGenerations(db.ai_generations, db), [db])
  const ideaTitles = useMemo(() => {
    const map = new Map<string, ContentIdea>()
    for (const idea of db.content_ideas) {
      const key = titleKey(idea.title)
      if (key && !map.has(key)) map.set(key, idea)
    }
    return map
  }, [db.content_ideas])
  const busy = ai.isPending

  const isOpen = (batch: GeneratedBatch, index: number) => open[batch.id] ?? index === 0

  function scrollToResults() {
    if (isNarrowScreen()) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  async function start(next: Job) {
    if (busy) return
    setJob(next)
    setLastJob(next)
    if (next.writeUrl) {
      url.write(next.brief)
      generatorActions.setLastBrief(next.brief)
    }
    const before = visible
    const result = await ai.run(briefToInput(next.brief, dataActions.getDb().angles))
    setJob((current) => (current === next ? null : current))
    if (!result) return

    const id = result.generationId ?? uid()
    const database = dataActions.getDb()
    generatorActions.addBatch({
      id,
      kind: next.kind,
      sourceTitle: next.sourceTitle,
      brief: next.brief,
      requested: clampCount(next.brief.count),
      drafts: result.output.ideas.map((idea, index) => draftFromIdea(idea, database, `${id}:${index}`)),
      provider: result.provider,
      model: result.model,
      createdAt: new Date().toISOString(),
      generationId: result.generationId,
      trimmed: false,
    })
    // A new brief focuses the new batch; "More like this" keeps the batch it came from open.
    setOpen((current) => {
      const nextOpen: Record<string, boolean> = { [id]: true }
      before.forEach((batch, index) => {
        nextOpen[batch.id] = next.kind === "more" ? (current[batch.id] ?? index === 0) : false
      })
      return nextOpen
    })
    if (!next.origin.startsWith("draft:")) scrollToResults()
  }

  // `?…&run=1` (Problem Bank, Content Matrix, Angle Library, Calendar): generate once the page is up.
  // A timer (cleared on cleanup) keeps React's dev double-mount from firing — and aborting — a first request.
  const runFromUrl = useEffectEvent(() => {
    void start({ origin: "form", kind: "brief", brief: url.parsed.brief, sourceTitle: null, writeUrl: true })
  })
  useEffect(() => {
    if (!autoRun) return
    const timer = window.setTimeout(() => runFromUrl(), 0)
    return () => window.clearTimeout(timer)
  }, [autoRun])

  function save(entries: { batch: GeneratedBatch; draft: GeneratedDraft }[]) {
    const database = dataActions.getDb()
    const todo = entries.filter(({ draft }) => !draft.saved_idea_id && draft.title.trim())
    if (!todo.length) return
    const created = todo.map(({ batch, draft }) => ({ key: draft.key, idea: createIdea(draftToIdeaValues(draft, batch.brief, database)) }))
    generatorActions.markSaved(created.map(({ key, idea }) => ({ key, ideaId: idea.id })))
    const savedKeys = new Set(created.map((c) => c.key))
    setSelectedKeys((keys) => keys.filter((key) => !savedKeys.has(key)))
    const first = created[0].idea
    const many = created.length > 1
    toast.success(many ? `Saved ${created.length} ideas to the Idea Bank` : "Saved to the Idea Bank", {
      description: many ? "They're in your Inbox, marked as from the Idea Generator." : first.title,
      action: {
        label: many ? "View ideas" : "Open",
        onClick: () => router.push(many ? "/ideas?source=ai_generator&sort=created" : `/ideas?open=${first.id}`),
      },
    })
  }

  function saveSelected() {
    save(visible.flatMap((batch) => batch.drafts.filter((draft) => selected.has(draft.key)).map((draft) => ({ batch, draft }))))
  }

  function setDraftSelected(key: string, value: boolean) {
    setSelectedKeys((keys) => (value ? (keys.includes(key) ? keys : [...keys, key]) : keys.filter((k) => k !== key)))
  }

  function selectBatch(batch: GeneratedBatch, value: boolean) {
    const keys = selectableKeys(batch)
    setSelectedKeys((current) => (value ? [...new Set([...current, ...keys])] : current.filter((k) => !keys.includes(k))))
  }

  function selectAll() {
    setSelectedKeys(visible.flatMap((batch, index) => (isOpen(batch, index) ? selectableKeys(batch) : [])))
  }

  function more(batch: GeneratedBatch, draft: GeneratedDraft) {
    void start({ origin: `draft:${draft.key}`, kind: "more", brief: moreLikeThisBrief(batch.brief, draft), sourceTitle: draft.title, writeUrl: false })
  }

  function regenerate(batch: GeneratedBatch) {
    void start({
      origin: `batch:${batch.id}`,
      kind: batch.kind === "more" ? "more" : "brief",
      brief: batch.brief,
      sourceTitle: batch.sourceTitle,
      writeUrl: false,
    })
  }

  function dismiss(batch: GeneratedBatch) {
    generatorActions.hideBatch(batch.id)
    const keys = new Set(batch.drafts.map((d) => d.key))
    setSelectedKeys((current) => current.filter((k) => !keys.has(k)))
    toast.success("Batch dismissed", {
      description: "It stays in Recent generations.",
      action: { label: "Undo", onClick: () => generatorActions.showBatch(batch.id) },
    })
  }

  function clearResults() {
    const previous = useGeneratorStore.getState().hidden
    generatorActions.hideAll()
    setSelectedKeys([])
    toast.success("Results cleared", {
      description: "Bring any batch back from Recent generations.",
      action: { label: "Undo", onClick: () => generatorActions.setHidden(previous) },
    })
  }

  function restore(generation: LoggedGeneration) {
    const existing = batches.find((b) => b.id === generation.id || b.generationId === generation.id)
    if (existing) {
      generatorActions.showBatch(existing.id)
      setOpen((current) => ({ ...current, [existing.id]: true }))
    } else if (generation.ideas.length) {
      const database = dataActions.getDb()
      generatorActions.addBatch({
        id: generation.id,
        kind: "restored",
        sourceTitle: null,
        brief: generation.brief,
        requested: generation.requested,
        drafts: generation.ideas.map((idea, index) => draftFromIdea(idea, database, `${generation.id}:${index}`)),
        provider: generation.provider,
        model: generation.model,
        createdAt: generation.createdAt,
        generationId: generation.id,
        trimmed: generation.trimmed,
      })
      setOpen((current) => ({ ...current, [generation.id]: true }))
    } else {
      void start({ origin: `recent:${generation.id}`, kind: "brief", brief: generation.brief, sourceTitle: null, writeUrl: true })
      return
    }
    scrollToResults()
  }

  function applyBrief(generation: LoggedGeneration) {
    setForm((f) => ({ key: f.key + 1, brief: generation.brief }))
    url.write(generation.brief)
    generatorActions.setLastBrief(generation.brief)
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    toast.success("Brief loaded", { description: "Adjust it if you like, then generate." })
  }

  function runExample(example: ExampleBrief) {
    setForm((f) => ({ key: f.key + 1, brief: example.brief }))
    void start({ origin: `example:${example.id}`, kind: "brief", brief: example.brief, sourceTitle: null, writeUrl: true })
  }

  function generateFromForm(brief: GeneratorBrief) {
    void start({ origin: "form", kind: "brief", brief, sourceTitle: null, writeUrl: true })
  }

  function resetBrief() {
    url.write(null)
    generatorActions.setLastBrief(null)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Idea Generator"
        description="Strategic ideas built from your Brand HQ, audience problems, pillars and winners — not generic prompts."
        actions={
          <>
            <ProviderBadge provider={status.configured ? status.provider : "offline"} model={status.configured ? status.model : undefined} />
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/ideas">
                <Lightbulb aria-hidden />
                Idea Bank
              </Link>
            </Button>
          </>
        }
      />

      {ignored.length ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <span className="min-w-0 flex-1 text-pretty">
            Part of this link ({ignored.join(", ")}) no longer matches your workspace, so the rest of the brief was applied.
          </span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={() => setIgnored([])}>
            <X aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start">
        <div ref={formRef} className="min-w-0 scroll-mt-4 lg:col-start-1 lg:row-start-1">
          <GeneratorBriefForm
            key={form.key}
            initialBrief={form.brief}
            pending={job?.origin === "form"}
            disabled={busy}
            onGenerate={generateFromForm}
            onReset={resetBrief}
            footer={
              <AiNotice>
                {status.configured
                  ? "AI output is a first draft — edit any idea until it sounds like you before saving."
                  : "Offline templates build ideas from your Problem Bank, questions, stories and pillars. Set ANTHROPIC_API_KEY on the server to use Claude."}
              </AiNotice>
            }
          />
        </div>

        <div ref={resultsRef} className="flex min-w-0 scroll-mt-4 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {ai.error ? <LabAiError message={ai.error.message} onRetry={lastJob ? () => void start(lastJob) : undefined} /> : null}
          {visible.length || job ? (
            <GeneratorResults
              batches={visible}
              job={job}
              isOpen={isOpen}
              onToggle={(batch, next) => setOpen((current) => ({ ...current, [batch.id]: next }))}
              lookups={lookups}
              db={db}
              selected={selected}
              onSelectedChange={setDraftSelected}
              onSelectBatch={selectBatch}
              onSelectAll={selectAll}
              onClearSelection={() => setSelectedKeys([])}
              onSaveSelected={saveSelected}
              onSaveOne={(batch, draft) => save([{ batch, draft }])}
              onEdit={generatorActions.updateDraft}
              onMore={more}
              onRegenerate={regenerate}
              onDismiss={dismiss}
              onClearAll={clearResults}
              aiBusy={busy}
              ideaTitles={ideaTitles}
              now={now}
            />
          ) : (
            <GeneratorEmptyState examples={examples} busy={busy} onRun={runExample} />
          )}
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <RecentGenerations
            generations={recent}
            showing={visibleIds}
            db={db}
            now={now}
            busy={busy}
            pendingOrigin={job?.origin ?? null}
            onRestore={restore}
            onUseBrief={applyBrief}
          />
        </div>
      </div>
    </PageContainer>
  )
}
