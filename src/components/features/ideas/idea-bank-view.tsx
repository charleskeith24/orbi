"use client"

import { Lightbulb, SearchX, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { uiActions, useLookup, useTable } from "@/lib/store"
import type { ContentIdea, ID, IdeaStatus } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { IdeaActionsProvider } from "./idea-actions"
import { IdeaBulkBar } from "./idea-bulk-bar"
import { IdeaCardsView } from "./idea-cards-view"
import { IdeaDetailSheet } from "./idea-detail-sheet"
import { IdeaFilterBar } from "./idea-filter-bar"
import { IdeaQuickCapture, IdeaStatusStrip } from "./idea-header"
import { IdeaKanban } from "./idea-kanban"
import {
  ACTIVE_STATUSES,
  ALL_STATUSES,
  buildTagIndex,
  countByStatus,
  EMPTY_FACETS,
  filterIdeas,
  isActiveStatusFilter,
  sanitizeFacets,
  sortIdeas,
  type IdeaView,
} from "./idea-model"
import { IdeaTable, type IdeaLookups } from "./idea-table"
import { ideaBankMessages } from "./messages"
import { useIdeaBankState } from "./use-idea-bank-state"

/**
 * Idea Bank (spec §9, §10, §39): capture, triage and prioritise ideas in a table, card grid or
 * status Kanban; the detail sheet edits every field, scores the idea and converts it to content.
 * URL: `?view=`, `?sort=`, `?status=`, facet params, `?q=` (search) and `?open=<ideaId>`.
 */
export function IdeaBankView() {
  const { state, update } = useIdeaBankState()
  const t = useT(ideaBankMessages)
  const c = useT(commonMessages)
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
  const statusTotals = useMemo(() => countByStatus(ideas), [ideas])
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

  function selectStatus(status: IdeaStatus) {
    const only = state.status.length === 1 && state.status[0] === status
    update({ status: only ? ACTIVE_STATUSES : [status] })
  }

  function onCaptured(idea: ContentIdea) {
    const hidden = !state.status.includes("inbox")
    toast.success(t("captured"), {
      description: hidden ? t("captured_hidden", { title: idea.title }) : idea.title,
      action: { label: c("open"), onClick: () => setOpen(idea.id) },
    })
  }

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
    content = <IdeaCardsView ideas={visible} lookups={lookups} now={now} onOpen={setOpen} empty={filteredEmpty} />
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
        <PageHeader
          title="Idea Bank"
          description={t("description")}
          actions={
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/ideas/generator">
                <Sparkles className="text-brand" aria-hidden />
                Idea Generator
              </Link>
            </Button>
          }
        >
          <div className="flex min-w-0 flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <IdeaQuickCapture onCreated={onCaptured} className="w-full max-w-2xl 2xl:flex-1" />
            <IdeaStatusStrip counts={statusTotals} value={state.status} onSelect={selectStatus} />
          </div>
        </PageHeader>

        {state.open && !openIdea ? (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1">{t("missing_link")}</span>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("dismiss")} onClick={() => setOpen(null)}>
              <X aria-hidden />
            </Button>
          </div>
        ) : null}

        {ideas.length ? (
          <section aria-label={t("ideas")} className="flex min-w-0 flex-col gap-3">
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
              <p className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
                <span className="num">
                  {view === "kanban"
                    ? `${t.plural("board_count", visible.length, { count: formatNumber(visible.length) })}${hiddenByStatus ? ` · ${t("board_collapsed", { count: formatNumber(hiddenByStatus) })}` : ""}`
                    : visible.length === ideas.length
                      ? t.plural("count", ideas.length, { count: formatNumber(ideas.length) })
                      : t.plural("count_of", ideas.length, { shown: formatNumber(visible.length), count: formatNumber(ideas.length) })}
                </span>
                {view === "kanban" ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{t("kanban_hint")}</span>
                  </>
                ) : hiddenByStatus ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="num">
                      {isActiveStatusFilter(state.status)
                        ? t("hidden_inactive", { count: formatNumber(hiddenByStatus) })
                        : t("hidden_by_status", { count: formatNumber(hiddenByStatus) })}
                    </span>
                    <Button type="button" variant="link" size="xs" className="h-auto px-0 text-xs" onClick={showAllStatuses}>
                      {t("show_all")}
                    </Button>
                  </>
                ) : null}
              </p>
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
