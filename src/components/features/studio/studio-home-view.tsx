"use client"

import { SearchX } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { EmptyState, PageContainer, PageHeader, PageSection, SearchInput, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { isOverdue, tieredRows } from "@/lib/analytics"
import { useT } from "@/lib/i18n"
import { PIPELINE_STAGE_ORDER } from "@/lib/constants"
import { uiActions, useDb, useSettings } from "@/lib/store"
import type { ContentScript, ID, ScriptFormat } from "@/lib/types"
import { formatNumber, matchesQuery } from "@/lib/utils"
import { ContentRow, ContinueCreating, IdeaStarts, RecentlyPublished, type PublishedEntry } from "./home-lists"
import { QuickStartDialog, QuickStartGrid } from "./home-quick-start"
import { studioHomeMessages } from "./messages"
import { CONTINUE_STAGES, dueSortKey } from "./studio-utils"
import { useNow } from "./use-now"

function setQueryParam(value: string) {
  const params = new URLSearchParams(window.location.search)
  if (value) params.set("q", value)
  else params.delete("q")
  const query = params.toString()
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
}

const newContent = () => uiActions.openDialog({ type: "new-content" })

/**
 * Content Studio home (Calm UI): format quick-starts, what's in progress, the ideas ready to become content
 * and what just went live. `?q=` searches every piece (`?open=<id>` is redirected by the page). New content is
 * the top bar's ＋ New (and the "From scratch" tile); the page's explanation is the title's ⓘ.
 */
export function StudioHomeView() {
  const t = useT(studioHomeMessages)
  const searchParams = useSearchParams()
  const db = useDb()
  const settings = useSettings()
  const now = useNow()
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")
  const [dialog, setDialog] = useState<{ format: ScriptFormat; open: boolean; key: number } | null>(null)

  const scripts = useMemo(() => {
    const map = new Map<ID, ContentScript>()
    for (const s of db.content_scripts) {
      if (!s.is_current) continue
      const prev = map.get(s.content_item_id)
      if (!prev || s.updated_at > prev.updated_at) map.set(s.content_item_id, s)
    }
    return map
  }, [db.content_scripts])

  const inProgress = useMemo(
    () =>
      db.content_items
        .filter((i) => CONTINUE_STAGES.includes(i.stage))
        .sort((a, b) => dueSortKey(a) - dueSortKey(b) || b.updated_at.localeCompare(a.updated_at)),
    [db.content_items]
  )
  const overdue = useMemo(() => inProgress.filter((i) => isOverdue(i, now)).length, [inProgress, now])

  const ideas = useMemo(
    () =>
      db.content_ideas
        .filter((i) => i.status === "validated" || i.status === "selected")
        .sort(
          (a, b) =>
            (b.score ?? -1) - (a.score ?? -1) ||
            Number(b.status === "selected") - Number(a.status === "selected") ||
            b.updated_at.localeCompare(a.updated_at)
        ),
    [db.content_ideas]
  )

  const published = useMemo<PublishedEntry[]>(
    () =>
      tieredRows(db, settings, now)
        .slice(0, 6)
        .map((row) => ({ item: row.item, views: row.metric ? row.views : null, tier: row.tier, publishedAt: row.publishedAt })),
    [db, settings, now]
  )

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    return db.content_items
      .filter((i) => matchesQuery(q, i.title, i.hook, i.notes))
      .sort((a, b) => PIPELINE_STAGE_ORDER[a.stage] - PIPELINE_STAGE_ORDER[b.stage] || b.updated_at.localeCompare(a.updated_at))
  }, [db.content_items, query])

  const summary = [t("in_progress", { count: formatNumber(inProgress.length) }), overdue ? t("overdue", { count: overdue }) : ""]
    .filter(Boolean)
    .join(" · ")

  function search(value: string) {
    setQuery(value)
    setQueryParam(value.trim())
  }

  return (
    <PageContainer>
      <PageHeader
        title="Content Studio"
        info={t("info")}
        description={<span className="num">{summary}</span>}
        actions={<SearchInput value={query} onChange={search} placeholder={t("search_placeholder")} aria-label={t("search_label")} />}
      />

      {query.trim() ? (
        <SectionCard title={t("results_for", { query: query.trim() })} count={results.length}>
          {results.length ? (
            <ul className="flex flex-col">
              {results.map((item) => (
                <li key={item.id}>
                  <ContentRow item={item} script={scripts.get(item.id)} now={now} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={SearchX}
              title={t("no_results_title")}
              description={t("no_results_description")}
              action={
                <Button type="button" size="sm" variant="outline" onClick={() => search("")}>
                  {t("clear_search")}
                </Button>
              }
            />
          )}
        </SectionCard>
      ) : (
        <>
          <PageSection title={t("start_new")} info={t("start_new_info")}>
            <QuickStartGrid
              onStart={(format) => setDialog((current) => ({ format, open: true, key: (current?.key ?? 0) + 1 }))}
              onScratch={newContent}
            />
          </PageSection>
          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
            <ContinueCreating items={inProgress} scripts={scripts} now={now} onNewContent={newContent} className="lg:col-span-2" />
            <IdeaStarts ideas={ideas} />
          </div>
          <RecentlyPublished entries={published} />
        </>
      )}

      {dialog ? (
        <QuickStartDialog
          key={dialog.key}
          format={dialog.format}
          open={dialog.open}
          onOpenChange={(open) => setDialog((current) => (current ? { ...current, open } : current))}
        />
      ) : null}
    </PageContainer>
  )
}
