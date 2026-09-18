/**
 * Niche alignment — how much of the recent content (and of the winners) is about the niche.
 * Honest, local keyword overlap: each item's title, hook, idea core topic and pillar name against
 * the niche line + interests. Not a quality judgement and not AI. Pure — no React, no store.
 */
import { getWinners, isPublishedItem, publishedAtOf } from "@/lib/analytics"
import { parseDate } from "@/lib/dates"
import { translate, type UiLang } from "@/lib/i18n/core"
import type { AppSettings, ContentIdea, ContentItem, ContentPillar, Database, ID, PlatformId } from "@/lib/types"
import { nicheAlignmentMessages } from "./brand-messages"

/** Trailing window for "recent" content (scheduled posts up to the same distance ahead count too). */
export const ALIGNMENT_DAYS = 30
/** Posts needed before a share means anything. */
export const MIN_ALIGNMENT_SAMPLE = 3
/** Below this share of on-niche posts the read-out nudges. */
export const LOW_ALIGNMENT = 0.5
/** At or above this share the content is clearly on niche. */
export const HIGH_ALIGNMENT = 0.7

const DAY_MS = 86_400_000

// Grammar words only (English + Tagalog/Taglish) — topic words stay, even generic ones, so the overlap is literal.
const STOPWORDS = new Set(
  (
    "the and for with from into onto your yours you our ours their them they this that these those what when where which who " +
    "whom why how are was were been being have has had not but can could will would should just only also very really more most " +
    "less least than then too all any each every some such own same other about above after again against before below between " +
    "during over under until while because through without within via per its out off one two get got make made like way ways " +
    "thing things stuff tip tips part " +
    "ang mga ng sa na at ay ko mo ka ako ikaw siya kami tayo kayo sila nila namin natin ninyo yung iyong ito iyan iyon para " +
    "kung pero lang din rin naman pa po ba kasi dahil hindi wala may meron mas pag kapag nang talaga dito diyan doon"
  ).split(/\s+/)
)

