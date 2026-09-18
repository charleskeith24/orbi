/**
 * Idea Bank model: URL state (view, sort, status, facets, search, open sheet), filtering,
 * sorting and facet counts. Pure — no React, no store access.
 */
import { FUNNEL_STAGE_IDS, IDEA_SOURCES, IDEA_STATUSES, PLATFORM_IDS, PRIORITIES } from "@/lib/constants"
import type { ContentIdea, ContentTag, ID, IdeaStatus, InsertRow, Priority, Tag } from "@/lib/types"
import { translate, type UiLang } from "@/lib/i18n/core"
import { matchesQuery } from "@/lib/utils"
import { ideaDetailMessages } from "./idea-detail-messages"

export type IdeaView = "table" | "cards" | "kanban"
export type IdeaSort = "score" | "created" | "priority"

export const IDEA_VIEWS: IdeaView[] = ["table", "cards", "kanban"]
/** Sort options in menu order (labels: `sort_<id>` in `ideaBankMessages`). */
export const IDEA_SORTS: IdeaSort[] = ["score", "created", "priority"]
export const DEFAULT_SORT: IdeaSort = "score"

export const ALL_STATUSES: IdeaStatus[] = IDEA_STATUSES.map((s) => s.id)
/** The default "Active" filter: everything still in play (hides converted + archived). */
export const ACTIVE_STATUSES: IdeaStatus[] = ["inbox", "researching", "validated", "selected"]

/** Facet value meaning "field is empty" (no pillar, no persona…). */
export const NONE = "none"

export type FacetKey = "pillar" | "platform" | "persona" | "format" | "goal" | "priority" | "source"
export const FACET_KEYS: FacetKey[] = ["pillar", "platform", "persona", "format", "goal", "priority", "source"]
/** Facets whose values are workspace row ids (sanitised against the rows that exist). */
export const ENTITY_FACETS = ["pillar", "persona", "format", "goal"] as const satisfies readonly FacetKey[]
export type EntityFacet = (typeof ENTITY_FACETS)[number]

export type FacetState = Record<FacetKey, string[]>

export interface IdeaBankState {
  q: string
  /** `null` = the device default (table on desktop, cards on phones). */
  view: IdeaView | null
  sort: IdeaSort
  /** Statuses shown, in canonical order. */
  status: IdeaStatus[]
  facets: FacetState
  /** Idea whose detail sheet is open. */
  open: ID | null
}

export const EMPTY_FACETS: FacetState = {
  pillar: [],
  platform: [],
  persona: [],
  format: [],
  goal: [],
  priority: [],
  source: [],
}

/** Every query key this page owns; anything else in the URL is left untouched. */
const MANAGED_KEYS = ["q", "view", "sort", "status", ...FACET_KEYS, "open"]

type ReadableParams = Pick<URLSearchParams, "get" | "getAll">

const ENUM_VALUES: Partial<Record<FacetKey, Set<string>>> = {
  platform: new Set<string>([...PLATFORM_IDS, NONE]),
  priority: new Set<string>(PRIORITIES.map((p) => p.id)),
  source: new Set<string>(IDEA_SOURCES.map((s) => s.id)),
}

export function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((v) => set.has(v))
}

function parseStatus(values: string[]): IdeaStatus[] {
  if (!values.length || values.includes("active")) return ACTIVE_STATUSES
  if (values.includes("all")) return ALL_STATUSES
  const set = new Set(values)
  const picked = ALL_STATUSES.filter((s) => set.has(s))
  return picked.length ? picked : ACTIVE_STATUSES
}

export function parseIdeaBankState(params: ReadableParams): IdeaBankState {
  const view = params.get("view")
  const sort = params.get("sort")
  const facets = { ...EMPTY_FACETS }
  for (const key of FACET_KEYS) {
    const allowed = ENUM_VALUES[key]
    const values = [...new Set(params.getAll(key).map((v) => v.trim()).filter(Boolean))]
    facets[key] = allowed ? values.filter((v) => allowed.has(v)) : values
  }
  return {
    q: params.get("q") ?? "",
    view: IDEA_VIEWS.includes(view as IdeaView) ? (view as IdeaView) : null,
    sort: IDEA_SORTS.includes(sort as IdeaSort) ? (sort as IdeaSort) : DEFAULT_SORT,
    status: parseStatus(params.getAll("status")),
    facets,
    open: params.get("open") || null,
  }
}

