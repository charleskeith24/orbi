/**
 * Shape of the hand-written demo content ("pieces"). One piece = one piece of
 * content, published or produced on one or more platforms (one item each).
 */
import type {
  FunnelStage,
  GoalCategory,
  HookCategory,
  IdeaSource,
  PipelineStage,
  PlatformId,
  Priority,
  RepurposeType,
} from "@/lib/types"
import type { PersonaKey, PillarKey } from "./brand-data"
import type { AngleName, FormatName, TagName } from "./starter-data"

export type SeriesKey = "mml" | "founder-diary" | "wltw" | "breakdown" | "ama"
export type CampaignKey = "leadership30" | "scale-sprint" | "ai-small-teams"

/** Seven Idea Score dimensions in IDEA_SCORE_DIMENSIONS order (each 1–10). */
export type ScoreTuple = [number, number, number, number, number, number, number]

export interface IdeaInfo {
  source: IdeaSource
  scores?: ScoreTuple
  /** Seed key of the row that produced the idea (story:…, research:…, question index…). */
  ref?: string
  /** Days before the first item was created. */
  leadDays?: number
}

export interface BriefSeed {
  objective?: string
  points?: string[]
  cta?: string
  visual?: string
  reference?: string
  caption?: string
  notes?: string
  broll?: string[]
  onScreen?: string[]
}

export interface ScriptSeed {
  /** Section contents in SCRIPT_FORMATS[format].sections order. */
  s: string[]
  caption?: string
  hashtags?: string[]
  /** An earlier version (same format) kept in history. */
  previous?: string[]
}

export interface QualitySeed {
  /** hook, relevance, value, clarity, authenticity (each /20), cta (/10). */
  parts: [number, number, number, number, number, number]
  strengths: string[]
  improvements: string[]
}

interface BaseSpec {
  key: string
  title: string
  pillar: PillarKey
  persona: PersonaKey
  goal: GoalCategory
  funnel: FunnelStage
  format: FormatName
  angle: AngleName
  hc: HookCategory
  hook: string
  /** The one-sentence main message (brief). */
  msg: string
  problem?: string
  series?: SeriesKey
  campaign?: CampaignKey
  tags?: TagName[]
  /** Link to a Hook Library template: [category, index]. */
  tpl?: [HookCategory, number]
  /** Save this hook to the Hook Library as a 'content' hook. */
  contentHook?: boolean
  /** Create a converted idea for this piece. */
  idea?: IdeaInfo
  brief?: BriefSeed
  script?: ScriptSeed
  quality?: QualitySeed
  notes?: string
  /** Repurposed from another piece (its key). */
  parent?: string
  repurposeType?: RepurposeType
}

/** [platform, days ago, "HH:mm"]. */
export type PostSlot = [PlatformId, number, string]

export interface PublishedSpec extends BaseSpec {
  posts: PostSlot[]
  /** Forced performance ratio vs the previous 20 posts on the first platform (winners / breakouts). */
  tier?: number
  why?: string
  replicate?: string[]
  /** Published but queued for repurposing (stage 'repurpose'). */
  repurposeQueue?: boolean
  pinned?: boolean
  /** Hiring post: leads are applications, never sales. */
  recruiting?: boolean
}

export interface PipelineSpec extends BaseSpec {
  stage: PipelineStage
  platforms: PlatformId[]
  owner: string
  priority: Priority
  /** Due date as a day offset from today (negative = overdue). */
  due?: number
  /** Scheduled items: [day offset, "HH:mm" | "later"] per platform ("later" = later today). */
  slots?: [number, string][]
}
