"use client"

import { Lightbulb, SearchX, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { useT } from "@/lib/i18n"
import { uiActions, useLookup, useTable } from "@/lib/store"
import type { ContentIdea, ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { IdeaActionsProvider } from "./idea-actions"
import { IdeaBulkBar } from "./idea-bulk-bar"
import { IdeaCardsView } from "./idea-cards-view"
import { IdeaDetailSheet } from "./idea-detail-sheet"
import { IdeaFilterBar, IdeaViewControls } from "./idea-filter-bar"
import { IdeaStatusTabs } from "./idea-header"
import { IdeaKanban } from "./idea-kanban"
import {
  ACTIVE_STATUSES,
  ALL_STATUSES,
  buildTagIndex,
  countByStatus,
  EMPTY_FACETS,
  FACET_KEYS,
  filterIdeas,
  sanitizeFacets,
  sortIdeas,
  type IdeaView,
} from "./idea-model"
import { IdeaTable, type IdeaLookups } from "./idea-table"
import { ideaBankMessages } from "./messages"
import { useIdeaBankState } from "./use-idea-bank-state"

/**
 * Idea Bank (spec §9, §10, §39; Calm UI): triage and prioritise ideas in a table, card grid or status Kanban;
 * the detail sheet edits every field, scores the idea and converts it to content. Capturing lives in the top
 * bar's New menu (⌥N). The status row doubles as the count line.
 * URL: `?view=`, `?sort=`, `?status=`, facet params, `?q=` (search) and `?open=<ideaId>`.
 */
export function IdeaBankView() {
  const { state, update } = useIdeaBankState()
  const t = useT(ideaBankMessages)
  const isMobile = useIsMobile()
  const view: IdeaView = state.view ?? (isMobile ? "cards" : "table")

  const ideas = useTable("content_ideas")
  const tags = useTable("tags")
  const tagLinks = useTable("content_tags")
  const pillars = useLookup("content_pillars")
  const personas = useLookup("audience_personas")
  const formats = useLookup("content_formats")
  const goals = useLookup("content_goals")
  const [now] = useState(() => new Date())
  const [selectedIds, setSelectedIds] = useState<ID[]>([])

  const lookups = useMemo<IdeaLookups>(() => ({ pillars, personas, formats, goals }), [pillars, personas, formats, goals])
  const ideaById = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas])
  const tagIndex = useMemo(() => buildTagIndex(tags, tagLinks), [tags, tagLinks])
  const facets = useMemo(
    () =>
      sanitizeFacets(state.facets, {
        pillar: new Set(pillars.keys()),
        persona: new Set(personas.keys()),
        format: new Set(formats.keys()),
        goal: new Set(goals.keys()),
      }),
    [state.facets, pillars, personas, formats, goals]
  )
  const criteria = useMemo(() => ({ q: state.q, status: state.status, facets }), [state.q, state.status, facets])

  /** Everything matching search + facets, before the status filter (the Kanban counts hidden columns). */
  const matching = useMemo(() => filterIdeas(ideas, criteria, { tagIndex, ignore: "status" }), [ideas, criteria, tagIndex])
  const visible = useMemo(() => {
    const statuses = new Set(criteria.status)
    return sortIdeas(
      matching.filter((i) => statuses.has(i.status)),
      state.sort
    )
  }, [matching, criteria.status, state.sort])
  const hiddenByStatus = matching.length - visible.length
  const statusCounts = useMemo(() => countByStatus(matching), [matching])
  const narrowed = Boolean(state.q.trim()) || FACET_KEYS.some((key) => facets[key].length > 0)
  const selected = useMemo(
    () => selectedIds.map((id) => ideaById.get(id)).filter((i): i is ContentIdea => Boolean(i)),
    [selectedIds, ideaById]
  )

  // `?open=<id>` drives the sheet; keep the last idea mounted while the sheet animates out.
  const openIdea = state.open ? ideaById.get(state.open) : undefined
  const [shownId, setShownId] = useState<ID | null>(openIdea ? openIdea.id : null)
  if (openIdea && openIdea.id !== shownId) setShownId(openIdea.id)
  const shownIdea = shownId ? (ideaById.get(shownId) ?? null) : null

  const setOpen = useCallback((id: ID | null) => update({ open: id }), [update])
  const showAllStatuses = () => update({ status: ALL_STATUSES })
  const resetFilters = () => update({ q: "", status: ACTIVE_STATUSES, facets: EMPTY_FACETS })

  const filteredEmpty = (
    <EmptyState
      compact
      icon={SearchX}
      title={t("nomatch_title")}
      description={
        hiddenByStatus
          ? t.plural("nomatch_hidden", hiddenByStatus, { count: formatNumber(hiddenByStatus) })
          : t("nomatch_description")
      }
      action={
        hiddenByStatus ? (
          <Button type="button" size="sm" variant="outline" onClick={showAllStatuses}>
            {t("show_all_statuses")}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
            {t("reset_filters")}
          </Button>
        )
      }
    />
  )

  let content: React.ReactNode
  if (view === "table") {
    content = (
      <IdeaTable
        ideas={visible}
        sort={state.sort}
        lookups={lookups}
        now={now}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpen={setOpen}
        empty={filteredEmpty}
      />
    )
  } else if (view === "cards") {
    content = (
      <IdeaCardsView ideas={visible} lookups={lookups} now={now} onOpen={setOpen} empty={filteredEmpty} showStatus={state.status.length !== 1} />
    )
  } else {
    content = matching.length ? (
      <IdeaKanban
        ideas={matching}
        visibleStatuses={state.status}
        sort={state.sort}
        lookups={lookups}
        now={now}
        onOpen={setOpen}
        onVisibleStatusesChange={(status) => update({ status })}
      />
    ) : (
      <div className="rounded-lg border bg-card">{filteredEmpty}</div>
    )
  }

  return (
    <IdeaActionsProvider openId={state.open} onOpen={setOpen}>
      <PageContainer>
        <PageHeader title="Idea Bank" info={t("info")} />

        {state.open && !openIdea ? (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1">{t("missing_link")}</span>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("dismiss")} onClick={() => setOpen(null)}>
              <X aria-hidden />
            </Button>
          </div>
        ) : null}

        {ideas.length ? (
          <section aria-label={t("ideas")} className="-mt-2 flex min-w-0 flex-col gap-3">
            <IdeaFilterBar
              ideas={ideas}
              tagIndex={tagIndex}
              lookups={lookups}
              criteria={criteria}
              sort={state.sort}
              view={view}
              onChange={update}
            />

            {view === "table" && selected.length ? (
              <IdeaBulkBar selected={selected} onClear={() => setSelectedIds([])} />
            ) : (
              <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <IdeaStatusTabs
                  counts={statusCounts}
                  value={state.status}
                  onChange={(status) => update({ status })}
                  className="min-w-0 flex-1 basis-40 sm:basis-80"
                />
                <div className="ml-auto flex shrink-0 items-center gap-3">
                  {narrowed ? (
                    <span className="text-xs text-muted-foreground num" aria-live="polite">
                      {t("shown_of", { shown: formatNumber(visible.length), total: formatNumber(ideas.length) })}
                    </span>
                  ) : null}
                  <IdeaViewControls sort={state.sort} view={view} onChange={update} />
                </div>
              </div>
            )}

            {content}
          </section>
        ) : (
          <EmptyState
            icon={Lightbulb}
            title={t("empty_title")}
            description={t("empty_description")}
            action={
              <Button type="button" size="sm" asChild>
                <Link href="/ideas/generator">
                  <Sparkles aria-hidden />
                  {t("generate_ideas")}
                </Link>
              </Button>
            }
            secondaryAction={
              <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
                <Lightbulb aria-hidden />
                {t("capture_idea")}
              </Button>
            }
          />
        )}
      </PageContainer>

      <IdeaDetailSheet
        idea={shownIdea}
        open={Boolean(openIdea)}
        now={now}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
      />
    </IdeaActionsProvider>
  )
}
