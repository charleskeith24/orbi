import { STORY_TYPE_MAP, STORY_TYPES } from "@/lib/constants"
import { parseDate, toISODate } from "@/lib/dates"
import type { ContentIdea, ContentItem, ID, InsertRow, Story, StoryType } from "@/lib/types"
import { matchesQuery, truncate } from "@/lib/utils"
import { parseList, type UrlState } from "./use-url-state"

export const STORY_URL_KEYS = ["q", "type", "pillar", "fav", "usage", "view", "sort", "open"] as const
export type StoryUrlKey = (typeof STORY_URL_KEYS)[number]
export type StoryUrlState = UrlState<StoryUrlKey>

export type StoryView = "grid" | "list"
export type StorySort = "recent" | "favorites" | "used" | "title"
export type StoryUsageFilter = "used" | "unused"
export type StorySheetTab = "story" | "angles" | "usage"

export const STORY_SORTS: { value: StorySort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "favorites", label: "Favourites first" },
  { value: "used", label: "Most used" },
  { value: "title", label: "Title A–Z" },
]

/** Facet value for stories without a pillar. */
export const NO_PILLAR = "none"
/** `experience_to_content` needs at least this much text. */
export const MIN_EXPERIENCE_CHARS = 20

export interface StoryFilters {
  q: string
  types: StoryType[]
  pillars: string[]
  favorites: boolean
  usage: StoryUsageFilter[]
}

const TYPE_IDS = new Set<string>(STORY_TYPES.map((t) => t.id))

export function parseStoryFilters(url: StoryUrlState, pillarIds: ReadonlySet<ID>): StoryFilters {
  return {
    q: url.q,
    types: parseList(url.type).filter((t): t is StoryType => TYPE_IDS.has(t)),
    pillars: parseList(url.pillar).filter((p) => p === NO_PILLAR || pillarIds.has(p)),
    favorites: url.fav === "1",
    usage: parseList(url.usage).filter((u): u is StoryUsageFilter => u === "used" || u === "unused"),
  }
}

export function hasStoryFilters(filters: StoryFilters): boolean {
  return Boolean(filters.q.trim() || filters.types.length || filters.pillars.length || filters.favorites || filters.usage.length)
}

export function parseStoryView(value: string): StoryView | null {
  return value === "grid" || value === "list" ? value : null
}

export function parseStorySort(value: string): StorySort {
  return STORY_SORTS.find((s) => s.value === value)?.value ?? "recent"
}

export function storyTypeLabel(type: StoryType): string {
  return STORY_TYPE_MAP[type]?.label ?? "Story"
}

/* ---------------------------------- Usage --------------------------------- */

/** Ideas that name a row as their source (`source_ref_id`) and the content made from those ideas. */
export interface SourceUsage {
  ideas: ContentIdea[]
  items: ContentItem[]
}

/** Source row id (story, research item…) → the ideas citing it and their content items. */
export function buildUsageIndex(ideas: readonly ContentIdea[], items: readonly ContentItem[]): Map<ID, SourceUsage> {
  const itemsByIdea = new Map<ID, ContentItem[]>()
  for (const item of items) {
    if (!item.idea_id) continue
    const list = itemsByIdea.get(item.idea_id)
    if (list) list.push(item)
    else itemsByIdea.set(item.idea_id, [item])
  }
  const index = new Map<ID, SourceUsage>()
  for (const idea of ideas) {
    if (!idea.source_ref_id) continue
    let entry = index.get(idea.source_ref_id)
    if (!entry) {
      entry = { ideas: [], items: [] }
      index.set(idea.source_ref_id, entry)
    }
    entry.ideas.push(idea)
    const made = itemsByIdea.get(idea.id)
    if (made) entry.items.push(...made)
  }
  return index
}

export function usageCount(index: ReadonlyMap<ID, SourceUsage>, id: ID): number {
  return index.get(id)?.ideas.length ?? 0
}

/* ------------------------------ Filter & sort ----------------------------- */

/** When it happened — falls back to when it was captured. */
export function storyDay(story: Pick<Story, "occurred_on" | "created_at">): string {
  if (story.occurred_on) return story.occurred_on
  const created = parseDate(story.created_at)
  return created ? toISODate(created) : ""
}