/** A light English stemmer: "systems" → "system", "marketing" → "market", "stories" → "story". */
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`
  if (word.length > 6 && word.endsWith("ing")) return word.slice(0, -3)
  if (word.length > 4 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1)
  return word
}

/** Lower-cased words; hyphenated words yield the joined form and their parts ("e-commerce" → ecommerce, commerce). */
function words(text: string): string[] {
  const normalized = text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  const out: string[] = []
  for (const raw of normalized.split(/[^\p{L}\p{N}'’-]+/u)) {
    const word = raw.replace(/['’]s$/, "").replace(/['’]/g, "")
    const parts = word.split("-").filter(Boolean)
    if (parts.length > 1) out.push(parts.join(""))
    out.push(...parts)
  }
  return out
}

function isKeyword(word: string): boolean {
  return word.length >= 3 && !STOPWORDS.has(word) && !/^\d+$/.test(word)
}

/** Unique stemmed keywords of a text. */
export function keywordsOf(text: string): string[] {
  const out = new Set<string>()
  for (const word of words(text)) if (isKeyword(word)) out.add(stem(word))
  return [...out]
}

export interface NicheKeyword {
  stem: string
  /** The word as first written in the niche or interests. */
  label: string
}

/** Keywords of the niche line and interests, in the order they were written. */
export function nicheKeywords(niche: string, interests: readonly string[]): NicheKeyword[] {
  const out = new Map<string, string>()
  for (const text of [niche, ...interests]) {
    for (const word of words(text)) {
      if (!isKeyword(word)) continue
      const s = stem(word)
      if (!out.has(s)) out.set(s, word)
    }
  }
  return [...out].map(([s, label]) => ({ stem: s, label }))
}

/** Same stem, or one is a prefix of the other with at least 5 letters ("bookkeep" ~ "bookkeeper"). */
export function keywordsMatch(a: string, b: string): boolean {
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 5 && long.startsWith(short)
}

export interface AlignedItem {
  id: ID
  title: string
  platform: PlatformId
  /** Niche keyword labels found in the item. */
  matches: string[]
}

export interface AlignmentGroup {
  total: number
  aligned: number
  /** aligned / total, or null when there is nothing to measure. */
  share: number | null
  onNiche: AlignedItem[]
  offNiche: AlignedItem[]
}

export type AlignmentStatus = "no-niche" | "not-enough" | "low" | "mixed" | "high"

export interface NicheAlignment {
  keywords: NicheKeyword[]
  recent: AlignmentGroup
  winners: AlignmentGroup
  status: AlignmentStatus
  /** Niche keywords found in recent content, most frequent first. */
  topMatches: { label: string; count: number }[]
}

interface Lookups {
  ideas: Map<ID, ContentIdea>
  pillars: Map<ID, ContentPillar>
}

/** What an item is "about": title, hook, the idea's core topic and the pillar name. */
function itemKeywords(item: ContentItem, lookups: Lookups): string[] {
  const idea = item.idea_id ? lookups.ideas.get(item.idea_id) : undefined
  const pillar = item.pillar_id ? lookups.pillars.get(item.pillar_id) : undefined
  return keywordsOf([item.title, item.hook, idea?.core_topic ?? "", pillar?.name ?? ""].join("\n"))
}

function scoreGroup(items: readonly ContentItem[], keywords: readonly NicheKeyword[], lookups: Lookups, lang: UiLang): AlignmentGroup {
  const onNiche: AlignedItem[] = []
  const offNiche: AlignedItem[] = []
  for (const item of items) {
    const own = itemKeywords(item, lookups)
    const matches = keywords.filter((k) => own.some((w) => keywordsMatch(k.stem, w))).map((k) => k.label)
    const row: AlignedItem = { id: item.id, title: item.title.trim() || translate(nicheAlignmentMessages, lang, "untitled"), platform: item.platform, matches }
    if (matches.length) onNiche.push(row)
    else offNiche.push(row)
  }
  const total = items.length
  return { total, aligned: onNiche.length, share: total ? onNiche.length / total : null, onNiche, offNiche }
}

/** Published in the last `days` days, or scheduled from `days` ago up to `days` ahead — newest first. */
export function recentAlignmentItems(db: Database, now: Date, days: number = ALIGNMENT_DAYS): ContentItem[] {
  const t = now.getTime()
  const from = t - days * DAY_MS
  const until = t + days * DAY_MS
  const rows: { item: ContentItem; at: number }[] = []
  for (const item of db.content_items) {
    const at = isPublishedItem(item) ? publishedAtOf(item) : item.stage === "scheduled" ? parseDate(item.scheduled_at) : null
    if (!at) continue
    const ms = at.getTime()
    if (ms >= from && ms <= (isPublishedItem(item) ? t : until)) rows.push({ item, at: ms })
  }
  return rows.sort((a, b) => b.at - a.at).map((r) => r.item)
}

function statusOf(keywords: readonly NicheKeyword[], recent: AlignmentGroup): AlignmentStatus {
  if (!keywords.length) return "no-niche"
  if (recent.total < MIN_ALIGNMENT_SAMPLE || recent.share === null) return "not-enough"
  if (recent.share < LOW_ALIGNMENT) return "low"
  return recent.share < HIGH_ALIGNMENT ? "mixed" : "high"
}

export function nicheAlignment(
  db: Database,
  settings: AppSettings,
  now: Date,
  niche: string,
  interests: readonly string[],
  lang: UiLang = "en"
): NicheAlignment {
  const keywords = nicheKeywords(niche, interests)
  const lookups: Lookups = {
    ideas: new Map(db.content_ideas.map((i) => [i.id, i])),
    pillars: new Map(db.content_pillars.map((p) => [p.id, p])),
  }
  const recent = scoreGroup(recentAlignmentItems(db, now), keywords, lookups, lang)
  const winners = scoreGroup(
    getWinners(db, settings, now).map((r) => r.item),
    keywords,
    lookups,
    lang
  )

  const counts = new Map<string, number>()
  for (const row of recent.onNiche) for (const label of row.matches) counts.set(label, (counts.get(label) ?? 0) + 1)
  const topMatches = [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  return { keywords, recent, winners, status: statusOf(keywords, recent), topMatches }
}
