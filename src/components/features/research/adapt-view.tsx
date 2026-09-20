"use client"

import { CheckCheck, Library, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { PageContainer, PageHeader, StatusPill } from "@/components/common"
import { replaceSearchParams } from "@/components/features/stories/use-url-state"
import { Button } from "@/components/ui/button"
import { useAiTask } from "@/lib/ai"
import { useT, useUiLang } from "@/lib/i18n"
import { dataActions, useBrand, useLookup, useTable } from "@/lib/store"
import type { AudiencePersona, ID, ResearchItem } from "@/lib/types"
import { AdaptAnalysisStep } from "./adapt-analysis-step"
import { adaptMessages } from "./adapt-messages"
import {
  buildAdaptInput,
  createContentFromOriginal,
  EMPTY_PASTE,
  markReferenceAdapted,
  pastedTitle,
  referenceInfo,
  saveAnalysisToReference,
  saveOriginalAsIdea,
  savePastedReference,
  type AdaptAnalysis,
  type AdaptTargets,
  type OriginalDraft,
  type PastedReference,
  type ReferenceInfo,
} from "./adapt-model"
import { AdaptOriginalStep } from "./adapt-original-step"
import { AdaptReferenceStep, type SourceMode } from "./adapt-reference-step"
import { NeverCopyBanner } from "./never-copy-banner"
import { analysisFields, MIN_REFERENCE_CHARS, type AnalysisFields } from "./research-model"
import type { StepState } from "./step-card"

function primaryPersonaId(personas: readonly AudiencePersona[]): ID | null {
  return personas.find((p) => p.is_primary)?.id ?? personas[0]?.id ?? null
}

function savedAnalysis(item: ResearchItem | undefined): AdaptAnalysis | null {
  const saved = item?.analysis
  return saved ? { fields: analysisFields(saved), provider: saved.provider, model: null, analyzedAt: saved.analyzed_at, unsaved: false } : null
}

/**
 * Inspiration → Original (spec §37): 1 a reference (pasted, or `?from=<researchId>`) → 2 its analysis →
 * 3 an ORIGINAL version for the creator's pillar, persona, platform and story. The reference text is
 * only ever used for analysis — it is never shown as the creator's draft.
 */
export function AdaptView() {
  const t = useT(adaptMessages)
  const lang = useUiLang()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get("from") || null
  const brand = useBrand()
  const research = useTable("research_items")
  const personas = useTable("audience_personas")
  const stories = useLookup("stories")
  const formats = useLookup("content_formats")
  const analyzeTask = useAiTask("analyze_reference")
  const adaptTask = useAiTask("adapt_reference")
  const defaultPlatform = brand.main_platforms[0] ?? "facebook"

  const targetsFor = (item: ResearchItem | undefined): AdaptTargets => ({
    pillarId: item?.pillar_id ?? null,
    personaId: primaryPersonaId(personas),
    platform: item?.platform ?? defaultPlatform,
    formatId: null,
    storyId: null,
    topic: "",
  })

  const [initialItem] = useState(() => (from ? research.find((r) => r.id === from) : undefined))
  const [seenFrom, setSeenFrom] = useState(from)
  const [mode, setMode] = useState<SourceMode>(initialItem ? "library" : "paste")
  const [libraryId, setLibraryId] = useState<ID | null>(initialItem?.id ?? null)
  const [pasted, setPasted] = useState<PastedReference>(EMPTY_PASTE)
  const [analysis, setAnalysis] = useState<AdaptAnalysis | null>(() => savedAnalysis(initialItem))
  const [targets, setTargets] = useState<AdaptTargets>(() => targetsFor(initialItem))
  const [original, setOriginal] = useState<OriginalDraft | null>(null)
  const [savedIdeaId, setSavedIdeaId] = useState<ID | null>(null)
  const [itemId, setItemId] = useState<ID | null>(null)

  /** A different reference starts the flow over (targets follow the reference). */
  function load(item: ResearchItem | undefined) {
    setMode(item ? "library" : "paste")
    setLibraryId(item?.id ?? null)
    setAnalysis(savedAnalysis(item))
    setTargets(targetsFor(item))
    setOriginal(null)
    setSavedIdeaId(null)
    setItemId(null)
  }

  // A navigation to another `?from=` (e.g. "Adapt into original" on another reference) reloads the flow.
  if (from !== seenFrom) {
    setSeenFrom(from)
    load(from ? research.find((r) => r.id === from) : undefined)
  }

  const libraryItem = mode === "library" && libraryId ? research.find((r) => r.id === libraryId) : undefined
  const missingFrom = Boolean(from) && !research.some((r) => r.id === from)
  const ref: ReferenceInfo = libraryItem
    ? referenceInfo(libraryItem)
    : { id: null, title: pastedTitle(pasted, lang), creator: pasted.creator, platform: pasted.platform, type: pasted.type, source: "", topic: "", why_attention: "" }
  const analyzableText = mode === "library" ? (libraryItem?.content ?? "") : pasted.content
  const canAnalyze = analyzableText.trim().length >= MIN_REFERENCE_CHARS
  const referenceReady = mode === "library" ? Boolean(libraryItem) : canAnalyze
  const story = targets.storyId ? stories.get(targets.storyId) : undefined
  const formatName = targets.formatId ? (formats.get(targets.formatId)?.name ?? "") : ""

  const step1: StepState = referenceReady ? "done" : "current"
  const step2: StepState = !referenceReady ? "locked" : analysis ? "done" : "current"
  const step3: StepState = !referenceReady || !analysis ? "locked" : original ? "done" : "current"
  const analyzeHint = canAnalyze
    ? ""
    : mode === "library"
      ? t("hint_library")
      : t("hint_paste", { min: MIN_REFERENCE_CHARS })

  function resetResults() {
    setOriginal(null)
    setSavedIdeaId(null)
    setItemId(null)
    analyzeTask.reset()
    adaptTask.reset()
  }

  function switchMode(next: SourceMode) {
    if (next === mode) return
    setMode(next)
    const keep = next === "library" && libraryId ? research.find((r) => r.id === libraryId) : undefined
    setAnalysis(savedAnalysis(keep))
    resetResults()
    const nextFrom = next === "library" ? libraryId : null
    setSeenFrom(nextFrom)
    replaceSearchParams((params) => {
      if (nextFrom) params.set("from", nextFrom)
      else params.delete("from")
    })
  }

  function selectItem(id: ID | null) {
    const item = id ? research.find((r) => r.id === id) : undefined
    load(item)
    setMode("library")
    analyzeTask.reset()
    adaptTask.reset()
    setSeenFrom(id)
    replaceSearchParams((params) => {
      if (id) params.set("from", id)
      else params.delete("from")
    })
  }

  async function analyze() {
    if (!canAnalyze) return
    const result = await analyzeTask.run(
      {
        content: analyzableText.trim().slice(0, 15000),
        platform: ref.platform,
        creator: ref.creator.trim().slice(0, 120) || null,
        title: libraryItem || pasted.title.trim() ? ref.title.slice(0, 300) : null,
      },
      libraryItem ? { entityType: "research_items", entityId: libraryItem.id } : {}
    )
    if (!result) return
    setAnalysis({ fields: analysisFields(result.output), provider: result.provider, model: result.model, analyzedAt: new Date().toISOString(), unsaved: true })
  }

  function editAnalysis(fields: AnalysisFields) {
    setAnalysis((current) => (current ? { ...current, fields, unsaved: true } : current))
  }

  function saveAnalysis() {
    if (!libraryItem || !analysis) return
    saveAnalysisToReference(libraryItem, analysis)
    setAnalysis({ ...analysis, unsaved: false })
    toast.success(t("analysis_saved"), { description: libraryItem.title })
  }

  async function adapt() {
    if (!analysis) return
    const result = await adaptTask.run(
      buildAdaptInput(analysis.fields, ref, targets, story, formatName),
      libraryItem ? { entityType: "research_items", entityId: libraryItem.id } : {}
    )
    if (!result) return
    setOriginal({ ...result.output, provider: result.provider, model: result.model, edited: false })
    setSavedIdeaId(null)
    setItemId(null)
  }

  /** Library references become "adapted" once an original is saved or turned into content. */
  function markAdapted(): boolean {
    if (!libraryItem) return false
    const changed = libraryItem.status !== "adapted"
    if (changed || analysis?.unsaved) markReferenceAdapted(libraryItem, analysis)
    if (analysis) setAnalysis({ ...analysis, unsaved: false })
    return changed
  }

  function saveIdea() {
    if (!original || !analysis) return
    const idea = saveOriginalAsIdea(original, ref, targets, analysis.fields, lang)
    setSavedIdeaId(idea.id)
    const adapted = markAdapted()
    toast.success(t("saved_idea"), {
      description: adapted ? t("saved_idea_adapted", { title: idea.title }) : idea.title,
      action: { label: t("open"), onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
  }

  function createContent() {
    if (!original || !analysis) return
    try {
      const { idea, item } = createContentFromOriginal(original, ref, targets, analysis.fields, savedIdeaId, lang)
      setSavedIdeaId(idea.id)
      setItemId(item.id)
      markAdapted()
      toast.success(t("content_created"), { description: t("opening_studio", { title: item.title }) })
      router.push(`/studio/${item.id}`)
    } catch (error) {
      toast.error(t("content_failed"), { description: error instanceof Error ? error.message : String(error) })
    }
  }

  function saveReference() {
    if (libraryItem) {
      markAdapted()
      toast.success(t("marked_adapted"), { description: libraryItem.title })
      return
    }
    const row = savePastedReference(pasted, analysis, Boolean(original), targets.pillarId, lang)
    // An idea already saved from this original now points at the saved reference.
    const idea = savedIdeaId ? dataActions.getDb().content_ideas.find((i) => i.id === savedIdeaId) : undefined
    if (idea && !idea.source_ref_id) dataActions.update("content_ideas", idea.id, { source_ref_id: row.id })
    setMode("library")
    setLibraryId(row.id)
    setSeenFrom(row.id)
    if (analysis) setAnalysis({ ...analysis, unsaved: false })
    replaceSearchParams((params) => params.set("from", row.id))
    toast.success(t("saved_to_library"), {
      description: row.title,
      action: { label: t("open"), onClick: () => router.push(`/research?open=${row.id}`) },
    })
  }

  const referenceAction = libraryItem ? (
    libraryItem.status === "adapted" && !analysis?.unsaved ? (
      <StatusPill tone="good" icon={CheckCheck}>
        {t("reference_adapted")}
      </StatusPill>
    ) : (
      <Button type="button" size="sm" variant="ghost" onClick={saveReference}>
        <CheckCheck aria-hidden />
        {t("mark_adapted")}
      </Button>
    )
  ) : (
    <Button type="button" size="sm" variant="ghost" onClick={saveReference}>
      <Library aria-hidden />
      {t("save_to_library")}
    </Button>
  )

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Inspiration → Original" info={t("info")} description={<NeverCopyBanner />} />

      {missingFrom && mode === "paste" ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <span className="min-w-0 flex-1">{t("missing_link")}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("dismiss")}
            onClick={() => {
              setSeenFrom(null)
              replaceSearchParams((params) => params.delete("from"))
            }}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : null}

      <AdaptReferenceStep
        state={step1}
        mode={mode}
        onModeChange={switchMode}
        pasted={pasted}
        onPastedChange={(patch) => setPasted((current) => ({ ...current, ...patch }))}
        items={research}
        libraryItem={libraryItem}
        onSelect={selectItem}
      />
      <AdaptAnalysisStep
        state={step2}
        analysis={analysis}
        pending={analyzeTask.isPending}
        error={analyzeTask.error?.message ?? null}
        canAnalyze={canAnalyze}
        hint={analyzeHint}
        onAnalyze={() => void analyze()}
        onChange={editAnalysis}
        onSaveToReference={libraryItem ? saveAnalysis : undefined}
      />
      <AdaptOriginalStep
        state={step3}
        targets={targets}
        onTargetsChange={(patch) => setTargets((current) => ({ ...current, ...patch }))}
        canGenerate={Boolean(analysis) && !analyzeTask.isPending}
        pending={adaptTask.isPending}
        error={adaptTask.error?.message ?? null}
        onGenerate={() => void adapt()}
        original={original}
        onOriginalChange={(patch) => setOriginal((current) => (current ? { ...current, ...patch, edited: true } : current))}
        savedIdeaId={savedIdeaId}
        itemId={itemId}
        onSaveIdea={saveIdea}
        onCreateContent={createContent}
        referenceAction={referenceAction}
      />
    </PageContainer>
  )
}