export function filterStories(stories: readonly Story[], filters: StoryFilters, usage: ReadonlyMap<ID, SourceUsage>): Story[] {
  const types = new Set<string>(filters.types)
  const pillars = new Set(filters.pillars)
  const usageFilter = new Set(filters.usage)
  // Both usage options selected is the same as no usage filter.
  const checkUsage = usageFilter.size === 1
  return stories.filter((story) => {
    if (types.size && !types.has(story.type)) return false
    if (pillars.size && !pillars.has(story.pillar_id ?? NO_PILLAR)) return false
    if (filters.favorites && !story.is_favorite) return false
    if (checkUsage && usageFilter.has("used") !== usageCount(usage, story.id) > 0) return false
    return matchesQuery(
      filters.q,
      story.title,
      story.situation,
      story.problem,
      story.action,
      story.result,
      story.lesson,
      story.emotion,
      story.keywords,
      storyTypeLabel(story.type)
    )
  })
}

export function sortStories(stories: readonly Story[], sort: StorySort, usage: ReadonlyMap<ID, SourceUsage>): Story[] {
  const recent = (a: Story, b: Story) => storyDay(b).localeCompare(storyDay(a)) || b.created_at.localeCompare(a.created_at)
  const list = [...stories]
  if (sort === "favorites") return list.sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || recent(a, b))
  if (sort === "used") return list.sort((a, b) => usageCount(usage, b.id) - usageCount(usage, a.id) || recent(a, b))
  if (sort === "title") return list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
  return list.sort(recent)
}

/* ---------------------------------- Stats --------------------------------- */

export interface VaultStats {
  stories: number
  /** Stories with a written lesson — the reusable part of every story. */
  lessons: number
  favorites: number
  /** Ideas citing any story. */
  ideas: number
  /** Content items made from those ideas. */
  items: number
  unused: number
}

export function vaultStats(stories: readonly Story[], usage: ReadonlyMap<ID, SourceUsage>): VaultStats {
  const stats: VaultStats = { stories: stories.length, lessons: 0, favorites: 0, ideas: 0, items: 0, unused: 0 }
  for (const story of stories) {
    if (story.lesson.trim()) stats.lessons++
    if (story.is_favorite) stats.favorites++
    const used = usage.get(story.id)
    if (used?.ideas.length) {
      stats.ideas += used.ideas.length
      stats.items += used.items.length
    } else {
      stats.unused++
    }
  }
  return stats
}

/* --------------------------------- Helpers -------------------------------- */

const SENTENCE_END = /[.!?…"”'’)\]]$/

function asSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return ""
  return SENTENCE_END.test(clean) ? clean : `${clean}.`
}

export function upperFirst(text: string): string {
  const clean = text.trim()
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : ""
}

/** The story as first-person prose (STAR order) — the `experience` input of experience_to_content. */
export function storyExperienceText(story: Pick<Story, "title" | "situation" | "problem" | "action" | "result" | "lesson" | "emotion">): string {
  const parts = [story.situation, story.problem, story.action, story.result].map(asSentence).filter(Boolean)
  const lesson = asSentence(story.lesson)
  if (lesson) parts.push(`The lesson: ${lesson}`)
  const emotion = asSentence(story.emotion)
  if (emotion) parts.push(`How it felt: ${emotion}`)
  if (parts.length < 2) parts.unshift(asSentence(story.title))
  return parts.filter(Boolean).join(" ").slice(0, 8000)
}

export function storyReadyForAi(story: Pick<Story, "title" | "situation" | "problem" | "action" | "result" | "lesson" | "emotion">): boolean {
  return storyExperienceText(story).length >= MIN_EXPERIENCE_CHARS
}

/** Talking points for an idea written by hand from a story. */
export function storyTalkingPoints(story: Pick<Story, "situation" | "action" | "result">): string[] {
  return [
    story.situation.trim() ? `The situation: ${truncate(story.situation.trim(), 220)}` : "",
    story.action.trim() ? `What I did: ${truncate(story.action.trim(), 220)}` : "",
    story.result.trim() ? `What happened: ${truncate(story.result.trim(), 220)}` : "",
  ].filter(Boolean)
}

export function storyCopyValues(story: Story): InsertRow<"stories"> {
  return {
    type: story.type,
    title: `${story.title.trim() || "Untitled story"} (copy)`,
    situation: story.situation,
    problem: story.problem,
    action: story.action,
    result: story.result,
    lesson: story.lesson,
    emotion: story.emotion,
    pillar_id: story.pillar_id,
    keywords: [...story.keywords],
    occurred_on: story.occurred_on,
    is_favorite: false,
  }
}
