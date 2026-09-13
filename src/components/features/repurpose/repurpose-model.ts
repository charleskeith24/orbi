/**
 * Pure helpers for the Repurposing Engine: per-type tile state, the source text sent to the
 * `repurpose` task (script → brief → hook → title), draft ↔ section mapping and recommendations.
 */
import { REPURPOSE_TYPE_IDS, REPURPOSE_TYPES, SCRIPT_FORMATS } from "@/lib/constants"
import type {
  ContentItem,
  ContentRepurpose,
  ContentScript,
  Database,
  ID,
  PlatformId,
  RepurposeType,
  ScriptFormat,
  ScriptSection,
} from "@/lib/types"

/** Suggestions still waiting for a decision (no content item yet). */
export function isPendingSuggestion(row: Pick<ContentRepurpose, "target_item_id" | "status">): boolean {
  return !row.target_item_id && (row.status === "suggested" || row.status === "drafted")
}

const newestFirst = (a: { updated_at: string; id: string }, b: { updated_at: string; id: string }) =>
  b.updated_at.localeCompare(a.updated_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function targetPlatform(type: RepurposeType, source: Pick<ContentItem, "platform">): PlatformId {
  return REPURPOSE_TYPES[type].platform ?? source.platform
}

export interface TileState {
  type: RepurposeType
  /** Where the asset would be posted: the type's platform, else the source's. */
  platform: PlatformId
  /** The type targets the platform the source already lives on. */
  samePlatform: boolean
  /** Content items already created from the source for this type, newest first. */
  created: ContentItem[]
  /** Open suggestion (suggested / drafted, no item yet), newest first. */
  suggestion: ContentRepurpose | null
}

export function repurposeTileStates(
  db: Pick<Database, "content_items" | "content_repurposing">,
  source: ContentItem
): Record<RepurposeType, TileState> {
  const items = new Map(db.content_items.map((i) => [i.id, i]))
  const rows = db.content_repurposing.filter((r) => r.source_item_id === source.id)
  const children = db.content_items.filter((i) => i.parent_id === source.id && i.repurpose_type)
  const out = {} as Record<RepurposeType, TileState>
  for (const type of REPURPOSE_TYPE_IDS) {
    const created = new Map<ID, ContentItem>()
    for (const r of rows) {
      const target = r.type === type && r.target_item_id ? items.get(r.target_item_id) : undefined
      if (target) created.set(target.id, target)
    }
    for (const child of children) if (child.repurpose_type === type) created.set(child.id, child)
    const spec = REPURPOSE_TYPES[type]
    out[type] = {
      type,
      platform: spec.platform ?? source.platform,
      samePlatform: spec.platform === source.platform,
      created: [...created.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      suggestion: rows.filter((r) => r.type === type && isPendingSuggestion(r)).sort(newestFirst)[0] ?? null,
    }
  }
  return out
}

/**
 * The row "Save as suggestion" should reuse for (source, type): an open suggestion first, then a
 * dismissed one — so saving again never piles up duplicate rows without an item.
 */
export function reusableSuggestionRow(
  db: Pick<Database, "content_repurposing">,
  sourceId: ID,
  type: RepurposeType
): ContentRepurpose | null {
  const rows = db.content_repurposing
    .filter((r) => r.source_item_id === sourceId && r.type === type && !r.target_item_id)
    .sort(newestFirst)
  return rows.find(isPendingSuggestion) ?? rows[0] ?? null
}

/* ------------------------------- Source text ------------------------------ */

export type SourceOrigin = "script" | "brief" | "hook" | "title"

export interface SourceText {
  text: string
  origin: SourceOrigin
  script: ContentScript | null
  words: number
}

export function currentScriptOf(db: Pick<Database, "content_scripts">, itemId: ID): ContentScript | null {
  return db.content_scripts.filter((s) => s.content_item_id === itemId && s.is_current).sort(newestFirst)[0] ?? null
}

/** Postable copy of a section list (labels omitted), the same shape the domain layer stores. */
export function sectionsText(sections: readonly ScriptSection[]): string {
  return sections
    .map((s) => s.content.trim())
    .filter(Boolean)
    .join("\n\n")
}

export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * What the Repurposing Engine works from: the current script, else the brief (main message,
 * supporting points, caption — idea description / talking points when the brief is empty), else
 * the hook, else the title. The hook leads so the engine reads the first paragraph as the hook.
 */
export function sourceTextFor(
  db: Pick<Database, "content_scripts" | "content_briefs" | "content_ideas">,
  item: ContentItem
): SourceText {
  const script = currentScriptOf(db, item.id)
  const scriptText = script ? script.body.trim() || sectionsText(script.sections) : ""
  if (scriptText) return { text: scriptText, origin: "script", script, words: countWords(scriptText) }

  const brief = db.content_briefs.find((b) => b.content_item_id === item.id)
  const idea = item.idea_id ? db.content_ideas.find((i) => i.id === item.idea_id) : undefined
  const points = brief?.supporting_points.length ? brief.supporting_points : (idea?.talking_points ?? [])
  const briefParts = [brief?.main_message || idea?.description || "", ...points, brief?.caption ?? ""]
    .map((s) => s.trim())
    .filter(Boolean)
  const hook = item.hook.trim()
  if (briefParts.length) {
    const text = [hook || item.title.trim(), ...briefParts].filter(Boolean).join("\n\n")
    return { text, origin: "brief", script: null, words: countWords(text) }
  }
  if (hook) return { text: hook, origin: "hook", script: null, words: countWords(hook) }
  const title = item.title.trim()
  return { text: title, origin: "title", script: null, words: countWords(title) }
}

/* ---------------------------- Drafts ↔ sections --------------------------- */

const normalizeLabel = (value: string) =>
  value
    .trim()
    .replace(/[:：]\s*$/, "")
    .toLowerCase()

/**
 * Spread a saved plain-text draft over a script format's sections. Lines that are exactly a
 * section label ("Hook", "CTA:") start that section; otherwise paragraphs fill the sections in
 * order — the first and last sections take one paragraph each, the middle ones share the rest.
 */
export function draftToSections(draft: string, format: ScriptFormat): ScriptSection[] {
  const spec = (SCRIPT_FORMATS[format] ?? SCRIPT_FORMATS.custom).sections
  const empty = spec.map((s) => ({ key: s.key, label: s.label, content: "" }))
  const text = draft.replace(/\r\n/g, "\n").trim()
  if (!text) return empty

  const labelIndex = new Map(spec.map((s, i) => [normalizeLabel(s.label), i]))
  const lines = text.split("\n")
  const labelled = lines.filter((l) => labelIndex.has(normalizeLabel(l))).length
  if (labelled >= Math.min(2, spec.length)) {
    const buckets: string[][] = spec.map(() => [])
    let current = 0
    for (const line of lines) {
      const index = labelIndex.get(normalizeLabel(line))
      if (index !== undefined) current = index
      else buckets[current].push(line)
    }
    return empty.map((s, i) => ({ ...s, content: buckets[i].join("\n").trim() }))
  }

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const n = spec.length
  if (n === 1) return [{ ...empty[0], content: paragraphs.join("\n\n") }]
  if (paragraphs.length <= n) return empty.map((s, i) => ({ ...s, content: paragraphs[i] ?? "" }))

  const chunks: string[][] = [[paragraphs[0]]]
  const middle = paragraphs.slice(1, -1)
  const middleSlots = n - 2
  if (middleSlots === 0) chunks[0].push(...middle)
  let cursor = 0
  for (let i = 0; i < middleSlots; i++) {
    const size = Math.floor(middle.length / middleSlots) + (i < middle.length % middleSlots ? 1 : 0)
    chunks.push(middle.slice(cursor, cursor + size))
    cursor += size
  }
  chunks.push([paragraphs[paragraphs.length - 1]])
  return empty.map((s, i) => ({ ...s, content: (chunks[i] ?? []).join("\n\n") }))
}

/* ----------------------------- Recommendations ---------------------------- */

/**
 * Up to `limit` open types worth making next: a follow-up for winners, then one platform-native
 * asset per active platform the source isn't on yet. Created, suggested and same-platform types
 * are never recommended.
 */
export function recommendedTypes(
  states: Record<RepurposeType, TileState>,
  options: { activePlatforms: PlatformId[]; winner: boolean; limit?: number }
): RepurposeType[] {
  const limit = options.limit ?? 3
  const open = REPURPOSE_TYPE_IDS.filter((t) => !states[t].created.length && !states[t].suggestion && !states[t].samePlatform)
  const out: RepurposeType[] = []
  if (options.winner && open.includes("follow_up")) out.push("follow_up")
  const used = new Set<PlatformId>()
  for (const type of open) {
    if (out.length >= limit) break
    const platform = REPURPOSE_TYPES[type].platform
    if (!platform || used.has(platform) || !options.activePlatforms.includes(platform)) continue
    out.push(type)
    used.add(platform)
  }
  return out
}