/** Replaces this page's keys in `params` with `state` (defaults are omitted to keep URLs short). */
export function writeIdeaBankState(params: URLSearchParams, state: IdeaBankState): void {
  for (const key of MANAGED_KEYS) params.delete(key)
  const q = state.q.trim()
  if (q) params.set("q", q)
  if (state.view) params.set("view", state.view)
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort)
  if (!sameSet(state.status, ACTIVE_STATUSES)) {
    if (sameSet(state.status, ALL_STATUSES)) params.set("status", "all")
    else for (const status of state.status) params.append("status", status)
  }
  for (const key of FACET_KEYS) for (const value of state.facets[key]) params.append(key, value)
  if (state.open) params.set("open", state.open)
}

/** Canonical string of the keys this page owns — used to tell its own URL writes from navigations. */
export function managedKey(params: ReadableParams): string {
  return MANAGED_KEYS.map((key) => `${key}=${params.getAll(key).join("|")}`).join("&")
}

export function hasActiveFilters(state: IdeaBankState): boolean {
  return Boolean(state.q.trim()) || !sameSet(state.status, ACTIVE_STATUSES) || FACET_KEYS.some((k) => state.facets[k].length > 0)
}

export function isActiveStatusFilter(status: IdeaStatus[]): boolean {
  return sameSet(status, ACTIVE_STATUSES)
}

/** Drops entity ids that no longer exist so a stale link can't silently hide everything. */
export function sanitizeFacets(facets: FacetState, known: Record<EntityFacet, Set<ID>>): FacetState {
  const out = { ...facets }
  for (const key of ENTITY_FACETS) {
    const values = facets[key].filter((v) => v === NONE || known[key].has(v))
    if (values.length !== facets[key].length) out[key] = values
  }
  return out
}

/* -------------------------------- Filtering ------------------------------- */

/** idea id → searchable tag tokens ("#name"). */
export function buildTagIndex(tags: Tag[], links: ContentTag[]): Map<ID, string[]> {
  const names = new Map(tags.map((t) => [t.id, t.name]))
  const out = new Map<ID, string[]>()
  for (const link of links) {
    if (link.entity_type !== "content_ideas") continue
    const name = names.get(link.tag_id)
    if (!name) continue
    const list = out.get(link.entity_id)
    if (list) list.push(`#${name}`)
    else out.set(link.entity_id, [`#${name}`])
  }
  return out
}

export function ideaMatchesSearch(idea: ContentIdea, q: string, tagIndex?: Map<ID, string[]>): boolean {
  return matchesQuery(
    q,
    idea.title,
    idea.core_topic,
    idea.description,
    idea.hook,
    idea.talking_points,
    idea.why_it_matters,
    idea.cta,
    idea.inspiration,
    tagIndex?.get(idea.id) ?? []
  )
}

export function facetValues(idea: ContentIdea, key: FacetKey): string[] {
  switch (key) {
    case "pillar":
      return [idea.pillar_id ?? NONE]
    case "persona":
      return [idea.persona_id ?? NONE]
    case "format":
      return [idea.format_id ?? NONE]
    case "goal":
      return [idea.goal_id ?? NONE]
    case "platform":
      return idea.platforms.length ? idea.platforms : [NONE]
    case "priority":
      return [idea.priority]
    case "source":
      return [idea.source]
  }
}

function matchesFacets(idea: ContentIdea, facets: FacetState, ignore?: FacetKey): boolean {
  for (const key of FACET_KEYS) {
    if (key === ignore) continue
    const selected = facets[key]
    if (selected.length && !facetValues(idea, key).some((v) => selected.includes(v))) return false
  }
  return true
}

interface FilterOptions {
  tagIndex?: Map<ID, string[]>
  /** Skip one facet (for that facet's own option counts) or the status filter. */
  ignore?: FacetKey | "status"
}

export function filterIdeas(
  ideas: ContentIdea[],
  state: Pick<IdeaBankState, "q" | "status" | "facets">,
  { tagIndex, ignore }: FilterOptions = {}
): ContentIdea[] {
  const statuses = new Set(state.status)
  const facetIgnore = ignore === "status" ? undefined : ignore
  return ideas.filter(
    (idea) =>
      (ignore === "status" || statuses.has(idea.status)) &&
      matchesFacets(idea, state.facets, facetIgnore) &&
      ideaMatchesSearch(idea, state.q, tagIndex)
  )
}

