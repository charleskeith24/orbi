"use client"

import { Plus, SearchX } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, EmptyState, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { buildRepurposeInput, useAiTask } from "@/lib/ai"
import { computeTiers, isPublishedItem, isWinnerTier, latestMetricsByItem } from "@/lib/analytics"
import { useT, useUiLang } from "@/lib/i18n"
import { REPURPOSE_TYPE_IDS, REPURPOSE_TYPES } from "@/lib/constants"
import { createRepurposedItem, dataActions, useBrand, useDataStore, useDb, useSettings } from "@/lib/store"
import type { ContentItem, ContentRepurpose, ID, RepurposeType } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { repurposeMessages } from "./messages"
import { DraftSkeleton, draftIssues, RepurposeDraftCard, type RepurposeDraft } from "./repurpose-draft-card"
import { RepurposeErrorNotice } from "./repurpose-error"
import {
  draftToSections,
  recommendedTypes,
  repurposeTileStates,
  reusableSuggestionRow,
  sectionsText,
  sourceTextFor,
  targetPlatform,
} from "./repurpose-model"
import { RepurposeSource } from "./repurpose-source"
import { RepurposeTiles } from "./repurpose-tiles"
import type { TreePerf } from "./tree-model"

// Props are a contract used by the Content Studio and the Winning Content Library — do not change them.
export interface RepurposePanelProps {
  itemId: ID
  /** Called with the ids of content items created from this panel. */
  onCreated?: (itemIds: ID[]) => void
}

/** Replace drafts of the same type in place, append new types. */
function mergeDrafts(current: RepurposeDraft[], incoming: RepurposeDraft[]): RepurposeDraft[] {
  const byType = new Map(incoming.map((d) => [d.type, d]))
  const next = current.map((d) => byType.get(d.type) ?? d)
  for (const d of incoming) if (!current.some((c) => c.type === d.type)) next.push(d)
  return next
}

const labelOf = (type: RepurposeType) => REPURPOSE_TYPES[type].label

/** Repurposing Engine (spec §23): turn one piece into platform-native assets. */
export function RepurposePanel({ itemId, onCreated }: RepurposePanelProps) {
  const t = useT(repurposeMessages)
  const item = useDb().content_items.find((i) => i.id === itemId)
  if (!item) {
    return (
      <EmptyState
        icon={SearchX}
        title={t("not_found_title")}
        description={t("not_found_description")}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/studio">{t("open_studio")}</Link>
          </Button>
        }
      />
    )
  }
  return <RepurposeWorkbench key={item.id} item={item} onCreated={onCreated} />
}

