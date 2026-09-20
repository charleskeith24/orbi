"use client"

import { Plus, Quote, SearchX, Star, X } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AiButton,
  chipVariants,
  Disclosure,
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
import { formatMultiple, hookCategoryPerformance } from "@/lib/analytics"
import { HOOK_CATEGORIES, HOOK_CATEGORY_IDS } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import { dataActions, useDb, useLookup } from "@/lib/store"
import type { Hook, HookCategory, HookSource, ID } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { HookDetailSheet } from "./hook-detail-sheet"
import { HookFormDialog } from "./hook-form-dialog"
import { HookGenerateDialog } from "./hook-generate-dialog"
import { hookMessages } from "./hook-messages"
import { bestHookStyle, HookStylesCard, TopHooksCard } from "./hook-insights"
import {
  EMPTY_HOOK_FILTERS,
  emptyHookStats,
  filterHooks,
  hasHookFilters,
  HOOK_SORTS,
  HOOK_SOURCE_IDS,
  hookFacetCounts,
  hookStats,
  newHookValues,
  overallPerformance,
  sortHooks,
  type HookFilters,
  type HookMetric,
  type HookSort,
} from "./hook-model"
import { HookListHeader, HookRow } from "./hook-row"
import { HookUseDialog } from "./hook-use-dialog"
import { labMessages } from "./messages"
import { useOpenParam } from "./use-open-param"

/**
 * Hook Library (spec §12, §13): templates with ___ blanks and hooks from your own content, with usage and
 * the performance of the posts that used them. `?open=<hookId>` opens a hook's detail sheet.
 */
export function HookLibraryView() {
  const t = useT(hookMessages)
  const l = useT(labMessages)
  const lang = useUiLang()
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
  const styles = useMemo(() => hookCategoryPerformance(db, now, { lang }), [db, now, lang])
  const lead = useMemo(() => bestHookStyle(styles, overall), [styles, overall])
  const sortOptions = useMemo<SelectOption<HookSort>[]>(() => HOOK_SORTS.map((id) => ({ value: id, label: l(`sort_${id}`) })), [l])
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
    toast.success(t("duplicated"), { description: t("duplicated_description"), action: { label: t("open"), onClick: () => setOpenId(copy.id) } })
  }

  async function remove(hook: Hook) {
    const linked = stats.get(hook.id)?.itemIds.length ?? 0
    const ok = await confirm({
      title: t("delete_title"),
      description: linked ? t.plural("delete_linked", linked, { count: formatNumber(linked) }) : t("delete_unlinked"),
      confirmLabel: t("delete_confirm"),
    })
    if (!ok) return
    if (openId === hook.id) setOpenId(null)
    dataActions.remove("hooks", hook.id)
    toast.success(t("deleted"))
  }

  return (
    <PageContainer>
      <PageHeader
        title="Hook Library"
        info={t("info")}
        actions={
          <>
            <AiButton type="button" size="sm" onClick={() => setGenerateOpen(true)}>
              {t("generate_ai")}
            </AiButton>
            <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
              <Plus aria-hidden />
              {t("new_hook")}
            </Button>
          </>
        }
      />

      {openId && !openHook ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <span className="min-w-0 flex-1">{t("missing_link")}</span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={l("dismiss")} onClick={() => setOpenId(null)}>
            <X aria-hidden />
          </Button>
        </div>
      ) : null}

      {hooks.length ? (
        <Disclosure
          variant="section"
          label={t("insights")}
          meta={lead ? t("insight_meta", { style: lead.label, multiple: formatMultiple(lead.lift) }) : undefined}
          storageKey="hook-insights"
        >
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <HookStylesCard styles={styles} overall={overall} metric={metric} onMetricChange={setMetric} />
            <TopHooksCard hooks={hooks} stats={stats} overall={overall} onOpen={setOpenId} />
          </div>
        </Disclosure>
      ) : null}

      <section aria-label={t("hooks_label")} className="flex min-w-0 flex-col gap-3">
        {hooks.length ? (
          <>
            <FilterBar
              actions={<OptionSelect size="sm" options={sortOptions} value={sort} onChange={(next) => next && setSort(next)} aria-label={t("sort_label")} className="w-40" />}
            >
              <SearchInput value={filters.q} onChange={(q) => setFilter({ q })} placeholder={t("search_placeholder")} />
              <FacetFilter
                title={t("style")}
                options={HOOK_CATEGORY_IDS.map((c) => ({ value: c, label: HOOK_CATEGORIES[c].label, count: categoryCounts.get(c) ?? 0 }))}
                value={filters.categories}
                onChange={(value) => setFilter({ categories: value as HookCategory[] })}
              />
              <FacetFilter
                title={t("source")}
                options={HOOK_SOURCE_IDS.map((s) => ({ value: s, label: t(`source_${s}`), count: sourceCounts.get(s) ?? 0 }))}
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
                {t("favourites")}
              </button>
              <ResetFiltersButton show={hasHookFilters(filters)} onClick={() => setFilters(EMPTY_HOOK_FILTERS)} />
            </FilterBar>

            <p className="text-xs text-muted-foreground num" aria-live="polite">
              {visible.length === hooks.length
                ? t.plural("hooks", hooks.length, { count: formatNumber(hooks.length) })
                : t.plural("hooks_of", hooks.length, { shown: formatNumber(visible.length), count: formatNumber(hooks.length) })}
              {" · "}
              {t.plural("templates", templates, { count: formatNumber(templates) })} ·{" "}
              {t.plural("favourites", favorites, { count: formatNumber(favorites) })}
            </p>

            {visible.length ? (
              <ul className="flex min-w-0 flex-col divide-y overflow-hidden rounded-lg border bg-card">
                <HookListHeader />
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
                  title={t("nomatch_title")}
                  description={t("nomatch_description")}
                  action={
                    <Button type="button" size="sm" variant="outline" onClick={() => setFilters(EMPTY_HOOK_FILTERS)}>
                      {t("reset_filters")}
                    </Button>
                  }
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Quote}
            title={t("empty_title")}
            description={t("empty_description")}
            action={
              <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
                <Plus aria-hidden />
                {t("new_hook")}
              </Button>
            }
            secondaryAction={
              <AiButton type="button" size="sm" onClick={() => setGenerateOpen(true)}>
                {t("generate_ai")}
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
        onCreated={(hook) => toast.success(t("added"), { description: hook.text, action: { label: t("open"), onClick: () => setOpenId(hook.id) } })}
      />
      <HookGenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
      {confirmDialog}
    </PageContainer>
  )
}
