"use client"

import { BookOpen, Plus, SearchX, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useLookup, useTable } from "@/lib/store"
import type { ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { storyVaultMessages } from "./messages"
import { StoryActionsProvider } from "./story-actions"
import { StoryCard } from "./story-card"
import { StoryCreateDialog } from "./story-create-dialog"
import { StoryDetailSheet } from "./story-detail-sheet"
import { StoryFilterBar } from "./story-filter-bar"
import {
  buildUsageIndex,
  filterStories,
  hasStoryFilters,
  parseStoryFilters,
  parseStorySort,
  parseStoryView,
  sortStories,
  STORY_URL_KEYS,
  vaultStats,
  type StorySheetTab,
  type StoryUrlState,
  type VaultStats,
} from "./story-model"
import { StoryTable } from "./story-table"
import { useUrlState } from "./use-url-state"

const CLEAR_FILTERS: Partial<StoryUrlState> = { q: "", type: "", pillar: "", fav: "", usage: "" }

/**
 * Story Vault (spec §30): the content memory. Grid or list with type / pillar / usage / favourite
 * filters; the detail sheet edits every STAR field and turns the story into content angles.
 * URL: `?q=`, `?type=`, `?pillar=`, `?usage=`, `?fav=1`, `?view=list`, `?sort=`, `?open=<storyId>`.
 */
export function StoryVaultView() {
  const [url, update] = useUrlState(STORY_URL_KEYS)
  const stories = useTable("stories")
  const ideas = useTable("content_ideas")
  const items = useTable("content_items")
  const pillars = useLookup("content_pillars")
  const [creating, setCreating] = useState(false)
  const t = useT(storyVaultMessages)
  // The sheet tab belongs to the story it was chosen for; any other story opens on "Story".
  const [tabState, setTabState] = useState<{ id: ID | null; tab: StorySheetTab }>({ id: null, tab: "story" })

  const usage = useMemo(() => buildUsageIndex(ideas, items), [ideas, items])
  const pillarIds = useMemo(() => new Set(pillars.keys()), [pillars])
  const filters = useMemo(() => parseStoryFilters(url, pillarIds), [url, pillarIds])
  const sort = parseStorySort(url.sort)
  const view = parseStoryView(url.view) ?? "grid"
  const visible = useMemo(() => sortStories(filterStories(stories, filters, usage), sort, usage), [stories, filters, sort, usage])
  const stats = useMemo(() => vaultStats(stories, usage), [stories, usage])
  const filtered = hasStoryFilters(filters)

  const storyById = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories])
  const openStory = url.open ? storyById.get(url.open) : undefined
  // Keep the last story mounted while the sheet animates out.
  const [shownId, setShownId] = useState<ID | null>(openStory ? openStory.id : null)
  if (openStory && openStory.id !== shownId) setShownId(openStory.id)
  const shown = shownId ? (storyById.get(shownId) ?? null) : null
  const tab: StorySheetTab = tabState.id === shownId ? tabState.tab : "story"

  const open = useCallback(
    (id: ID | null, next: StorySheetTab = "story") => {
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
  const unusedOnly = filters.usage.length === 1 && filters.usage[0] === "unused"

  return (
    <StoryActionsProvider onOpen={open} onRemoved={onRemoved}>
      <PageContainer>
        <PageHeader
          title="Story Vault"
          info={t("info")}
          actions={
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {t("new_story")}
            </Button>
          }
        />

        {url.open && !openStory ? (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1">{t("missing_link")}</span>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={t("dismiss")} onClick={() => update({ open: "" })}>
              <X aria-hidden />
            </Button>
          </div>
        ) : null}

        {stories.length ? (
          <section aria-label={t("stories_label")} className="flex min-w-0 flex-col gap-3">
            <StoryFilterBar
              stories={stories}
              usage={usage}
              pillars={pillars}
              filters={filters}
              sort={sort}
              view={view}
              onChange={update}
              onReset={resetFilters}
            />
            <StatsLine
              stats={stats}
              visible={visible.length}
              filtered={filtered}
              onShowUnused={unusedOnly ? undefined : () => update({ usage: "unused" })}
            />
            {!visible.length ? (
              <div className="rounded-lg border bg-card">
                <EmptyState
                  compact
                  icon={SearchX}
                  title={t("no_match_title")}
                  description={t("no_match_description")}
                  action={
                    <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
                      {t("reset_filters")}
                    </Button>
                  }
                />
              </div>
            ) : view === "grid" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    usage={usage.get(story.id)}
                    pillar={story.pillar_id ? pillars.get(story.pillar_id) : undefined}
                  />
                ))}
              </div>
            ) : (
              <StoryTable stories={visible} usage={usage} pillars={pillars} />
            )}
          </section>
        ) : (
          <EmptyState
            icon={BookOpen}
            title={t("empty_title")}
            description={t("empty_description")}
            action={
              <Button type="button" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {t("new_story")}
              </Button>
            }
            secondaryAction={
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href="/stories/experience">
                  <Sparkles aria-hidden />
                  {t("empty_experience")}
                </Link>
              </Button>
            }
          />
        )}
      </PageContainer>

      <StoryDetailSheet
        story={shown}
        open={Boolean(openStory)}
        tab={tab}
        usage={shown ? usage.get(shown.id) : undefined}
        onTabChange={(next) => setTabState({ id: shownId, tab: next })}
        onOpenChange={(next) => {
          if (!next) update({ open: "" })
        }}
      />
      <StoryCreateDialog open={creating} onOpenChange={setCreating} onCreated={(story) => open(story.id)} />
    </StoryActionsProvider>
  )
}

/** "18 stories · used in 12 ideas · 6 posts · 5 not used yet" (the last one filters to them). */
function StatsLine({
  stats,
  visible,
  filtered,
  onShowUnused,
}: {
  stats: VaultStats
  visible: number
  filtered: boolean
  onShowUnused?: () => void
}) {
  const t = useT(storyVaultMessages)
  const n = (key: "stories" | "ideas" | "pieces", count: number) => t.plural(key, count, { count: formatNumber(count) })
  const unusedText = t("not_used_count", { count: formatNumber(stats.unused) })
  return (
    <p className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
      <span className="num">
        {filtered ? t("shown_of", { visible: formatNumber(visible), stories: n("stories", stats.stories) }) : n("stories", stats.stories)}
      </span>
      <span aria-hidden>·</span>
      <span className="num">
        {stats.items
          ? t("used_in_content", { ideas: n("ideas", stats.ideas), pieces: n("pieces", stats.items) })
          : t("used_in", { ideas: n("ideas", stats.ideas) })}
      </span>
      {stats.unused ? (
        <>
          <span aria-hidden>·</span>
          {onShowUnused ? (
            <Button type="button" variant="link" size="xs" className="h-auto px-0 text-xs num" onClick={onShowUnused}>
              {unusedText}
            </Button>
          ) : (
            <span className="num">{unusedText}</span>
          )}
        </>
      ) : null}
    </p>
  )
}
