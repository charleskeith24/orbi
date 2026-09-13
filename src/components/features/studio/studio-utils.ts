/**
 * Pure helpers for the Content Studio: workspace tabs, default script formats, word counts,
 * script rendering and Story Vault matching. No React, no store access.
 */
import { REPURPOSE_TYPES, SCRIPT_FORMATS } from "@/lib/constants"
import { parseDate } from "@/lib/dates"
import type {
  ContentBrief,
  ContentItem,
  ContentScript,
  Database,
  PipelineStage,
  PlatformId,
  ScriptFormat,
  ScriptSection,
  Story,
} from "@/lib/types"
import { formatDuration } from "@/lib/utils"

/* ---------------------------------- Tabs ---------------------------------- */

export const WORKSPACE_TABS = ["brief", "script", "score", "repurpose", "tree", "performance"] as const
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

export function parseTab(value: string | null | undefined): WorkspaceTab | null {
  return value && (WORKSPACE_TABS as readonly string[]).includes(value) ? (value as WorkspaceTab) : null
}

/** The workspace opens where the work is: brief while planning, script in production, performance once live. */
export function defaultTabForStage(stage: PipelineStage): WorkspaceTab {
  if (stage === "idea" || stage === "selected" || stage === "brief") return "brief"
  if (stage === "published" || stage === "repurpose") return "performance"
  return "script"
}

/** Stages shown under "Continue creating" on the Studio home. */
export const CONTINUE_STAGES: PipelineStage[] = ["brief", "scripting", "review", "revision"]

/* --------------------------------- Formats -------------------------------- */

const PLATFORM_FORMAT: Record<PlatformId, ScriptFormat> = {
  facebook: "facebook_post",
  linkedin: "linkedin_post",
  x: "x_thread",
  threads: "threads_post",
  instagram: "short_video",
  tiktok: "short_video",
  youtube: "short_video",
}

export function isScriptFormat(value: string | null | undefined): value is ScriptFormat {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SCRIPT_FORMATS, value)
}

/** Current scripts of an item, newest first (one per format). */
export function currentScripts(db: Pick<Database, "content_scripts">, itemId: string): ContentScript[] {
  return db.content_scripts
    .filter((s) => s.content_item_id === itemId && s.is_current)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

/** Latest current script → the item's format → its repurpose type → the platform's usual structure. */
export function defaultScriptFormat(db: Pick<Database, "content_scripts" | "content_formats">, item: ContentItem): ScriptFormat {
  const latest = currentScripts(db, item.id)[0]
  if (latest) return latest.format
  const format = item.format_id ? db.content_formats.find((f) => f.id === item.format_id) : undefined
  if (format) return format.script_format
  if (item.repurpose_type) return REPURPOSE_TYPES[item.repurpose_type].scriptFormat
  return PLATFORM_FORMAT[item.platform] ?? "custom"
}

const VIDEO_PLATFORMS: PlatformId[] = ["tiktok", "instagram", "youtube", "facebook"]

/** Format quick-starts on the Studio home, in the order of spec §16. */
export const QUICK_START_FORMATS: ScriptFormat[] = ["short_video", "facebook_post", "linkedin_post", "carousel", "video_brief"]

/** Platform a quick-start lands on, preferring the brand's main platforms. */
export function quickStartPlatform(format: ScriptFormat, mainPlatforms: readonly PlatformId[]): PlatformId {
  if (format === "facebook_post") return "facebook"
  if (format === "linkedin_post") return "linkedin"
  if (format === "x_thread") return "x"
  if (format === "threads_post") return "threads"
  if (format === "carousel" || format === "instagram_caption" || format === "story_sequence") {
    return mainPlatforms.includes("instagram") ? "instagram" : (mainPlatforms[0] ?? "instagram")
  }
  // Short video is native to TikTok / Reels / Shorts first, so walk the video platforms in that order.
  return VIDEO_PLATFORMS.find((p) => mainPlatforms.includes(p)) ?? "tiktok"
}

/* ------------------------------ Script text ------------------------------- */

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0
}

export function wordsIn(sections: readonly ScriptSection[]): number {
  let total = 0
  for (const s of sections) total += countWords(s.content)
  return total
}

/** Average speaking pace used for the spoken-time estimate. */
export const SPOKEN_WPM = 150

export function spokenSeconds(words: number): number {
  return Math.round((words / SPOKEN_WPM) * 60)
}

/** "≈ 1:12" at ~150 words per minute. */
export function spokenLabel(words: number): string {
  return `≈ ${formatDuration(spokenSeconds(words))}`
}

const HOOK_KEYS = new Set(["hook", "slide_1", "frame_1", "cold_open"])
const CTA_KEYS = new Set(["cta", "slide_7", "frame_5"])

/** Empty sections for a format, with the item's hook and the brief's CTA already in place. */
export function starterSections(
  format: ScriptFormat,
  item: Pick<ContentItem, "hook">,
  brief?: Pick<ContentBrief, "cta"> | null
): ScriptSection[] {
  return SCRIPT_FORMATS[format].sections.map((s) => ({
    key: s.key,
    label: s.label,
    content: HOOK_KEYS.has(s.key) ? item.hook.trim() : CTA_KEYS.has(s.key) ? (brief?.cta ?? "").trim() : "",
  }))
}

/** Saved sections mapped onto the format's canonical structure (keeps extra sections at the end). */
export function alignSections(format: ScriptFormat, sections: readonly ScriptSection[]): ScriptSection[] {
  const spec = SCRIPT_FORMATS[format]
  const byKey = new Map(sections.map((s) => [s.key, s]))
  const aligned = spec.sections.map((s) => ({ key: s.key, label: s.label, content: byKey.get(s.key)?.content ?? "" }))
  const known = new Set(spec.sections.map((s) => s.key))
  return [...aligned, ...sections.filter((s) => !known.has(s.key))]
}

