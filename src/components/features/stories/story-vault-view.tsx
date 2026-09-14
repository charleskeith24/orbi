"use client"

import { BookOpen, Plus, SearchX, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useLookup, useTable } from "@/lib/store"
import type { ID } from "@/lib/types"
import { formatNumber, pluralize } from "@/lib/utils"
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
          description="Your content memory — the real stories, lessons and beliefs that make every draft sound like you."
          actions={
            <>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/stories/experience">
                  <Sparkles className="text-brand" aria-hidden />
                  Experience → Content
                </Link>
              </Button>
              <Button type="button" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                New story
              </Button>
            </>
          }
        />

        {url.open && !openStory ? (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1">The story in this link no longer exists — it may have been deleted.</span>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={() => update({ open: "" })}>
              <X aria-hidden />
            </Button>
          </div>
        ) : null}

        {stories.length ? (
          <section aria-label="Stories" className="flex min-w-0 flex-col gap-3">
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
                  title="No stories match"
                  description="Try a different search or fewer filters."
                  action={
                    <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
                      Reset filters
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
            title="Your Story Vault is empty"
            description="Real stories are what make AI drafts sound like you. Capture the moments, failures and lessons only you can tell."
            action={
              <Button type="button" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                New story
              </Button>
            }
            secondaryAction={
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href="/stories/experience">
                  <Sparkles aria-hidden />
                  Turn an experience into content
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

/** "18 stories · 18 lessons · used in 12 ideas and 6 pieces of content · 5 not used yet". */
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
  return (
    <p className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
      <span className="num">
        {filtered ? `${formatNumber(visible)} of ${pluralize(stats.stories, "story", "stories")}` : pluralize(stats.stories, "story", "stories")}
      </span>
      <span aria-hidden>·</span>
      <span className="num">{pluralize(stats.lessons, "lesson")}</span>
      <span aria-hidden>·</span>
      <span className="num">
        used in {pluralize(stats.ideas, "idea")}
        {stats.items ? ` and ${pluralize(stats.items, "piece")} of content` : ""}
      </span>
      {stats.unused ? (
        <>
          <span aria-hidden>·</span>
          {onShowUnused ? (
            <Button type="button" variant="link" size="xs" className="h-auto px-0 text-xs num" onClick={onShowUnused}>
              {formatNumber(stats.unused)} not used yet
            </Button>
          ) : (
            <span className="num">{formatNumber(stats.unused)} not used yet</span>
          )}
        </>
      ) : null}
    </p>
  )
}
