"use client"

import { Plus, Quote, SearchX, Star, X } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AiButton,
  chipVariants,
  EmptyState,
  FacetFilter,
  FilterBar,
  OptionSelect,
  PageContainer,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  useConfirm,
  type SelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { hookCategoryPerformance } from "@/lib/analytics"
import { HOOK_CATEGORIES, HOOK_CATEGORY_IDS } from "@/lib/constants"
import { dataActions, useDb, useLookup } from "@/lib/store"
import type { Hook, HookCategory, HookSource, ID } from "@/lib/types"
import { cn, formatNumber, pluralize } from "@/lib/utils"
import { HookDetailSheet } from "./hook-detail-sheet"
import { HookFormDialog } from "./hook-form-dialog"
import { HookGenerateDialog } from "./hook-generate-dialog"
import { HookStylesCard, TopHooksCard } from "./hook-insights"
import {
  EMPTY_HOOK_FILTERS,
  emptyHookStats,
  filterHooks,
  hasHookFilters,
  HOOK_SORTS,
  HOOK_SOURCE_IDS,
  HOOK_SOURCES,
  hookFacetCounts,
  hookStats,
  newHookValues,
  overallPerformance,
  sortHooks,
  type HookFilters,
  type HookMetric,
  type HookSort,
} from "./hook-model"
import { HookRow } from "./hook-row"
import { HookUseDialog } from "./hook-use-dialog"
import { useOpenParam } from "./use-open-param"

const SORT_OPTIONS: SelectOption<HookSort>[] = HOOK_SORTS.map((s) => ({ value: s.id, label: s.label }))

/**
 * Hook Library (spec §12, §13): templates with ___ blanks and hooks from your own content, with usage and
 * the performance of the posts that used them. `?open=<hookId>` opens a hook's detail sheet.
 */