function RepurposeWorkbench({ item, onCreated }: { item: ContentItem; onCreated?: (itemIds: ID[]) => void }) {
  const t = useT(repurposeMessages)
  const lang = useUiLang()
  const db = useDb()
  const settings = useSettings()
  const brand = useBrand()
  const router = useRouter()
  const headingId = useId()
  const [now] = useState(() => new Date())
  const ai = useAiTask("repurpose")
  const [confirm, confirmDialog] = useConfirm()
  const draftsRef = useRef<HTMLElement>(null)
  const lastTargets = useRef<RepurposeType[]>([])

  const { content_items, content_repurposing, content_scripts, content_briefs, content_ideas, content_platforms } = db
  const states = useMemo(
    () => repurposeTileStates({ content_items, content_repurposing }, item),
    [content_items, content_repurposing, item]
  )
  const source = useMemo(
    () => sourceTextFor({ content_scripts, content_briefs, content_ideas }, item),
    [content_scripts, content_briefs, content_ideas, item]
  )
  const perf = useMemo<TreePerf>(() => {
    const published = isPublishedItem(item)
    const info = published ? computeTiers(db, settings, now).get(item.id) : undefined
    return { published, tier: info?.tier ?? null, ratio: info?.ratio ?? null, views: latestMetricsByItem(db).get(item.id)?.views ?? null }
  }, [db, settings, now, item])
  const parent = item.parent_id ? (content_items.find((i) => i.id === item.parent_id) ?? null) : null

  const activePlatforms = useMemo(() => {
    const active = content_platforms.filter((p) => p.is_active).map((p) => p.platform)
    return active.length ? active : brand.main_platforms
  }, [content_platforms, brand.main_platforms])
  const recommended = useMemo(
    () => recommendedTypes(states, { activePlatforms, winner: perf.tier !== null && isWinnerTier(perf.tier) }),
    [states, activePlatforms, perf.tier]
  )
  const recommendedSet = useMemo(() => new Set(recommended), [recommended])

  const [selected, setSelected] = useState<Set<RepurposeType>>(() => new Set(recommended))
  const [drafts, setDrafts] = useState<RepurposeDraft[]>([])
  const [inFlight, setInFlight] = useState<RepurposeType[]>([])
  const inFlightSet = useMemo(() => new Set(inFlight), [inFlight])

  const openDrafts = drafts.filter((d) => !d.createdItemId)
  const readyDrafts = openDrafts.filter((d) => {
    const issues = draftIssues(d, lang)
    return !issues.title && !issues.body
  })
  const pendingNew = inFlight.filter((t) => !drafts.some((d) => d.type === t))
  const createdTypes = REPURPOSE_TYPE_IDS.filter((t) => states[t].created.length).length
  const suggestedTypes = REPURPOSE_TYPE_IDS.filter((t) => states[t].suggestion).length

  const revealDrafts = () => requestAnimationFrame(() => draftsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }))

  function toggle(type: RepurposeType) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  /** Types that were just created or saved leave the selection, so a regenerate can't duplicate them. */
  function deselect(types: RepurposeType[]) {
    setSelected((current) => {
      if (!types.some((t) => current.has(t))) return current
      const next = new Set(current)
      for (const t of types) next.delete(t)
      return next
    })
  }

  async function generate(targets: RepurposeType[]) {
    if (!targets.length) return
    const input = buildRepurposeInput(db, item.id, targets, now)
    if (!input) return
    const body = input.source.body?.trim() ? input.source.body : source.text
    lastTargets.current = targets
    setInFlight(targets)
    const result = await ai.run(
      { ...input, source: { ...input.source, title: input.source.title.trim() || "Untitled content", body: body.slice(0, 12000) } },
      { entityType: "content_items", entityId: item.id }
    )
    setInFlight([])
    if (!result) return
    const incoming = result.output.assets.map<RepurposeDraft>((asset) => ({
      type: asset.type,
      title: asset.title.trim() || `${item.title} — ${labelOf(asset.type)}`,
      platform: asset.platform ?? targetPlatform(asset.type, item),
      sections: asset.sections,
      origin: { kind: "ai", provider: result.provider, model: result.model },
      createdItemId: null,
      edited: false,
    }))
    setDrafts((current) => mergeDrafts(current, incoming))
    revealDrafts()
  }

  async function onGenerate() {
    const targets = REPURPOSE_TYPE_IDS.filter((t) => selected.has(t))
    const edited = openDrafts.filter((d) => d.edited && targets.includes(d.type))
    if (
      edited.length &&
      !(await confirm({
        title: edited.length > 1 ? t("replace_edited_multiple") : t("replace_edited_single"),
        description: t("regenerate_description", { types: edited.map((d) => labelOf(d.type)).join(", ") }),
        confirmLabel: t("regenerate"),
        destructive: false,
      }))
    ) {
      return
    }
    await generate(targets)
  }

  function updateDraft(type: RepurposeType, patch: Partial<RepurposeDraft>) {
    setDrafts((list) => list.map((d) => (d.type === type ? { ...d, ...patch, edited: true } : d)))
  }

  /** Create the item (+ script + content_repurposing row); returns its id or null. */
  function createFrom(draft: RepurposeDraft): ID | null {
    const issues = draftIssues(draft, lang)
    if (issues.title || issues.body) return null
    try {
      const sections = draft.sections.map((s) => ({ ...s, content: s.content.trim() }))
      const created = createRepurposedItem(item.id, draft.type, {
        title: draft.title.trim(),
        sections,
        platform: draft.platform,
        generated_by: draft.origin.kind === "ai" ? draft.origin.provider : "manual",
      })
      if (draft.origin.kind === "suggestion") {
        const rowId = draft.origin.rowId
        const row = useDataStore.getState().db.content_repurposing.find((r) => r.id === rowId)
        // The domain op links the first open row of this type; make sure the reviewed one is closed too.
        if (row && !row.target_item_id) {
          dataActions.update("content_repurposing", row.id, { status: "created", target_item_id: created.id, platform: created.platform, draft: sectionsText(sections) })
        }
      }
      return created.id
    } catch (error) {
      toast.error(t("create_failed"), { description: error instanceof Error ? error.message : String(error) })
      return null
    }
  }

  function markCreated(created: { type: RepurposeType; id: ID }[]) {
    setDrafts((list) =>
      list.map((d) => {
        const hit = created.find((c) => c.type === d.type)
        return hit ? { ...d, createdItemId: hit.id } : d
      })
    )
    deselect(created.map((c) => c.type))
  }

  function onCreate(draft: RepurposeDraft) {
    const id = createFrom(draft)
    if (!id) return
    markCreated([{ type: draft.type, id }])
    toast.success(t("item_created"), {
      description: t("item_created_description", { title: draft.title.trim() }),
      action: { label: t("open"), onClick: () => router.push(`/studio/${id}`) },
    })
    onCreated?.([id])
  }

  function onCreateAll() {
    const created: { type: RepurposeType; id: ID }[] = []
    for (const draft of readyDrafts) {
      const id = createFrom(draft)
      if (id) created.push({ type: draft.type, id })
    }
    if (!created.length) return
    markCreated(created)
    const skipped = openDrafts.length - created.length
    toast.success(t.plural("items_created", created.length, { count: formatNumber(created.length) }), {
      description: skipped ? t.plural("drafts_skipped", skipped, { count: formatNumber(skipped) }) : t("each_starts"),
    })
    onCreated?.(created.map((c) => c.id))
  }

  function onSaveSuggestion(draft: RepurposeDraft) {
    if (draftIssues(draft, lang).title) return
    const fresh = useDataStore.getState().db
    const rowId = draft.origin.kind === "suggestion" ? draft.origin.rowId : null
    const existing =
      (rowId ? fresh.content_repurposing.find((r) => r.id === rowId && !r.target_item_id) : undefined) ??
      reusableSuggestionRow(fresh, item.id, draft.type)
    const values = { status: "suggested" as const, title: draft.title.trim(), draft: sectionsText(draft.sections), platform: draft.platform }
    if (existing) dataActions.update("content_repurposing", existing.id, values)
    else dataActions.insert("content_repurposing", { source_item_id: item.id, target_item_id: null, type: draft.type, ...values })
    setDrafts((list) => list.filter((d) => d.type !== draft.type))
    deselect([draft.type])
    toast.success(t("saved_suggestion"), {
      description: t("saved_suggestion_description", { type: labelOf(draft.type) }),
    })
  }

  function onDiscard(draft: RepurposeDraft) {
    const index = drafts.findIndex((d) => d.type === draft.type)
    setDrafts((list) => list.filter((d) => d.type !== draft.type))
    if (draft.createdItemId) return
    toast(t("draft_discarded"), {
      description: labelOf(draft.type),
      action: {
        label: t("undo"),
        onClick: () =>
          setDrafts((list) => (list.some((d) => d.type === draft.type) ? list : [...list.slice(0, index), draft, ...list.slice(index)])),
      },
    })
  }

  async function onReview(row: ContentRepurpose) {
    const existing = openDrafts.find((d) => d.type === row.type)
    if (
      existing?.edited &&
      !(await confirm({
        title: t("replace_edited_single"),
        description: t("review_replace_description", { type: labelOf(row.type) }),
        confirmLabel: t("replace"),
        destructive: false,
      }))
    ) {
      return
    }
    const spec = REPURPOSE_TYPES[row.type]
    const draft: RepurposeDraft = {
      type: row.type,
      title: row.title.trim() || `${item.title} — ${spec.label}`,
      platform: row.platform ?? targetPlatform(row.type, item),
      sections: draftToSections(row.draft, spec.scriptFormat),
      origin: { kind: "suggestion", rowId: row.id },
      createdItemId: null,
      edited: false,
    }
    setDrafts((list) => mergeDrafts(list, [draft]))
    revealDrafts()
  }

  function onDismiss(row: ContentRepurpose) {
    const previous = row.status
    dataActions.update("content_repurposing", row.id, { status: "dismissed" })
    toast.success(t("suggestion_dismissed"), {
      description: row.title || labelOf(row.type),
      action: { label: t("undo"), onClick: () => dataActions.update("content_repurposing", row.id, { status: previous }) },
    })
  }

  const sameSelection = recommended.length === selected.size && recommended.every((t) => selected.has(t))

  return (
    <div className="@container flex min-w-0 flex-col gap-5">
      <RepurposeSource item={item} source={source} perf={perf} parent={parent} />

      <section aria-labelledby={`${headingId}-formats`} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-64">
            <h3 id={`${headingId}-formats`} className="text-sm leading-6 font-medium">
              {t("repurpose_into")}
            </h3>
            <p className="text-xs text-pretty text-muted-foreground">
              {t("repurpose_intro")}
              {createdTypes || suggestedTypes
                ? ` ${[
                    createdTypes ? t("created_count", { count: createdTypes }) : "",
                    suggestedTypes ? t("suggested_count", { count: suggestedTypes }) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}.`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set(recommended))} disabled={!recommended.length || sameSelection || ai.isPending}>
              {t("select_recommended")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={!selected.size || ai.isPending}>
              {t("clear")}
            </Button>
            <AiButton type="button" variant="default" size="sm" pending={ai.isPending} disabled={!selected.size} onClick={() => void onGenerate()}>
              {t("generate_selected")}
              {selected.size ? ` (${selected.size})` : ""}
            </AiButton>
          </div>
        </div>
        <RepurposeTiles
          states={states}
          selected={selected}
          recommended={recommendedSet}
          generating={inFlightSet}
          disabled={ai.isPending}
          onToggle={toggle}
          onReview={(row) => void onReview(row)}
          onDismiss={onDismiss}
        />
        {!selected.size ? <p className="text-xs text-muted-foreground">{t("pick_format")}</p> : null}
        <RepurposeErrorNotice error={ai.error} pending={ai.isPending} onRetry={() => void generate(lastTargets.current)} />
      </section>

      {drafts.length || pendingNew.length ? (
        <section ref={draftsRef} aria-labelledby={`${headingId}-drafts`} className="flex min-w-0 scroll-mt-4 flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1 basis-64">
              <h3 id={`${headingId}-drafts`} className="flex items-center gap-1.5 text-sm leading-6 font-medium">
                {t("drafts")}
                <span className="font-normal text-muted-foreground num">{openDrafts.length + pendingNew.length}</span>
              </h3>
              <p className="text-xs text-pretty text-muted-foreground">
                {t("drafts_intro")}
              </p>
            </div>
            {openDrafts.length > 1 ? (
              <Button type="button" variant="outline" size="sm" onClick={onCreateAll} disabled={!readyDrafts.length || ai.isPending}>
                <Plus aria-hidden />
                {t("create_all", { count: readyDrafts.length })}
              </Button>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            {drafts.map((draft) => (
              <RepurposeDraftCard
                key={draft.type}
                draft={draft}
                regenerating={inFlightSet.has(draft.type)}
                onChange={(patch) => updateDraft(draft.type, patch)}
                onCreate={() => onCreate(draft)}
                onSaveSuggestion={() => onSaveSuggestion(draft)}
                onDiscard={() => onDiscard(draft)}
              />
            ))}
            {pendingNew.map((type) => (
              <DraftSkeleton key={type} type={type} />
            ))}
          </div>
          <AiNotice />
        </section>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {ai.isPending ? t.plural("generating", inFlight.length, { count: formatNumber(inFlight.length) }) : ""}
      </p>
      {confirmDialog}
    </div>
  )
}
