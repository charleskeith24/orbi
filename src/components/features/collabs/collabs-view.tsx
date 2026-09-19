"use client"

import { Blend, Plus, SquareKanban, Table2 } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AiButton,
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
import { COLLAB_STATUS_IDS, COLLAB_TYPE_IDS, PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { collabTypeMessages } from "@/lib/i18n/messages/collabs"
import { useTable } from "@/lib/store"
import type { Collab, CollabStatus, ID, InsertRow } from "@/lib/types"
import { matchesQuery } from "@/lib/utils"
import { CollabDetailSheet } from "./collab-detail-sheet"
import { CollabFormDialog } from "./collab-form-dialog"
import { CollabIdeasSheet } from "./collab-ideas-panel"
import { CollabSummary } from "./collab-lift-tile"
import { collabSearchFields, compareCollabs } from "./collab-model"
import { CollabsBoard } from "./collabs-board"
import { CollabsTable } from "./collabs-table"
import { collabsMessages } from "./messages"

type View = "board" | "table"

/**
 * `/collabs` — the Collab tracker: lift + follow-ups, board by status (drag between statuses) or table.
 * `?open=<id>` opens a collab, `?new=1` the form (`&campaign=<id>` / `&deal=<id>` pre-link it),
 * `?ideas=1` the Collab ideas panel, `?view=table` the table.
 */
export function CollabsView() {
  const t = useT(collabsMessages)
  const typeLabel = useT(collabTypeMessages)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const now = useNow()
  const collabs = useTable("collabs")

  const view: View = searchParams.get("view") === "table" ? "table" : "board"
  const openId = searchParams.get("open")
  const wantsNew = searchParams.get("new") === "1"
  const wantsIdeas = searchParams.get("ideas") === "1"

  const [query, setQuery] = useState("")
  const [types, setTypes] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])
  const [showDeclined, setShowDeclined] = useState(false)
  const [form, setForm] = useState<{ open: boolean; collab: Collab | null; defaults?: InsertRow<"collabs"> }>({ open: false, collab: null })
  const [ideasOpen, setIdeasOpen] = useState(false)

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

  // `?new=1` (optionally with a campaign or deal) and `?ideas=1` open once, then leave the URL.
  const [linkHandled, setLinkHandled] = useState(false)
  if ((wantsNew || wantsIdeas) && !linkHandled) {
    setLinkHandled(true)
    if (wantsNew) {
      const campaign = searchParams.get("campaign")
      const deal = searchParams.get("deal")
      const defaults: InsertRow<"collabs"> = {
        ...(campaign ? { campaign_id: campaign } : {}),
        ...(deal ? { brand_deal_id: deal, type: "group_brand_deal" as const } : {}),
      }
      setForm({ open: true, collab: null, defaults })
    } else setIdeasOpen(true)
  }
  useEffect(() => {
    if (wantsNew || wantsIdeas) replaceParams({ new: null, ideas: null, campaign: null, deal: null })
  }, [wantsNew, wantsIdeas, replaceParams])

  // Keep the last collab mounted while the sheet animates out.
  const openCollab = openId ? (collabs.find((c) => c.id === openId) ?? null) : null
  const [shownId, setShownId] = useState<ID | null>(openId)
  if (openCollab && openId !== shownId) setShownId(openId)
  const shownCollab = collabs.find((c) => c.id === shownId) ?? null

  const sorted = useMemo(() => [...collabs].sort(compareCollabs), [collabs])
  const filtered = useMemo(
    () =>
      sorted.filter(
        (c) =>
          (!types.length || types.includes(c.type)) &&
          (!platforms.length || (c.partner_platform !== null && platforms.includes(c.partner_platform))) &&
          matchesQuery(query, ...collabSearchFields(c))
      ),
    [sorted, types, platforms, query]
  )
  const totals = useMemo(() => {
    const out = Object.fromEntries(COLLAB_STATUS_IDS.map((s) => [s, 0])) as Record<CollabStatus, number>
    for (const c of collabs) out[c.status]++
    return out
  }, [collabs])
  const declined = totals.declined

  const filtering = Boolean(query.trim() || types.length || platforms.length)
  const resetFilters = () => {
    setQuery("")
    setTypes([])
    setPlatforms([])
  }
  const typeOptions = COLLAB_TYPE_IDS.map((type) => ({ value: type, label: typeLabel(type), count: collabs.filter((c) => c.type === type).length })).filter(
    (o) => o.count > 0
  )
  const platformOptions = PLATFORM_IDS.map((p) => ({
    value: p,
    label: PLATFORMS[p].label,
    icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
    count: collabs.filter((c) => c.partner_platform === p).length,
  })).filter((o) => o.count > 0)

  const openEdit = useCallback((collab: Collab) => setForm({ open: true, collab }), [])
  const beforeDelete = useCallback(
    (collab: Collab) => {
      if (collab.id === openId) setOpen(null)
    },
    [openId, setOpen]
  )

  const actions = (
    <>
      <AiButton size="sm" onClick={() => setIdeasOpen(true)}>
        {t("ideas_button")}
      </AiButton>
      <Button size="sm" onClick={() => setForm({ open: true, collab: null })}>
        <Plus aria-hidden />
        {t("add_collab")}
      </Button>
    </>
  )

  const noMatches = (
    <EmptyState
      compact
      icon={Blend}
      title={t("no_matches_title")}
      description={t("no_matches_description")}
      action={
        <Button size="sm" variant="outline" onClick={resetFilters}>
          {t("reset_filters")}
        </Button>
      }
    />
  )

  const tableRows = showDeclined ? filtered : filtered.filter((c) => c.status !== "declined")

  return (
    <PageContainer>
      <PageHeader title={t("title")} icon={Blend} description={t("description")} actions={actions} />

      {openId && !openCollab && collabs.length ? <p className="-mt-2 text-sm text-muted-foreground">{t("not_found")}</p> : null}

      {collabs.length ? (
        <>
          <CollabSummary now={now} onOpen={setOpen} />
          <div className="flex min-w-0 flex-col gap-3">
            <FilterBar
              actions={
                <>
                  <span className="text-xs text-muted-foreground num">
                    {filtering ? t("shown_of", { shown: filtered.length, total: collabs.length }) : t.plural("collabs", collabs.length)}
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
              {typeOptions.length ? <FacetFilter title={t("filter_type")} options={typeOptions} value={types} onChange={setTypes} /> : null}
              {platformOptions.length ? (
                <FacetFilter title={t("filter_platform")} options={platformOptions} value={platforms} onChange={setPlatforms} />
              ) : null}
              <ResetFiltersButton show={filtering} onClick={resetFilters} label={t("reset")} />
            </FilterBar>

            {view === "board" ? (
              <CollabsBoard
                collabs={filtered}
                totals={totals}
                filtered={filtering}
                now={now}
                openId={openId}
                showDeclined={showDeclined}
                onShowDeclined={setShowDeclined}
                onOpen={setOpen}
                onEdit={openEdit}
                onBeforeDelete={beforeDelete}
              />
            ) : (
              <>
                <CollabsTable collabs={tableRows} now={now} openId={openId} empty={noMatches} onOpen={setOpen} onEdit={openEdit} onBeforeDelete={beforeDelete} />
                {declined ? (
                  <p className="text-xs text-muted-foreground">
                    {showDeclined ? t.plural("declined_shown", declined) : t.plural("declined_hidden", declined)}{" "}
                    <Button type="button" variant="link" size="xs" className="h-auto px-0 text-xs" onClick={() => setShowDeclined((v) => !v)}>
                      {showDeclined ? t("hide_declined") : t("show_declined")}
                    </Button>
                  </p>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Blend}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button onClick={() => setForm({ open: true, collab: null })}>
              <Plus aria-hidden />
              {t("add_collab")}
            </Button>
          }
          secondaryAction={
            <AiButton onClick={() => setIdeasOpen(true)}>{t("empty_ideas")}</AiButton>
          }
        />
      )}

      <CollabDetailSheet
        collab={shownCollab}
        open={Boolean(openCollab)}
        now={now}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
        onEdit={openEdit}
        onBeforeDelete={() => setOpen(null)}
      />

      <CollabFormDialog
        open={form.open}
        collab={form.collab}
        defaults={form.defaults}
        onOpenChange={(next) => setForm((f) => ({ ...f, open: next }))}
        onSaved={(row, created) => {
          if (created) setOpen(row.id)
        }}
      />

      <CollabIdeasSheet open={ideasOpen} onOpenChange={setIdeasOpen} onOpenCollab={(id) => {
        setIdeasOpen(false)
        setOpen(id)
      }} />
    </PageContainer>
  )
}
