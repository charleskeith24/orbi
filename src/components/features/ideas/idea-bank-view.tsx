"use client"

import { Lightbulb, SearchX, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { uiActions, useLookup, useTable } from "@/lib/store"
import type { ContentIdea, ID, IdeaStatus } from "@/lib/types"
import { formatNumber, pluralize } from "@/lib/utils"
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
import { useIdeaBankState } from "./use-idea-bank-state"

/**
 * Idea Bank (spec §9, §10, §39): capture, triage and prioritise ideas in a table, card grid or
 * status Kanban; the detail sheet edits every field, scores the idea and converts it to content.
 * URL: `?view=`, `?sort=`, `?status=`, facet params, `?q=` (search) and `?open=<ideaId>`.
 */
export function IdeaBankView() {
  const { state, update } = useIdeaBankState()
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
    toast.success("Saved to your Inbox", {
      description: hidden ? `${idea.title} · hidden by the current status filter` : idea.title,
      action: { label: "Open", onClick: () => setOpen(idea.id) },
    })
  }

  const filteredEmpty = (
    <EmptyState
      compact
      icon={SearchX}
      title="No ideas match"
      description={
        hiddenByStatus
          ? `${pluralize(hiddenByStatus, "idea")} with another status ${hiddenByStatus === 1 ? "matches" : "match"} — widen the status filter to see ${hiddenByStatus === 1 ? "it" : "them"}.`
          : "Try a different search or fewer filters."
      }
      action={
        hiddenByStatus ? (
          <Button type="button" size="sm" variant="outline" onClick={showAllStatuses}>
            Show all statuses
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
            Reset filters
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
          description="Capture every idea the moment it appears, score it against your strategy, then turn the best into content."
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
            <span className="min-w-0 flex-1">The idea in this link no longer exists — it may have been deleted.</span>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={() => setOpen(null)}>
              <X aria-hidden />
            </Button>
          </div>
        ) : null}

        {ideas.length ? (
          <section aria-label="Ideas" className="flex min-w-0 flex-col gap-3">
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
                    ? `${pluralize(visible.length, "idea")} on the board${hiddenByStatus ? ` · ${formatNumber(hiddenByStatus)} in collapsed columns` : ""}`
                    : visible.length === ideas.length
                      ? pluralize(ideas.length, "idea")
                      : `${formatNumber(visible.length)} of ${pluralize(ideas.length, "idea")}`}
                </span>
                {view === "kanban" ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>Drag a card to change its status — drop on Converted to Content to create content.</span>
                  </>
                ) : hiddenByStatus ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="num">
                      {isActiveStatusFilter(state.status)
                        ? `${formatNumber(hiddenByStatus)} converted or archived hidden`
                        : `${formatNumber(hiddenByStatus)} hidden by the status filter`}
                    </span>
                    <Button type="button" variant="link" size="xs" className="h-auto px-0 text-xs" onClick={showAllStatuses}>
                      Show all
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
            title="Your Idea Bank is empty"
            description="Every piece of content starts here. Capture ideas as they come — then score them against your strategy and convert the best into content."
            action={
              <Button type="button" size="sm" asChild>
                <Link href="/ideas/generator">
                  <Sparkles aria-hidden />
                  Generate ideas
                </Link>
              </Button>
            }
            secondaryAction={
              <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
                <Lightbulb aria-hidden />
                Capture an idea
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
