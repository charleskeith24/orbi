"use client"

import { Handshake, IdCard, Plus, SquareKanban, Table2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  EmptyState,
  FacetFilter,
  FilterBar,
  PageContainer,
  PageHeader,
  PlatformIcon,
  ResetFiltersButton,
  SearchInput,
  ViewToggle,
} from "@/components/common"
import { useNow } from "@/components/features/today/use-now"
import { Button } from "@/components/ui/button"
import { DEAL_SOURCE_IDS, DEAL_STATUS_IDS, PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { dealSourceMessages } from "@/lib/i18n/messages/money"
import { useSettings, useTable } from "@/lib/store"
import type { BrandDeal, DealStatus, ID } from "@/lib/types"
import { matchesQuery } from "@/lib/utils"
import { DealDetailSheet } from "./deal-detail-sheet"
import { DealFormDialog } from "./deal-form-dialog"
import { DealsBoard } from "./deals-board"
import { dealsMessages } from "./deals-messages"
import { DealsTable } from "./deals-table"
import { compareDeals, normalizeCurrency } from "./money-model"

type View = "board" | "table"

/** `/money/deals` — board by status (drag between statuses) or table; `?open=<id>` opens a deal, `?new=1` the form, `?view=table`. */
export function DealsView() {
  const t = useT(dealsMessages)
  const sourceLabel = useT(dealSourceMessages)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const now = useNow()
  const primary = normalizeCurrency(useSettings().currency)
  const deals = useTable("brand_deals")

  const view: View = searchParams.get("view") === "table" ? "table" : "board"
  const openId = searchParams.get("open")
  const wantsNew = searchParams.get("new") === "1"

  const [query, setQuery] = useState("")
  const [sources, setSources] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])
  const [form, setForm] = useState<{ open: boolean; deal: BrandDeal | null }>({ open: false, deal: null })

  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )
  const setOpen = useCallback((id: ID | null) => replaceParams({ open: id }), [replaceParams])

  // `?new=1` opens the form once, then leaves the URL.
  const [newHandled, setNewHandled] = useState(false)
  if (wantsNew && !newHandled) {
    setNewHandled(true)
    setForm({ open: true, deal: null })
  }
  useEffect(() => {
    if (wantsNew) replaceParams({ new: null })
  }, [wantsNew, replaceParams])

  // Keep the last deal mounted while the sheet animates out.
  const openDeal = openId ? (deals.find((d) => d.id === openId) ?? null) : null
  const [shownId, setShownId] = useState<ID | null>(openId)
  if (openDeal && openId !== shownId) setShownId(openId)
  const shownDeal = deals.find((d) => d.id === shownId) ?? null

  const sorted = useMemo(() => [...deals].sort(compareDeals(DEAL_STATUS_IDS)), [deals])
  const filtered = useMemo(
    () =>
      sorted.filter(
        (d) =>
          (!sources.length || sources.includes(d.source)) &&
          (!platforms.length || d.platforms.some((p) => platforms.includes(p))) &&
          matchesQuery(query, d.brand_name, d.contact_name, d.contact_email, d.contact_handle, d.notes, d.deliverables)
      ),
    [sorted, sources, platforms, query]
  )
  const totals = useMemo(() => {
    const out = Object.fromEntries(DEAL_STATUS_IDS.map((s) => [s, 0])) as Record<DealStatus, number>
    for (const d of deals) out[d.status]++
    return out
  }, [deals])

  const filtering = Boolean(query.trim() || sources.length || platforms.length)
  const resetFilters = () => {
    setQuery("")
    setSources([])
    setPlatforms([])
  }
  const sourceOptions = DEAL_SOURCE_IDS.map((s) => ({ value: s, label: sourceLabel(s), count: deals.filter((d) => d.source === s).length }))
  const platformOptions = PLATFORM_IDS.map((p) => ({
    value: p,
    label: PLATFORMS[p].label,
    icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
    count: deals.filter((d) => d.platforms.includes(p)).length,
  })).filter((o) => o.count > 0)

  const openEdit = useCallback((deal: BrandDeal) => setForm({ open: true, deal }), [])
  const beforeDelete = useCallback(
    (deal: BrandDeal) => {
      if (deal.id === openId) setOpen(null)
    },
    [openId, setOpen]
  )

  const addButton = (
    <Button size="sm" onClick={() => setForm({ open: true, deal: null })}>
      <Plus aria-hidden />
      {t("add_deal")}
    </Button>
  )

  const noMatches = (
    <EmptyState
      compact
      icon={Handshake}
      title={t("no_matches_title")}
      description={t("no_matches_description")}
      action={
        <Button size="sm" variant="outline" onClick={resetFilters}>
          {t("reset_filters")}
        </Button>
      }
    />
  )

  return (
    <PageContainer>
      <PageHeader title={t("title")} info={t("description")} actions={addButton} />

      {openId && !openDeal && deals.length ? <p className="-mt-2 text-sm text-muted-foreground">{t("not_found")}</p> : null}

      {deals.length ? (
        <div className="flex min-w-0 flex-col gap-3">
          <FilterBar
            actions={
              <>
                <span className="text-xs text-muted-foreground num">
                  {filtering ? t("shown_of", { shown: filtered.length, total: deals.length }) : t.plural("deals", deals.length)}
                </span>
                <ViewToggle<View>
                  value={view}
                  onChange={(next) => replaceParams({ view: next === "table" ? "table" : null })}
                  aria-label={t("view_label")}
                  options={[
                    { value: "board", label: t("view_board"), icon: SquareKanban },
                    { value: "table", label: t("view_table"), icon: Table2 },
                  ]}
                />
              </>
            }
          >
            <SearchInput value={query} onChange={setQuery} placeholder={t("search_placeholder")} />
            <FacetFilter title={t("filter_source")} options={sourceOptions} value={sources} onChange={setSources} />
            {platformOptions.length ? (
              <FacetFilter title={t("filter_platform")} options={platformOptions} value={platforms} onChange={setPlatforms} />
            ) : null}
            <ResetFiltersButton show={filtering} onClick={resetFilters} label={t("reset")} />
          </FilterBar>

          {view === "board" ? (
            <DealsBoard
              deals={filtered}
              totals={totals}
              filtered={filtering}
              primary={primary}
              now={now}
              openId={openId}
              onOpen={setOpen}
              onEdit={openEdit}
              onBeforeDelete={beforeDelete}
            />
          ) : (
            <DealsTable deals={filtered} openId={openId} empty={noMatches} onOpen={setOpen} onEdit={openEdit} onBeforeDelete={beforeDelete} />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Handshake}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button onClick={() => setForm({ open: true, deal: null })}>
              <Plus aria-hidden />
              {t("add_deal")}
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline">
              <Link href="/money/media-kit">
                <IdCard aria-hidden />
                {t("open_media_kit")}
              </Link>
            </Button>
          }
        />
      )}

      <DealDetailSheet
        deal={shownDeal}
        open={Boolean(openDeal)}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
        onEdit={openEdit}
        onBeforeDelete={() => setOpen(null)}
      />

      <DealFormDialog
        open={form.open}
        deal={form.deal}
        onOpenChange={(next) => setForm((f) => ({ ...f, open: next }))}
        onSaved={(row, created) => {
          if (created) setOpen(row.id)
        }}
      />
    </PageContainer>
  )
}