export function HookLibraryView() {
  const db = useDb()
  const pillars = useLookup("content_pillars")
  const [now] = useState(() => new Date())
  const [openId, setOpenId] = useOpenParam()
  const [filters, setFilters] = useState<HookFilters>(EMPTY_HOOK_FILTERS)
  const [sort, setSort] = useState<HookSort>("performance")
  const [metric, setMetric] = useState<HookMetric>("views")
  const [usingHook, setUsingHook] = useState<Hook | null>(null)
  const [useOpen, setUseOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const hooks = db.hooks
  const stats = useMemo(() => hookStats(db, now), [db, now])
  const overall = useMemo(() => overallPerformance(db, now), [db, now])
  const styles = useMemo(() => hookCategoryPerformance(db, now), [db, now])
  const visible = useMemo(() => sortHooks(filterHooks(hooks, filters), sort, stats), [hooks, filters, sort, stats])
  const categoryCounts = useMemo(() => hookFacetCounts(hooks, filters, "categories"), [hooks, filters])
  const sourceCounts = useMemo(() => hookFacetCounts(hooks, filters, "sources"), [hooks, filters])
  const templates = useMemo(() => hooks.filter((h) => h.is_template).length, [hooks])
  const favorites = useMemo(() => hooks.filter((h) => h.is_favorite).length, [hooks])

  // `?open=<id>` drives the sheet; keep the last hook mounted while the sheet animates out.
  const hookById = useMemo(() => new Map(hooks.map((h) => [h.id, h])), [hooks])
  const openHook = openId ? hookById.get(openId) : undefined
  const [shownId, setShownId] = useState<ID | null>(openHook ? openHook.id : null)
  if (openHook && openHook.id !== shownId) setShownId(openHook.id)
  const shownHook = shownId ? (hookById.get(shownId) ?? null) : null

  const setFilter = (patch: Partial<HookFilters>) => setFilters((current) => ({ ...current, ...patch }))

  function use(hook: Hook) {
    setUsingHook(hook)
    setUseOpen(true)
  }

  function duplicate(hook: Hook) {
    const copy = dataActions.insert("hooks", newHookValues({ text: hook.text, category: hook.category, source: "user", pillar_id: hook.pillar_id, notes: hook.notes }))
    toast.success("Hook duplicated", { description: "Edit the copy to make a variation.", action: { label: "Open", onClick: () => setOpenId(copy.id) } })
  }

  async function remove(hook: Hook) {
    const linked = stats.get(hook.id)?.itemIds.length ?? 0
    const ok = await confirm({
      title: "Delete this hook?",
      description: linked
        ? `It's linked to ${pluralize(linked, "content piece")}. They keep their hook text — only the link to the library is removed.`
        : "It will be removed from your Hook Library.",
      confirmLabel: "Delete hook",
    })
    if (!ok) return
    if (openId === hook.id) setOpenId(null)
    dataActions.remove("hooks", hook.id)
    toast.success("Hook deleted")
  }

  return (
    <PageContainer>
      <PageHeader
        title="Hook Library"
        description="Proven opening lines — templates with ___ blanks and hooks from your own content, ranked by how the posts that used them performed."
        actions={
          <>
            <AiButton type="button" size="sm" onClick={() => setGenerateOpen(true)}>
              Generate hooks with AI
            </AiButton>
            <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
              <Plus aria-hidden />
              New hook
            </Button>
          </>
        }
      />

      {openId && !openHook ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <span className="min-w-0 flex-1">The hook in this link no longer exists — it may have been deleted.</span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={() => setOpenId(null)}>
            <X aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <HookStylesCard styles={styles} overall={overall} metric={metric} onMetricChange={setMetric} />
        <TopHooksCard hooks={hooks} stats={stats} overall={overall} onOpen={setOpenId} />
      </div>

      <section aria-label="Hooks" className="flex min-w-0 flex-col gap-3">
        {hooks.length ? (
          <>
            <FilterBar
              actions={<OptionSelect size="sm" options={SORT_OPTIONS} value={sort} onChange={(next) => next && setSort(next)} aria-label="Sort hooks" className="w-40" />}
            >
              <SearchInput value={filters.q} onChange={(q) => setFilter({ q })} placeholder="Search hooks…" />
              <FacetFilter
                title="Style"
                options={HOOK_CATEGORY_IDS.map((c) => ({ value: c, label: HOOK_CATEGORIES[c].label, count: categoryCounts.get(c) ?? 0 }))}
                value={filters.categories}
                onChange={(value) => setFilter({ categories: value as HookCategory[] })}
              />
              <FacetFilter
                title="Source"
                options={HOOK_SOURCE_IDS.map((s) => ({ value: s, label: HOOK_SOURCES[s].label, count: sourceCounts.get(s) ?? 0 }))}
                value={filters.sources}
                onChange={(value) => setFilter({ sources: value as HookSource[] })}
              />
              <button
                type="button"
                aria-pressed={filters.favorites}
                onClick={() => setFilter({ favorites: !filters.favorites })}
                className={chipVariants({ size: "sm", selected: filters.favorites })}
              >
                <Star className={cn(filters.favorites && "fill-current")} aria-hidden />
                Favourites
              </button>
              <ResetFiltersButton show={hasHookFilters(filters)} onClick={() => setFilters(EMPTY_HOOK_FILTERS)} />
            </FilterBar>

            <p className="text-xs text-muted-foreground num" aria-live="polite">
              {visible.length === hooks.length ? pluralize(hooks.length, "hook") : `${formatNumber(visible.length)} of ${pluralize(hooks.length, "hook")}`}
              {" · "}
              {pluralize(templates, "template")} · {pluralize(favorites, "favourite")}
            </p>

            {visible.length ? (
              <ul className="flex min-w-0 flex-col divide-y overflow-hidden rounded-lg border bg-card">
                {visible.map((hook) => (
                  <HookRow
                    key={hook.id}
                    hook={hook}
                    stats={stats.get(hook.id) ?? emptyHookStats()}
                    pillar={hook.pillar_id ? pillars.get(hook.pillar_id) : undefined}
                    onOpen={setOpenId}
                    onUse={use}
                    onDuplicate={duplicate}
                    onDelete={(h) => void remove(h)}
                  />
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border bg-card">
                <EmptyState
                  compact
                  icon={SearchX}
                  title="No hooks match"
                  description="Try a different search or fewer filters."
                  action={
                    <Button type="button" size="sm" variant="outline" onClick={() => setFilters(EMPTY_HOOK_FILTERS)}>
                      Reset filters
                    </Button>
                  }
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Quote}
            title="Your Hook Library is empty"
            description="The hook is the first line — it decides whether anyone reads the rest. Save the ones that work and reuse them."
            action={
              <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
                <Plus aria-hidden />
                New hook
              </Button>
            }
            secondaryAction={
              <AiButton type="button" size="sm" onClick={() => setGenerateOpen(true)}>
                Generate hooks with AI
              </AiButton>
            }
          />
        )}
      </section>

      <HookDetailSheet
        hook={shownHook}
        open={Boolean(openHook)}
        onOpenChange={(next) => {
          if (!next) setOpenId(null)
        }}
        stats={shownHook ? (stats.get(shownHook.id) ?? emptyHookStats()) : emptyHookStats()}
        overall={overall}
        onUse={use}
        onDuplicate={duplicate}
        onDelete={(h) => void remove(h)}
      />
      <HookUseDialog hook={usingHook} open={useOpen} onOpenChange={setUseOpen} />
      <HookFormDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(hook) => toast.success("Hook added to the library", { description: hook.text, action: { label: "Open", onClick: () => setOpenId(hook.id) } })}
      />
      <HookGenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
      {confirmDialog}
    </PageContainer>
  )
}