/** Option counts for one facet: every other filter applies, this facet doesn't. */
export function facetCounts(
  ideas: ContentIdea[],
  state: Pick<IdeaBankState, "q" | "status" | "facets">,
  key: FacetKey,
  tagIndex?: Map<ID, string[]>
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const idea of filterIdeas(ideas, state, { tagIndex, ignore: key })) {
    for (const value of facetValues(idea, key)) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

export function countByStatus(ideas: ContentIdea[]): Record<IdeaStatus, number> {
  const out = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<IdeaStatus, number>
  for (const idea of ideas) out[idea.status] = (out[idea.status] ?? 0) + 1
  return out
}

/* --------------------------------- Sorting -------------------------------- */

export const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 }
export const STATUS_RANK: Record<IdeaStatus, number> = Object.fromEntries(ALL_STATUSES.map((s, i) => [s, i])) as Record<IdeaStatus, number>
export const FUNNEL_RANK: Record<string, number> = Object.fromEntries(FUNNEL_STAGE_IDS.map((f, i) => [f, i]))

const byScore = (a: ContentIdea, b: ContentIdea) => (b.score ?? -1) - (a.score ?? -1)
const byPriority = (a: ContentIdea, b: ContentIdea) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0)
const byNewest = (a: ContentIdea, b: ContentIdea) => b.created_at.localeCompare(a.created_at)

export function compareIdeas(sort: IdeaSort): (a: ContentIdea, b: ContentIdea) => number {
  if (sort === "created") return (a, b) => byNewest(a, b) || a.title.localeCompare(b.title)
  if (sort === "priority") return (a, b) => byPriority(a, b) || byScore(a, b) || byNewest(a, b)
  return (a, b) => byScore(a, b) || byPriority(a, b) || byNewest(a, b)
}

export function sortIdeas(ideas: ContentIdea[], sort: IdeaSort): ContentIdea[] {
  return [...ideas].sort(compareIdeas(sort))
}

/* --------------------------------- Helpers -------------------------------- */

const MIN_SENTENCE = 12

/** First sentence of captured text (≤ `max` chars, cut at a word) — the title of a captured idea. */
export function titleFromText(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return ""
  let sentence = clean
  for (const match of clean.matchAll(/[.!?](?=\s|$)/g)) {
    const end = (match.index ?? 0) + 1
    if (end >= MIN_SENTENCE) {
      sentence = clean.slice(0, end)
      break
    }
  }
  sentence = sentence.replace(/\.$/, "").trim()
  if (sentence.length <= max) return sentence
  const cut = sentence.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Where "Restore" sends an archived idea: back to Converted if it has content, else the Inbox. */
export function restoreStatus(idea: Pick<ContentIdea, "converted_item_id">): IdeaStatus {
  return idea.converted_item_id ? "converted" : "inbox"
}

/** Field-by-field copy for "Duplicate" (never copies the conversion link). */
export function duplicateIdeaValues(idea: ContentIdea, lang: UiLang = "en"): InsertRow<"content_ideas"> {
  return {
    title: idea.title
      ? translate(ideaDetailMessages, lang, "copy_title", { title: idea.title })
      : translate(ideaDetailMessages, lang, "copy_untitled"),
    core_topic: idea.core_topic,
    description: idea.description,
    hook: idea.hook,
    hook_category: idea.hook_category,
    angle_id: idea.angle_id,
    pillar_id: idea.pillar_id,
    persona_id: idea.persona_id,
    problem_id: idea.problem_id,
    goal_id: idea.goal_id,
    platforms: [...idea.platforms],
    format_id: idea.format_id,
    funnel_stage: idea.funnel_stage,
    inspiration: idea.inspiration,
    source: idea.source,
    source_ref_id: idea.source_ref_id,
    priority: idea.priority,
    status: idea.status === "converted" || idea.status === "archived" ? "inbox" : idea.status,
    scores: idea.scores ? { ...idea.scores } : null,
    score: idea.score,
    why_it_matters: idea.why_it_matters,
    talking_points: [...idea.talking_points],
    cta: idea.cta,
    campaign_id: idea.campaign_id,
    series_id: idea.series_id,
    converted_item_id: null,
  }
}

/** Topic for hook generation: "Core topic — title." then the description as context (≤ 1000 chars). */
export function hookTopicFor(idea: Pick<ContentIdea, "title" | "core_topic" | "description">): string {
  const title = idea.title.trim().replace(/[.!?]+$/, "")
  const topic = idea.core_topic.trim()
  const lead = topic && title && !title.toLowerCase().includes(topic.toLowerCase()) ? `${topic} — ${title}` : title || topic
  const description = idea.description.trim()
  return [lead ? `${lead}.` : "", description && description !== title ? description : ""].filter(Boolean).join(" ").slice(0, 1000)
}