export function sameSections(a: readonly ScriptSection[], b: readonly ScriptSection[]): boolean {
  return a.length === b.length && a.every((s, i) => s.key === b[i].key && s.content === b[i].content)
}

export function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** Copy with section labels, for editors and teleprompters. */
export function scriptWithLabels(sections: readonly ScriptSection[]): string {
  return sections
    .filter((s) => s.content.trim())
    .map((s) => `${s.label.toUpperCase()}\n${s.content.trim()}`)
    .join("\n\n")
}

export function normalizeHashtag(tag: string): string {
  const clean = tag.trim().replace(/^#+/, "").replace(/\s+/g, "")
  return clean ? `#${clean}` : ""
}

export function captionWithHashtags(caption: string, hashtags: readonly string[]): string {
  const tags = hashtags.map(normalizeHashtag).filter(Boolean).join(" ")
  return [caption.trim(), tags].filter(Boolean).join("\n\n")
}

/* ------------------------------- Story Vault ------------------------------ */

const STOPWORDS = new Set(
  (
    "the and for you your with that this from are was were how what why when who have has had but not can will would " +
    "about into its our out get got one all more most just like they them their then than there here over only also very " +
    "too any some such each every which while been does did doing don dont i'm it's we're you're thing things make made " +
    "want need know first before after back really still even much many ang mga para ako ikaw yung lang hindi natin namin kayo sila " +
    "year month week day time today yesterday tomorrow myself yourself ourselves people person way lot good great better best " +
    "new old last next little big small every always never something someone everyone anything " +
    "two three four five six seven eight nine ten hour minute second half"
  ).split(" ")
)

function stem(word: string): string {
  return word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word
}

/** Lower-cased content words (≥ 3 letters, stopwords removed, light plural stemming). */
export function keywordsOf(...texts: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}']+/u)) {
      const word = stem(raw.replace(/^'+|'+$/g, "").replace(/'s$/, ""))
      if (word.length < 3 || STOPWORDS.has(word) || /^\d+$/.test(word)) continue
      out.add(word)
    }
  }
  return out
}

export interface RelatedStory {
  story: Story
  score: number
  /** Shared keywords, strongest first. */
  matches: string[]
}

/** Minimum weighted overlap for a story to count as related (≈ one rare shared keyword). */
const MIN_STORY_SCORE = 2.4

/**
 * Story Vault entries that share keywords with the piece. Each shared keyword is weighted by how rare it
 * is across the vault (IDF), tagged story keywords count double and a shared pillar adds a little.
 */
export function relatedStories(
  stories: readonly Story[],
  item: Pick<ContentItem, "title" | "hook" | "notes" | "pillar_id">,
  brief: Pick<ContentBrief, "main_message" | "objective" | "supporting_points"> | null | undefined,
  limit = 3
): RelatedStory[] {
  const topic = keywordsOf(item.title, item.hook, item.notes, brief?.main_message, brief?.objective, ...(brief?.supporting_points ?? []))
  if (!topic.size || !stories.length) return []
  const docs = stories.map((story) => ({
    story,
    tagged: keywordsOf(...story.keywords),
    body: keywordsOf(story.title, story.lesson, story.situation, story.problem, story.action, story.result),
  }))
  const df = new Map<string, number>()
  for (const doc of docs) for (const word of new Set([...doc.tagged, ...doc.body])) df.set(word, (df.get(word) ?? 0) + 1)
  const idf = (word: string) => Math.log((docs.length + 1) / ((df.get(word) ?? 0) + 0.5))

  const out: RelatedStory[] = []
  for (const doc of docs) {
    const hits: { word: string; weight: number }[] = []
    for (const word of topic) {
      const weight = doc.tagged.has(word) ? 2 * idf(word) : doc.body.has(word) ? idf(word) : 0
      if (weight > 0) hits.push({ word, weight })
    }
    if (!hits.length) continue
    const score = hits.reduce((sum, h) => sum + h.weight, 0) + (item.pillar_id && doc.story.pillar_id === item.pillar_id ? 0.75 : 0)
    if (score < MIN_STORY_SCORE) continue
    out.push({ story: doc.story, score, matches: hits.sort((a, b) => b.weight - a.weight).map((h) => h.word) })
  }
  return out.sort((a, b) => b.score - a.score || Number(b.story.is_favorite) - Number(a.story.is_favorite)).slice(0, limit)
}

/* ---------------------------------- Misc ---------------------------------- */

/** Labels for AI tasks shown in the workspace's recent AI activity. */
export const AI_TASK_LABELS: Record<string, string> = {
  content_brief: "Brief drafted",
  generate_script: "Script drafted",
  score_content: "Content scored",
  generate_hooks: "Hooks generated",
  repurpose: "Repurposing drafts",
  winner_replication: "Winner replication",
  what_to_post: "What to post",
}

/** Due date (or planned publish time) in ms for sorting; undated items sort last. */
export function dueSortKey(item: Pick<ContentItem, "due_date" | "scheduled_at">): number {
  return (parseDate(item.due_date) ?? parseDate(item.scheduled_at))?.getTime() ?? Number.POSITIVE_INFINITY
}

/** Owners already used in the workspace plus the default owner, alphabetical. */
export function knownOwners(items: readonly Pick<ContentItem, "owner">[], defaultOwner: string): string[] {
  const set = new Set<string>()
  if (defaultOwner.trim()) set.add(defaultOwner.trim())
  for (const item of items) if (item.owner.trim()) set.add(item.owner.trim())
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Clipboard write with a legacy fallback; false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or insecure context — fall back below.
  }
  try {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    area.remove()
    return ok
  } catch {
    return false
  }
}
