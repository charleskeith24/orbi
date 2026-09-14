import type { SourceUsage } from "@/components/features/stories/story-model"
import { parseList, type UrlState } from "@/components/features/stories/use-url-state"
import type { AiTaskInput } from "@/lib/ai"
import { PLATFORMS, RESEARCH_STATUS_MAP, RESEARCH_STATUSES, RESEARCH_TYPE_MAP, RESEARCH_TYPES } from "@/lib/constants"
import type { AiProviderId, HookCategory, ID, PlatformId, ReferenceAnalysis, ResearchItem, ResearchStatus, ResearchType } from "@/lib/types"
import { matchesQuery, truncate } from "@/lib/utils"

export const RESEARCH_URL_KEYS = ["q", "type", "status", "platform", "pillar", "view", "open"] as const
export type ResearchUrlKey = (typeof RESEARCH_URL_KEYS)[number]
export type ResearchUrlState = UrlState<ResearchUrlKey>
export type ResearchView = "table" | "cards"
export type ResearchSheetTab = "details" | "analysis" | "usage"

/** Facet value for references without a platform or pillar. */
export const NONE = "none"
/** analyze_reference needs at least this much pasted text. */
export const MIN_REFERENCE_CHARS = 20

/** The editable part of a ReferenceAnalysis (the date and engine are stamped on save). */
export type AnalysisFields = Omit<ReferenceAnalysis, "analyzed_at" | "provider">

export interface ResearchFilters {
  q: string
  types: ResearchType[]
  statuses: ResearchStatus[]
  platforms: string[]
  pillars: string[]
}

const TYPE_IDS = new Set<string>(RESEARCH_TYPES.map((t) => t.id))
const STATUS_IDS = new Set<string>(RESEARCH_STATUSES.map((s) => s.id))
const PLATFORM_KEYS = new Set<string>(Object.keys(PLATFORMS))

export function parseResearchFilters(url: ResearchUrlState, pillarIds: ReadonlySet<ID>): ResearchFilters {
  return {
    q: url.q,
    types: parseList(url.type).filter((t): t is ResearchType => TYPE_IDS.has(t)),
    statuses: parseList(url.status).filter((s): s is ResearchStatus => STATUS_IDS.has(s)),
    platforms: parseList(url.platform).filter((p) => p === NONE || PLATFORM_KEYS.has(p)),
    pillars: parseList(url.pillar).filter((p) => p === NONE || pillarIds.has(p)),
  }
}

export function hasResearchFilters(filters: ResearchFilters): boolean {
  return Boolean(filters.q.trim() || filters.types.length || filters.statuses.length || filters.platforms.length || filters.pillars.length)
}

export function parseResearchView(value: string): ResearchView | null {
  return value === "table" || value === "cards" ? value : null
}

export function researchTypeLabel(type: ResearchType): string {
  return RESEARCH_TYPE_MAP[type]?.label ?? "Reference"
}

export function researchStatusLabel(status: ResearchStatus): string {
  return RESEARCH_STATUS_MAP[status]?.label ?? status
}

/** Search + facets. Without a status filter, archived references stay out of the way. */
export function filterResearch(items: readonly ResearchItem[], filters: ResearchFilters): ResearchItem[] {
  const types = new Set<string>(filters.types)
  const statuses = new Set<string>(filters.statuses)
  const platforms = new Set(filters.platforms)
  const pillars = new Set(filters.pillars)
  return items.filter((item) => {
    if (statuses.size ? !statuses.has(item.status) : item.status === "archived") return false
    if (types.size && !types.has(item.type)) return false
    if (platforms.size && !platforms.has(item.platform ?? NONE)) return false
    if (pillars.size && !pillars.has(item.pillar_id ?? NONE)) return false
    return matchesQuery(
      filters.q,
      item.title,
      item.source,
      item.creator,
      item.topic,
      item.hook,
      item.why_attention,
      item.learnings,
      item.adaptation,
      item.content,
      researchTypeLabel(item.type)
    )
  })
}

