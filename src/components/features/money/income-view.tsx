"use client"

import { CircleCheck, Download, FileText, Handshake, Hourglass, Plus, Receipt } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  DataTable,
  EmptyState,
  FacetFilter,
  FilterBar,
  OptionSelect,
  PageContainer,
  PageHeader,
  PlatformIcon,
  ResetFiltersButton,
  SearchInput,
  StatTile,
  type DataTableColumn,
} from "@/components/common"
import { downloadCsvFile } from "@/components/features/settings/download"
import { useNow } from "@/components/features/today/use-now"
import { Button } from "@/components/ui/button"
import { INCOME_SOURCE_IDS, INCOME_STATUS_IDS, PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { formatShortDate, toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { incomeSourceMessages, incomeStatusMessages } from "@/lib/i18n/messages/money"
import { uiActions, useLookup, useSettings, useTable } from "@/lib/store"
import type { IncomeEntry, IncomeSource, IncomeStatus } from "@/lib/types"
import { formatMoney, truncate } from "@/lib/utils"
import { IncomeDetailSheet } from "./income-detail-sheet"
import { IncomeFormDialog } from "./log-income-dialog"
import { incomeMessages, moneyMessages } from "./messages"
import {
  compareIncome,
  EMPTY_INCOME_FILTERS,
  entryTotals,
  filterIncome,
  INCOME_PERIODS,
  incomeCsv,
  isFiltering,
  NO_PLATFORM,
  normalizeCurrency,
  type IncomeFilters,
  type IncomePeriod,
} from "./money-model"
import { IncomeStatusBadge, useSplitTotals } from "./money-ui"

/** `/money/income` — every entry with filters, totals per currency, CSV export, add/edit/delete and `?open=<id>`. */
export function IncomeView() {
  const t = useT(incomeMessages)
  const m = useT(moneyMessages)
  const sourceLabel = useT(incomeSourceMessages)
  const statusLabel = useT(incomeStatusMessages)
  const router = useRouter()
  const searchParams = useSearchParams()
  const now = useNow()
  const primary = normalizeCurrency(useSettings().currency)
  const income = useTable("income_entries")
  const deals = useLookup("brand_deals")
  const items = useLookup("content_items")
  const [filters, setFilters] = useState<IncomeFilters>(EMPTY_INCOME_FILTERS)
  const [editing, setEditing] = useState<{ open: boolean; entry: IncomeEntry | null }>({ open: false, entry: null })

  const openId = searchParams.get("open")
  const openEntry = openId ? (income.find((e) => e.id === openId) ?? null) : null
  const [shownId, setShownId] = useState<string | null>(openId)
  if (openEntry && openId !== shownId) setShownId(openId)
  const shownEntry = income.find((e) => e.id === shownId) ?? null
  const setOpen = useCallback((id: string | null) => router.replace(id ? `/money/income?open=${id}` : "/money/income", { scroll: false }), [router])

  const names = useMemo(
    () => ({
      deal: (id: string) => deals.get(id)?.brand_name,
      item: (id: string) => items.get(id)?.title,
    }),
    [deals, items]
  )
  const filtered = useMemo(() => filterIncome(income, filters, now, names).sort(compareIncome), [income, filters, now, names])
  const filtering = isFiltering(filters)
  const received = useSplitTotals(entryTotals(filtered.filter((e) => e.status === "received"), primary), primary)
  const expected = useSplitTotals(entryTotals(filtered.filter((e) => e.status === "expected"), primary), primary)

  const set = <K extends keyof IncomeFilters>(key: K, value: IncomeFilters[K]) => setFilters((f) => ({ ...f, [key]: value }))
  const currencies = useMemo(() => [...new Set(income.map((e) => normalizeCurrency(e.currency)))].sort(), [income])
  const count = <T,>(fn: (e: IncomeEntry) => T, value: T) => income.filter((e) => fn(e) === value).length
  const sourceOptions = INCOME_SOURCE_IDS.map((s) => ({ value: s, label: sourceLabel(s), count: count((e) => e.source, s) }))
  const statusOptions = INCOME_STATUS_IDS.map((s) => ({ value: s, label: statusLabel(s), count: count((e) => e.status, s) }))
  const platformOptions = [
    ...PLATFORM_IDS.map((p) => ({
      value: p as string,
      label: PLATFORMS[p].label,
      icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
      count: count((e) => e.platform, p),
    })),
    { value: NO_PLATFORM, label: m("no_platform"), count: count((e) => e.platform, null) },
  ].filter((o) => o.count > 0)
  const periodOptions = INCOME_PERIODS.map((p) => ({ value: p, label: t(`period_${p}`) }))

  const openEdit = useCallback((entry: IncomeEntry) => setEditing({ open: true, entry }), [setEditing])

  function exportCsv() {
    const csv = incomeCsv(filtered, {
      headers: [
        t("col_date"),
        t("col_description"),
        t("col_source"),
        t("col_program"),
        t("col_platform"),
        t("col_status"),
        t("col_amount"),
        t("col_currency"),
        t("col_deal"),
        t("col_content"),
      ],
      source: (s) => sourceLabel(s),
      status: (s) => statusLabel(s),
      platform: (p) => PLATFORMS[p].label,
      deal: names.deal,
      item: names.item,
    })
    downloadCsvFile(`orbi-${t("file_name")}-${toISODate(now)}.csv`, csv)
    toast.success(t.plural("exported", filtered.length))
  }

  const columns = useMemo<DataTableColumn<IncomeEntry>[]>(
    () => [
      {
        id: "date",
        header: t("col_date"),
        cell: (e) => <span className="whitespace-nowrap num">{formatShortDate(e.date)}</span>,
        sortValue: (e) => e.date,
      },
      {
        id: "description",
        header: t("col_description"),
        cell: (e) => (
          <span className="flex min-w-0 max-w-64 flex-col">
            <span className="truncate font-medium">{e.description || m("untitled_entry")}</span>
            {e.affiliate_program ? <span className="truncate text-xs text-muted-foreground">{e.affiliate_program}</span> : null}
          </span>
        ),
        sortValue: (e) => e.description.toLowerCase(),
      },
      // Calm UI: the platform rides with the source, and the deal and the post share one "Linked to" column,
      // so sparse columns don't fill the table with dashes.
      {
        id: "source",
        header: t("col_source"),
        cell: (e) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {e.platform ? <PlatformIcon platform={e.platform} label={PLATFORMS[e.platform].label} className="size-3.5 text-muted-foreground" /> : null}
            {sourceLabel(e.source)}
          </span>
        ),
        sortValue: (e) => sourceLabel(e.source),
        hideBelow: "sm",
      },
      {
        id: "linked",
        header: t("col_linked"),
        cell: (e) => {
          const deal = e.brand_deal_id ? deals.get(e.brand_deal_id) : undefined
          const item = e.content_item_id ? items.get(e.content_item_id) : undefined
          if (!deal && !item) return null
          return (
            <span className="flex min-w-0 max-w-48 flex-col">
              {deal ? (
                <Link href={`/money/deals?open=${deal.id}`} className="inline-flex min-w-0 items-center gap-1.5 underline-offset-2 hover:underline">
                  <Handshake className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{deal.brand_name || m("untitled_deal")}</span>
                </Link>
              ) : null}
              {item ? (
                <Link href={`/studio/${item.id}`} className="inline-flex min-w-0 items-center gap-1.5 underline-offset-2 hover:underline" title={item.title}>
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{truncate(item.title.trim() || m("untitled_content"), 60)}</span>
                </Link>
              ) : null}
            </span>
          )
        },
        sortValue: (e) => (e.brand_deal_id ? (deals.get(e.brand_deal_id)?.brand_name ?? null) : e.content_item_id ? (items.get(e.content_item_id)?.title ?? null) : null),
        hideBelow: "lg",
      },
      {
        id: "amount",
        header: t("col_amount"),
        align: "right",
        cell: (e) => <span className="whitespace-nowrap font-medium">{formatMoney(e.amount, e.currency)}</span>,
        sortValue: (e) => e.amount,
      },
      {
        id: "status",
        header: t("col_status"),
        cell: (e) => <IncomeStatusBadge status={e.status} />,
        sortValue: (e) => e.status,
        hideBelow: "sm",
      },
    ],
    [t, m, sourceLabel, deals, items]
  )

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        info={t("description")}
        actions={
          <>
            {income.length ? (
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
                <Download aria-hidden />
                {t("export_csv")}
              </Button>
            ) : null}
            <Button size="sm" onClick={() => uiActions.openDialog({ type: "log-income" })}>
              <Plus aria-hidden />
              {t("log_income")}
            </Button>
          </>
        }
      />

      {openId && !openEntry && income.length ? <p className="-mt-2 text-sm text-muted-foreground">{t("not_found")}</p> : null}

      {income.length ? (
        <>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
            <StatTile
              size="sm"
              label={t("received_total")}
              value={received.value}
              sublabel={received.others ?? (filtering ? t("totals_filtered") : undefined)}
              icon={CircleCheck}
            />
            <StatTile
              size="sm"
              label={t("expected_total")}
              value={expected.value}
              sublabel={expected.others ?? (filtering ? t("totals_filtered") : undefined)}
              icon={Hourglass}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <FilterBar
              actions={
                <span className="text-xs text-muted-foreground num">
                  {filtering ? t("shown_of", { shown: filtered.length, total: income.length }) : t.plural("entries", income.length)}
                </span>
              }
            >
              <SearchInput value={filters.query} onChange={(q) => set("query", q)} placeholder={t("search_placeholder")} />
              <OptionSelect<IncomePeriod>
                options={periodOptions}
                value={filters.period}
                size="sm"
                aria-label={t("period_label")}
                className="h-7 w-auto min-w-32"
                onChange={(next) => set("period", next ?? "all")}
              />
              <FacetFilter title={t("filter_source")} options={sourceOptions} value={filters.sources} onChange={(v) => set("sources", v as IncomeSource[])} />
              <FacetFilter title={t("filter_status")} options={statusOptions} value={filters.statuses} onChange={(v) => set("statuses", v as IncomeStatus[])} />
              {platformOptions.length ? (
                <FacetFilter title={t("filter_platform")} options={platformOptions} value={filters.platforms} onChange={(v) => set("platforms", v)} />
              ) : null}
              {currencies.length > 1 ? (
                <FacetFilter
                  title={t("filter_currency")}
                  options={currencies.map((c) => ({ value: c, label: c, count: income.filter((e) => normalizeCurrency(e.currency) === c).length }))}
                  value={filters.currencies}
                  onChange={(v) => set("currencies", v)}
                />
              ) : null}
              <ResetFiltersButton show={filtering} onClick={() => setFilters(EMPTY_INCOME_FILTERS)} label={t("reset")} />
            </FilterBar>

            <DataTable
              rows={filtered}
              columns={columns}
              getRowId={(e) => e.id}
              onRowClick={(e) => setOpen(e.id)}
              rowLabel={(e) => `${formatMoney(e.amount, e.currency)} · ${e.description || m("untitled_entry")}`}
              rowClassName={(e) => (e.id === openId ? "bg-muted/50" : undefined)}
              pageSize={50}
              aria-label={t("title")}
              empty={
                <EmptyState
                  compact
                  icon={Receipt}
                  title={t("no_matches_title")}
                  description={t("no_matches_description")}
                  action={
                    <Button size="sm" variant="outline" onClick={() => setFilters(EMPTY_INCOME_FILTERS)}>
                      {t("reset_filters")}
                    </Button>
                  }
                />
              }
            />
          </div>
        </>
      ) : (
        <EmptyState
          icon={Receipt}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button onClick={() => uiActions.openDialog({ type: "log-income" })}>
              <Plus aria-hidden />
              {t("log_income")}
            </Button>
          }
        />
      )}

      <IncomeDetailSheet
        entry={shownEntry}
        open={Boolean(openEntry)}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
        onEdit={openEdit}
        onBeforeDelete={() => setOpen(null)}
      />
      <IncomeFormDialog open={editing.open} entry={editing.entry} onOpenChange={(next) => setEditing((s) => ({ ...s, open: next }))} />
    </PageContainer>
  )
}
