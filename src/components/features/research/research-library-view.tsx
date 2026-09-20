"use client"

import { Library, Plus, SearchX, WandSparkles, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { buildUsageIndex } from "@/components/features/stories/story-model"
import { useUrlState } from "@/components/features/stories/use-url-state"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { RESEARCH_STATUSES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { useLookup, useTable } from "@/lib/store"
import type { ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { researchMessages } from "./messages"
import { NeverCopyBanner } from "./never-copy-banner"
import { ResearchActionsProvider } from "./research-actions"
import { ResearchCard } from "./research-card"
import { ResearchCreateDialog } from "./research-create-dialog"
import { ResearchDetailSheet } from "./research-detail-sheet"
import { ResearchFilterBar } from "./research-filter-bar"
import {
  filterResearch,
  hasResearchFilters,
  parseResearchFilters,
  parseResearchView,
  RESEARCH_URL_KEYS,
  researchStats,
  sortResearch,
  type ResearchSheetTab,
  type ResearchUrlState,
} from "./research-model"
import { ResearchTable } from "./research-table"

const CLEAR_FILTERS: Partial<ResearchUrlState> = { q: "", type: "", status: "", platform: "", pillar: "" }
const ALL_STATUSES = RESEARCH_STATUSES.map((s) => s.id).join(",")

/**
 * Research Library (spec §36): references worth studying, their analysis (hook, structure, angle,
 * psychology, patterns) and the ideas adapted from them. URL: `?q=`, facet params, `?view=`, `?open=<id>`.
 */
export function ResearchLibraryView() {
  const t = useT(researchMessages)
  const [url, update] = useUrlState(RESEARCH_URL_KEYS)
  const isMobile = useIsMobile()
  const items = useTable("research_items")
  const ideas = useTable("content_ideas")
  const contentItems = useTable("content_items")
  const pillars = useLookup("content_pillars")
  const [creating, setCreating] = useState(false)
  // The sheet tab belongs to the reference it was chosen for; any other one opens on Details.
  const [tabState, setTabState] = useState<{ id: ID | null; tab: ResearchSheetTab }>({ id: null, tab: "details" })

  const usage = useMemo(() => buildUsageIndex(ideas, contentItems), [ideas, contentItems])
  const pillarIds = useMemo(() => new Set(pillars.keys()), [pillars])
  const filters = useMemo(() => parseResearchFilters(url, pillarIds), [url, pillarIds])
  const view = parseResearchView(url.view) ?? (isMobile ? "cards" : "table")
  const visible = useMemo(() => sortResearch(filterResearch(items, filters)), [items, filters])
  const stats = useMemo(() => researchStats(items, usage), [items, usage])
  const filtered = hasResearchFilters(filters)
  const archivedHidden = filters.statuses.length ? 0 : stats.archived
  const totalReferences = filters.statuses.length ? items.length : stats.references

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const openItem = url.open ? itemById.get(url.open) : undefined
  // Keep the last reference mounted while the sheet animates out.
  const [shownId, setShownId] = useState<ID | null>(openItem ? openItem.id : null)
  if (openItem && openItem.id !== shownId) setShownId(openItem.id)
  const shown = shownId ? (itemById.get(shownId) ?? null) : null
  const tab: ResearchSheetTab = tabState.id === shownId ? tabState.tab : "details"

  const open = useCallback(
    (id: ID | null, next: ResearchSheetTab = "details") => {
      if (id) setTabState({ id, tab: next })
      update({ open: id ?? "" })
    },
    [update]
  )
  const onRemoved = useCallback(
    (id: ID) => {
      if (new URLSearchParams(window.location.search).get("open") === id) update({ open: "" })
    },
    [update]
  )
  const resetFilters = () => update(CLEAR_FILTERS)

  const filteredEmpty = (
    <EmptyState
      compact
      icon={SearchX}
      title={t("nomatch_title")}
      description={archivedHidden ? t("nomatch_archived") : t("nomatch_description")}
      action={
        <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
          {t("reset_filters")}
        </Button>
      }
    />
  )

  return (
    <ResearchActionsProvider onOpen={open} onRemoved={onRemoved}>
      <PageContainer>
        <PageHeader
          title="Research Library"
          info={t("info")}
          description={<NeverCopyBanner />}
          actions={
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {t("add_reference")}
            </Button>
          }
        />

        {url.open && !openItem ? (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1">{t("missing_link")}</span>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("dismiss")} onClick={() => update({ open: "" })}>
              <X aria-hidden />
            </Button>
          </div>
        ) : null}

        {items.length ? (
          <section aria-label={t("references_aria")} className="flex min-w-0 flex-col gap-3">
            <ResearchFilterBar items={items} pillars={pillars} filters={filters} view={view} onChange={update} onReset={resetFilters} />
            <p className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
              <span className="num">
                {filtered
                  ? t.plural("of_references", totalReferences, { shown: formatNumber(visible.length), count: formatNumber(totalReferences) })
                  : t.plural("references", stats.references, { count: formatNumber(stats.references) })}
              </span>
              <span aria-hidden>·</span>
              <span className="num">{t("analyzed_count", { count: formatNumber(stats.analyzed) })}</span>
              <span aria-hidden>·</span>
              <span className="num">{t("adapted_count", { count: formatNumber(stats.adapted) })}</span>
              <span aria-hidden>·</span>
              <span className="num">{t.plural("used_in", stats.ideas, { count: formatNumber(stats.ideas) })}</span>
              {archivedHidden ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="num">{t("archived_hidden", { count: formatNumber(archivedHidden) })}</span>
                  <Button type="button" variant="link" size="xs" className="h-auto px-0 text-xs" onClick={() => update({ status: ALL_STATUSES })}>
                    {t("show")}
                  </Button>
                </>
              ) : null}
            </p>
            {view === "table" ? (
              <ResearchTable items={visible} usage={usage} pillars={pillars} empty={filteredEmpty} />
            ) : visible.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((item) => (
                  <ResearchCard key={item.id} item={item} usage={usage.get(item.id)} pillar={item.pillar_id ? pillars.get(item.pillar_id) : undefined} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-card">{filteredEmpty}</div>
            )}
          </section>
        ) : (
          <EmptyState
            icon={Library}
            title={t("empty_title")}
            description={t("empty_description")}
            action={
              <Button type="button" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {t("add_reference")}
              </Button>
            }
            secondaryAction={
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href="/research/adapt">
                  <WandSparkles aria-hidden />
                  {t("paste_to_adapt")}
                </Link>
              </Button>
            }
          />
        )}
      </PageContainer>

      <ResearchDetailSheet
        item={shown}
        open={Boolean(openItem)}
        tab={tab}
        usage={shown ? usage.get(shown.id) : undefined}
        onTabChange={(next) => setTabState({ id: shownId, tab: next })}
        onOpenChange={(next) => {
          if (!next) update({ open: "" })
        }}
      />
      <ResearchCreateDialog open={creating} onOpenChange={setCreating} onCreated={(item) => open(item.id)} />
    </ResearchActionsProvider>
  )
}