export function sortResearch(items: readonly ResearchItem[]): ResearchItem[] {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export interface ResearchStats {
  /** Everything not archived. */
  references: number
  analyzed: number
  adapted: number
  archived: number
  /** Ideas citing a reference. */
  ideas: number
}

export function researchStats(items: readonly ResearchItem[], usage: ReadonlyMap<ID, SourceUsage>): ResearchStats {
  const stats: ResearchStats = { references: 0, analyzed: 0, adapted: 0, archived: 0, ideas: 0 }
  for (const item of items) {
    stats.ideas += usage.get(item.id)?.ideas.length ?? 0
    if (item.status === "archived") {
      stats.archived++
      continue
    }
    stats.references++
    if (item.analysis) stats.analyzed++
    if (item.status === "adapted") stats.adapted++
  }
  return stats
}

/* -------------------------------- Analysis -------------------------------- */

const cleanList = (list: readonly string[]) => list.map((s) => s.trim()).filter(Boolean)

export const EMPTY_ANALYSIS: AnalysisFields = { hook: "", structure: [], angle: "", psychology: "", why_it_works: "", patterns: [] }

export function analysisFields(analysis: AnalysisFields): AnalysisFields {
  return {
    hook: analysis.hook,
    structure: [...analysis.structure],
    angle: analysis.angle,
    psychology: analysis.psychology,
    why_it_works: analysis.why_it_works,
    patterns: [...analysis.patterns],
  }
}

export function toReferenceAnalysis(fields: AnalysisFields, provider: AiProviderId, analyzedAt: string): ReferenceAnalysis {
  return {
    hook: fields.hook.trim(),
    structure: cleanList(fields.structure),
    angle: fields.angle.trim(),
    psychology: fields.psychology.trim(),
    why_it_works: fields.why_it_works.trim(),
    patterns: cleanList(fields.patterns),
    analyzed_at: analyzedAt,
    provider,
  }
}

export function analysisIsEmpty(fields: AnalysisFields): boolean {
  return !(
    fields.hook.trim() ||
    fields.angle.trim() ||
    fields.psychology.trim() ||
    fields.why_it_works.trim() ||
    cleanList(fields.structure).length ||
    cleanList(fields.patterns).length
  )
}

/** An (edited) analysis clamped to adapt_reference's input limits. */
export function adaptAnalysisInput(fields: AnalysisFields): AiTaskInput<"adapt_reference">["analysis"] {
  return {
    hook: truncate(fields.hook.trim(), 500),
    structure: cleanList(fields.structure)
      .slice(0, 12)
      .map((beat) => truncate(beat, 300)),
    angle: truncate(fields.angle.trim(), 300),
    psychology: truncate(fields.psychology.trim(), 1500),
    why_it_works: truncate(fields.why_it_works.trim(), 1500),
    patterns: cleanList(fields.patterns)
      .slice(0, 12)
      .map((pattern) => truncate(pattern, 300)),
  }
}

/** Analyzing never downgrades an adapted reference (and brings an archived one back). */
export function statusAfterAnalysis(status: ResearchStatus): ResearchStatus {
  return status === "adapted" ? "adapted" : "analyzed"
}

/** A short description of a reference for adapt_reference — never its text. */
export function referenceSummary(ref: {
  title: string
  creator: string
  platform: PlatformId | null
  type?: ResearchType
  source?: string
  topic?: string
  why_attention?: string
}): string {
  const where = ref.platform ? `on ${PLATFORMS[ref.platform].label}` : ref.source?.trim() ? `from ${truncate(ref.source.trim(), 60)}` : ""
  const head = [
    ref.title.trim() ? `“${truncate(ref.title.trim(), 140)}”` : "A reference",
    ref.type ? `(${researchTypeLabel(ref.type).toLowerCase()})` : "",
    ref.creator.trim() ? `by ${truncate(ref.creator.trim(), 80)}` : "",
    where,
  ]
    .filter(Boolean)
    .join(" ")
  const extra = [
    ref.topic?.trim() ? `Topic: ${truncate(ref.topic.trim(), 120)}.` : "",
    ref.why_attention?.trim() ? `Why it caught attention: ${truncate(ref.why_attention.trim(), 300)}` : "",
  ]
    .filter(Boolean)
    .join(" ")
  return truncate([`${head}.`, extra].filter(Boolean).join(" "), 1900)
}

/** Hook style an adapted piece inherits from the reference's angle (null when unclear). */
export function hookCategoryForAngle(angle: string): HookCategory | null {
  const a = angle.toLowerCase()
  if (a.includes("list") || a.includes("checklist")) return "list"
  if (a.includes("contrarian")) return "contrarian"
  if (a.includes("story")) return "story"
  if (a.includes("question")) return "question"
  if (a.includes("case") || a.includes("number") || a.includes("result")) return "results"
  if (a.includes("mistake")) return "mistake"
  return null
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}
