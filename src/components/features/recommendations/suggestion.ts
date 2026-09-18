/**
 * The Content Decision Engine's picks as one display model, whether they come from the deterministic
 * ranking (recommendNextContent) or from the what_to_post AI task. Pure — no store access.
 */
import type { AiTaskOutput } from "@/lib/ai"
import type { ContentRecommendation, RecommendationFactor, RecommendationReasons } from "@/lib/analytics"
import { translate, type UiLang } from "@/lib/i18n/core"
import type { ContentAngle, ContentFormat, ContentIdea, ContentItem, ID, PlatformId } from "@/lib/types"
import { whatToPostMessages } from "./messages"

export interface Suggestion {
  /** `${kind}:${id}` — stable across the engine and AI lists. */
  key: string
  kind: "idea" | "item"
  /** Idea id or content item id. */
  id: ID
  /** The idea behind it (items link through `idea_id`), for "Open idea". */
  ideaId: ID | null
  title: string
  pillarId: ID | null
  platform: PlatformId
  formatId: ID | null
  formatName: string
  angleId: ID | null
  angleName: string
  hook: string
  cta: string
  reasons: RecommendationReasons
  signals: string[]
  /** Decision-engine score 0–100 (null when the engine no longer ranks it). */
  score: number | null
  breakdown: Record<RecommendationFactor, number> | null
}

/** Hook / CTA the creator edited on the card. */
export interface SuggestionEdit {
  hook?: string
  cta?: string
}

export interface SuggestionLookups {
  formats: Map<ID, ContentFormat>
  angles: Map<ID, ContentAngle>
  ideas: Map<ID, ContentIdea>
  items: Map<ID, ContentItem>
}

/** English labels; translated UI uses `factor_<key>` in `whatToPostMessages`. */
export const FACTOR_LABELS: Record<RecommendationFactor, string> = {
  pillarGap: "Pillar gap",
  slot: "Today's slot",
  ideaScore: "Idea score",
  demand: "Audience demand",
  winnerSimilarity: "Winner match",
  platform: "Platform fit",
  freshness: "Freshness",
}

const suggestionKey = (kind: Suggestion["kind"], id: ID) => `${kind}:${id}`

export function fromRecommendation(rec: ContentRecommendation, lookups: SuggestionLookups, lang: UiLang = "en"): Suggestion {
  const item = rec.kind === "item" ? lookups.items.get(rec.id) : undefined
  return {
    key: suggestionKey(rec.kind, rec.id),
    kind: rec.kind,
    id: rec.id,
    ideaId: rec.kind === "idea" ? rec.id : (item?.idea_id ?? null),
    title: rec.title.trim() || translate(whatToPostMessages, lang, "untitled"),
    pillarId: rec.pillarId,
    platform: rec.platform,
    formatId: rec.formatId,
    formatName: rec.formatId ? (lookups.formats.get(rec.formatId)?.name ?? "") : "",
    angleId: rec.angleId,
    angleName: rec.angleId ? (lookups.angles.get(rec.angleId)?.name ?? "") : "",
    hook: rec.hook.trim(),
    cta: rec.cta.trim(),
    reasons: rec.reasons,
    signals: rec.signals,
    score: rec.score,
    breakdown: rec.breakdown,
  }
}

/** Placeholder answers ("—", "n/a") count as empty. */
function clean(value: string): string {
  const v = value.trim()
  return /^(—|-|n\/?a|none)$/i.test(v) ? "" : v
}

function byName<T extends { id: ID; name: string }>(rows: Map<ID, T>, name: string): T | undefined {
  const n = clean(name).toLowerCase()
  if (!n) return undefined
  for (const row of rows.values()) if (row.name.trim().toLowerCase() === n) return row
  return undefined
}

/**
 * AI pick + alternatives → suggestions, keeping the engine's score and signals for each candidate.
 * Picks that don't map to an idea or item that still exists are dropped; titles stay the row's own.
 */
export function fromAiOutput(
  output: AiTaskOutput<"what_to_post">,
  engine: Suggestion[],
  lookups: SuggestionLookups,
  lang: UiLang = "en"
): Suggestion[] {
  const byKey = new Map(engine.map((s) => [s.key, s]))
  const seen = new Set<string>()
  const out: Suggestion[] = []
  for (const pick of [output.pick, ...output.alternatives]) {
    const kind: Suggestion["kind"] | null = pick.item_id ? "item" : pick.idea_id ? "idea" : null
    const id = pick.item_id ?? pick.idea_id
    if (!kind || !id) continue
    const idea = kind === "idea" ? lookups.ideas.get(id) : undefined
    const item = kind === "item" ? lookups.items.get(id) : undefined
    if (!idea && !item) continue
    const key = suggestionKey(kind, id)
    if (seen.has(key)) continue
    seen.add(key)
    const base = byKey.get(key)
    const format = byName(lookups.formats, pick.format)
    const angle = byName(lookups.angles, pick.angle)
    out.push({
      key,
      kind,
      id,
      ideaId: idea?.id ?? item?.idea_id ?? null,
      title: (idea?.title ?? item?.title ?? pick.title).trim() || translate(whatToPostMessages, lang, "untitled"),
      pillarId: pick.pillar_id ?? base?.pillarId ?? null,
      platform: pick.platform,
      formatId: format?.id ?? base?.formatId ?? null,
      formatName: format?.name ?? (clean(pick.format) || base?.formatName || ""),
      angleId: angle?.id ?? base?.angleId ?? null,
      angleName: angle?.name ?? (clean(pick.angle) || base?.angleName || ""),
      hook: clean(pick.hook) || base?.hook || "",
      cta: clean(pick.cta) || base?.cta || "",
      reasons: {
        topic: clean(pick.why_topic) || base?.reasons.topic || "",
        platform: clean(pick.why_platform) || base?.reasons.platform || "",
        format: clean(pick.why_format) || base?.reasons.format || "",
        angle: clean(pick.why_angle) || base?.reasons.angle || "",
      },
      signals: base?.signals ?? [],
      score: base?.score ?? null,
      breakdown: base?.breakdown ?? null,
    })
  }
  return out
}

/** Supporting signals not already quoted as one of the four reasons. */
export function extraSignals(s: Suggestion, max = 4): string[] {
  const shown = new Set(Object.values(s.reasons))
  return s.signals.filter((signal) => !shown.has(signal)).slice(0, max)
}
