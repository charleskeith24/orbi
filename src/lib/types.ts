/**
 * Personal Brand Content OS — domain model.
 *
 * Every interface here mirrors a Postgres table in `supabase/migrations`.
 * Field names are snake_case on purpose so rows flow between the client store,
 * the local adapter and Supabase without a mapping layer.
 *
 * Conventions
 * - `ISODate`      → 'YYYY-MM-DD' (calendar dates, no timezone)
 * - `ISODateTime`  → full ISO-8601 timestamp
 * - Nullable foreign keys are `ID | null`
 * - Text fields default to '' (never undefined); list fields default to []
 */
// Type-only (the i18n core has no imports, so there is no cycle); schema-parity.test.ts resolves it too.
import type { UiLang } from "@/lib/i18n/core"

export type ID = string
export type ISODate = string
export type ISODateTime = string

export interface BaseRow {
  id: ID
  user_id: ID
  created_at: ISODateTime
  updated_at: ISODateTime
}

/* -------------------------------------------------------------------------- */
/*                                   Enums                                    */
/* -------------------------------------------------------------------------- */

export type PlatformId =
  | "facebook"
  | "tiktok"
  | "instagram"
  | "youtube"
  | "linkedin"
  | "x"
  | "threads"

export type FunnelStage = "tofu" | "mofu" | "bofu"
export type Priority = "high" | "medium" | "low"
export type GoalCategory = "awareness" | "authority" | "community" | "leads" | "business"
export type GoalPeriod = "weekly" | "monthly" | "quarterly"

export type ProblemCategory =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "emotional"
  | "financial"
  | "career"
  | "business"
  | "operational"

export type IdeaStatus = "inbox" | "researching" | "validated" | "selected" | "converted" | "archived"

export type IdeaSource =
  | "quick_capture"
  | "ai_generator"
  | "matrix"
  | "problem_bank"
  | "question_bank"
  | "research"
  | "story"
  | "experience"
  | "winner"
  | "repurpose"
  | "onboarding"
  | "strategist"
  | "planner"
  | "manual"

/** The 13 production columns of the Pipeline board (spec §18). */
export type PipelineStage =
  | "idea"
  | "selected"
  | "brief"
  | "scripting"
  | "ready_for_production"
  | "recording"
  | "editing"
  | "review"
  | "revision"
  | "ready_to_post"
  | "scheduled"
  | "published"
  | "repurpose"

/** The 8 roll-up stages shown on the dashboard pipeline (spec §2). */
export type StageGroup =
  | "idea"
  | "brief"
  | "script"
  | "production"
  | "review"
  | "ready"
  | "scheduled"
  | "published"

export type PerformanceTier = "normal" | "good" | "winner" | "breakout"

export type HookCategory =
  | "curiosity"
  | "contrarian"
  | "mistake"
  | "authority"
  | "story"
  | "problem"
  | "results"
  | "list"
  | "warning"
  | "question"
  | "custom"

export type BrandLanguage = "english" | "tagalog" | "taglish"
export type BrandTone =
  | "professional"
  | "conversational"
  | "motivational"
  | "educational"
  | "challenging"
  | "casual"
export type PersonalityTrait =
  | "educational"
  | "direct"
  | "inspirational"
  | "strategic"
  | "practical"
  | "humorous"
  | "bold"
  | "professional"
  | "authentic"
  | "story_driven"

export type FormatCategory = "video" | "text" | "visual" | "audio" | "long_form" | "live"

/** Script structures the Content Studio can produce (spec §16). */
export type ScriptFormat =
  | "short_video"
  | "long_video"
  | "facebook_post"
  | "linkedin_post"
  | "carousel"
  | "video_brief"
  | "x_thread"
  | "threads_post"
  | "instagram_caption"
  | "newsletter"
  | "blog"
  | "podcast_outline"
  | "story_sequence"
  | "custom"

export type RepurposeType =
  | "facebook_post"
  | "linkedin_post"
  | "carousel"
  | "x_thread"
  | "reel_caption"
  | "youtube_short"
  | "newsletter"
  | "follow_up"
  | "part_2"
  | "opposite_opinion"
  | "case_study"
  | "update_post"

export type RepurposeStatus = "suggested" | "drafted" | "created" | "dismissed"
export type CampaignStatus = "planning" | "active" | "paused" | "completed"
export type SeriesFrequency = "daily" | "weekly" | "biweekly" | "monthly"
export type ExperimentStatus = "planned" | "running" | "completed" | "cancelled"
export type ExperimentWinner = "a" | "b" | "inconclusive"

/** Raw numeric fields captured on a metrics snapshot. */
export type MetricKey =
  | "views"
  | "reach"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "followers_gained"
  | "profile_visits"
  | "link_clicks"
  | "leads"
  | "sales"
  | "watch_time_seconds"
  | "avg_retention"

/** Derived rates (percentages 0–100). */
export type RateKey =
  | "engagement_rate"
  | "share_rate"
  | "save_rate"
  | "lead_conversion_rate"
  | "follower_conversion_rate"

export type ExperimentMetric = MetricKey | RateKey | "engagements"
export type GoalMetric =
  | "views"
  | "reach"
  | "followers_gained"
  | "engagements"
  | "comments"
  | "shares"
  | "saves"
  | "profile_visits"
  | "link_clicks"
  | "leads"
  | "sales"
  | "posts"

export type WinnerMetric = "views" | "engagement_rate" | "engagements" | "leads" | "composite"

export type StoryType =
  | "story"
  | "experience"
  | "lesson"
  | "quote"
  | "opinion"
  | "framework"
  | "case_study"
  | "achievement"
  | "failure"
  | "belief"

export type ResearchType =
  | "competitor"
  | "post"
  | "trend"
  | "quote"
  | "video"
  | "topic"
  | "article"
  | "screenshot"
export type ResearchStatus = "saved" | "analyzed" | "adapted" | "archived"
export type QuestionStatus = "new" | "idea_created" | "answered" | "dismissed"
export type ReviewStatus = "draft" | "final"
export type AiProviderId = "anthropic" | "openai" | "offline"
export type GeneratedBy = AiProviderId | "manual"
export type HookSource = "library" | "user" | "ai" | "content"
export type MetricSource = "manual" | "import" | "integration"

/** Brand deal pipeline (Money → Brand Deals), in board order. `lost` is the only dead end. */
export type DealStatus =
  | "lead"
  | "pitched"
  | "negotiating"
  | "contracted"
  | "in_progress"
  | "delivered"
  | "paid"
  | "lost"
/** How the deal started: the brand came to you, you pitched them, through an agency, or a referral. */
export type DealSource = "inbound" | "outbound" | "agency" | "referral"
export type IncomeSource = "brand_deal" | "affiliate" | "platform_payout" | "product" | "service" | "tip" | "other"
export type IncomeStatus = "expected" | "received"

/** Categorical color slots (validated data-viz palette, see globals.css `--cat-*`). */
export type CategoricalColor =
  | "blue"
  | "orange"
  | "aqua"
  | "yellow"
  | "magenta"
  | "green"
  | "violet"
  | "red"
export type TagColor = CategoricalColor | "gray"

/** Entities that can carry tags through the polymorphic `content_tags` join. */
export type TaggableEntity =
  | "content_ideas"
  | "content_items"
  | "stories"
  | "hooks"
  | "research_items"
  | "content_campaigns"

/* -------------------------------------------------------------------------- */
/*                               Brand strategy                               */
/* -------------------------------------------------------------------------- */

export interface BrandProfile extends BaseRow {
  // Identity
  name: string
  brand_name: string
  role: string
  industry: string
  expertise_summary: string
  years_experience: number | null
  location: string
  main_platforms: PlatformId[]
  // Positioning
  who_am_i: string
  known_for: string
  problems_solved: string
  why_listen: string
  point_of_view: string
  /** "I help [audience] achieve [result] through [method]." */
  positioning_audience: string
  positioning_result: string
  positioning_method: string
  expertise_areas: string[]
  // Niche (from Niche Discovery)
  /** One-line niche, e.g. "Bookkeeping systems for Filipino online sellers". */
  niche: string
  /** Topics the creator loves talking about — the "hilig" behind the niche. */
  interests: string[]
  /** Why the niche fits: passion × expertise × audience demand. */
  niche_fit: string
  personality_traits: PersonalityTrait[]
  // Communication style
  language: BrandLanguage
  tones: BrandTone[]
  // Brand rules
  always_do: string
  never_do: string
  phrases_used: string[]
  phrases_avoid: string[]
  cta_style: string
  storytelling_style: string
  // Contact & media kit
  contact_email: string
  website: string
  /** Short third-person bio for the media kit (the media kit falls back to `who_am_i`). */
  media_kit_bio: string
  // Goals
  primary_goal_id: ID | null
  secondary_goal_id: ID | null
  onboarding_completed: boolean
}

export interface ContentGoal extends BaseRow {
  category: GoalCategory
  name: string
  description: string
  /** Free-form KPI labels, e.g. ["Reach", "Followers"]. */
  kpis: string[]
  target_metric: GoalMetric | null
  target_value: number | null
  period: GoalPeriod
  is_active: boolean
}

export interface PlatformStrategy extends BaseRow {
  platform: PlatformId
  is_active: boolean
  handle: string
  primary_goal_id: ID | null
  /** Target posts per week on this platform. */
  posting_frequency: number
  preferred_format_ids: ID[]
  preferred_pillar_ids: ID[]
  audience: string
  cta_style: string
  current_followers: number | null
  notes: string
}

/* -------------------------------------------------------------------------- */
/*                                  Audience                                  */
/* -------------------------------------------------------------------------- */

export interface AudiencePersona extends BaseRow {
  name: string
  age_range: string
  profession: string
  industry: string
  experience_level: string
  location: string
  goals: string[]
  problems: string[]
  fears: string[]
  frustrations: string[]
  aspirations: string[]
  questions: string[]
  objections: string[]
  buying_motivation: string
  content_consumed: string[]
  platforms: PlatformId[]
  influencers: string[]
  language_used: string[]
  is_primary: boolean
  color: CategoricalColor
  notes: string
}

export interface AudienceProblem extends BaseRow {
  persona_id: ID | null
  problem: string
  category: ProblemCategory
  /** 1 (minor) – 5 (critical). */
  severity: number
  pillar_id: ID | null
  notes: string
}

export interface AudienceQuestion extends BaseRow {
  question: string
  source_person: string
  platform: PlatformId | null
  topic: string
  /** How many times this (or an equivalent) question was asked. */
  frequency: number
  pillar_id: ID | null
  persona_id: ID | null
  status: QuestionStatus
  idea_id: ID | null
  content_item_id: ID | null
  last_asked_at: ISODate
}

/* -------------------------------------------------------------------------- */
/*                            Pillars & libraries                             */
/* -------------------------------------------------------------------------- */

export interface ContentPillar extends BaseRow {
  name: string
  description: string
  color: CategoricalColor
  /** lucide-react icon name, e.g. "GraduationCap". */
  icon: string
  /** Target share of the content mix, 0–100. */
  target_percentage: number
  examples: string[]
  sort_order: number
  is_active: boolean
}

export interface ContentFormat extends BaseRow {
  name: string
  category: FormatCategory
  description: string
  /** Default script structure used by the Content Studio. */
  script_format: ScriptFormat
  is_default: boolean
  sort_order: number
}

/** Table: `angles`. */
export interface ContentAngle extends BaseRow {
  name: string
  description: string
  example: string
  is_default: boolean
}

/** Table: `hooks`. Templates use "___" for blanks. */
export interface Hook extends BaseRow {
  text: string
  category: HookCategory
  is_template: boolean
  source: HookSource
  pillar_id: ID | null
  notes: string
  is_favorite: boolean
}

export interface Tag extends BaseRow {
  /** Stored without the leading "#". */
  name: string
  color: TagColor
}

export interface ContentTag extends BaseRow {
  tag_id: ID
  entity_type: TaggableEntity
  entity_id: ID
}

/* -------------------------------------------------------------------------- */
/*                                   Ideas                                    */
/* -------------------------------------------------------------------------- */

/** Idea Priority Score dimensions (spec §39), each 1–10. */
export interface IdeaScores {
  audience_relevance: number
  authority_potential: number
  business_alignment: number
  timeliness: number
  originality: number
  repurposing_potential: number
  ease_of_production: number
}

export interface ContentIdea extends BaseRow {
  title: string
  core_topic: string
  description: string
  hook: string
  hook_category: HookCategory | null
  angle_id: ID | null
  pillar_id: ID | null
  persona_id: ID | null
  problem_id: ID | null
  goal_id: ID | null
  platforms: PlatformId[]
  format_id: ID | null
  funnel_stage: FunnelStage | null
  inspiration: string
  source: IdeaSource
  /** Row that produced this idea (story, research item, question, winner…). */
  source_ref_id: ID | null
  priority: Priority
  status: IdeaStatus
  scores: IdeaScores | null
  /** Overall Idea Score 0–100 derived from `scores`. */
  score: number | null
  why_it_matters: string
  talking_points: string[]
  cta: string
  campaign_id: ID | null
  series_id: ID | null
  converted_item_id: ID | null
}

/* -------------------------------------------------------------------------- */
/*                               Content items                                */
/* -------------------------------------------------------------------------- */

export type QualityRating = "high_potential" | "solid" | "needs_work" | "weak"

/** AI Content Score (spec §28) — a quality evaluation, not a virality prediction. */
export interface ContentQualityScore {
  hook: number // /20
  relevance: number // /20
  value: number // /20
  clarity: number // /20
  authenticity: number // /20
  cta: number // /10
  /** Normalised total 0–100. */
  total: number
  rating: QualityRating
  strengths: string[]
  improvements: string[]
  evaluated_at: ISODateTime
  provider: AiProviderId
}

/** One post on one platform. Repurposed versions are separate rows linked by `parent_id`. */
export interface ContentItem extends BaseRow {
  title: string
  idea_id: ID | null
  pillar_id: ID | null
  persona_id: ID | null
  problem_id: ID | null
  goal_id: ID | null
  angle_id: ID | null
  hook_id: ID | null
  hook: string
  hook_category: HookCategory | null
  platform: PlatformId
  format_id: ID | null
  funnel_stage: FunnelStage | null
  stage: PipelineStage
  priority: Priority
  owner: string
  due_date: ISODate | null
  scheduled_at: ISODateTime | null
  published_at: ISODateTime | null
  published_url: string
  thumbnail_url: string
  campaign_id: ID | null
  series_id: ID | null
  /** The content this was repurposed from. */
  parent_id: ID | null
  repurpose_type: RepurposeType | null
  quality_score: ContentQualityScore | null
  /** Manually include in the Winning Content Library regardless of tier. */
  pinned_winner: boolean
  why_it_worked: string
  replication_ideas: string[]
  notes: string
}

/** 1:1 with a content item — the strategic brief (spec §17). */
export interface ContentBrief extends BaseRow {
  content_item_id: ID
  objective: string
  main_message: string
  supporting_points: string[]
  cta: string
  visual_direction: string
  reference: string
  caption: string
  production_notes: string
  b_roll: string[]
  on_screen_text: string[]
}

export interface ScriptSection {
  key: string
  label: string
  content: string
}

export interface ContentScript extends BaseRow {
  content_item_id: ID
  format: ScriptFormat
  title: string
  sections: ScriptSection[]
  /** Full rendered copy (sections joined), what the creator reads/posts. */
  body: string
  caption: string
  hashtags: string[]
  version: number
  is_current: boolean
  generated_by: GeneratedBy
}

/** Table: `content_calendar` — recurring weekly posting targets (spec §19/§49). */
export interface PostingSlot extends BaseRow {
  /** 0 = Sunday … 6 = Saturday. */
  day_of_week: number
  /** Theme label, e.g. "Educational / Authority". */
  label: string
  pillar_id: ID | null
  format_id: ID | null
  platforms: PlatformId[]
  /** Optional preferred time "HH:mm". */
  time: string | null
  sort_order: number
  is_active: boolean
}

export interface ContentCampaign extends BaseRow {
  name: string
  objective: string
  description: string
  start_date: ISODate
  end_date: ISODate
  persona_id: ID | null
  pillar_id: ID | null
  goal_id: ID | null
  platforms: PlatformId[]
  message: string
  status: CampaignStatus
  target_posts: number | null
  color: CategoricalColor
}

export interface ContentSeries extends BaseRow {
  name: string
  description: string
  frequency: SeriesFrequency
  day_of_week: number | null
  platforms: PlatformId[]
  pillar_id: ID | null
  format_id: ID | null
  hook_template: string
  is_active: boolean
}

/** Table: `content_metrics` — one snapshot per logging event; analytics use the latest per item. */
export interface ContentMetric extends BaseRow {
  content_item_id: ID
  platform: PlatformId
  recorded_at: ISODate
  views: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  followers_gained: number
  profile_visits: number
  link_clicks: number
  leads: number
  sales: number
  watch_time_seconds: number | null
  /** Average retention / % watched, 0–100. */
  avg_retention: number | null
  notes: string
  source: MetricSource
}

export interface ContentExperiment extends BaseRow {
  name: string
  hypothesis: string
  variant_a: string
  variant_b: string
  metric: ExperimentMetric
  start_date: ISODate | null
  end_date: ISODate | null
  status: ExperimentStatus
  variant_a_item_ids: ID[]
  variant_b_item_ids: ID[]
  result: string
  winner: ExperimentWinner | null
  lesson: string
}

/** Table: `content_repurposing`. */
export interface ContentRepurpose extends BaseRow {
  source_item_id: ID
  target_item_id: ID | null
  type: RepurposeType
  platform: PlatformId | null
  status: RepurposeStatus
  title: string
  draft: string
}

/* -------------------------------------------------------------------------- */
/*                          Knowledge: stories, research                      */
/* -------------------------------------------------------------------------- */

/** Table: `stories` — the Story Vault / content memory (spec §30). */
export interface Story extends BaseRow {
  type: StoryType
  title: string
  situation: string
  problem: string
  action: string
  result: string
  lesson: string
  emotion: string
  pillar_id: ID | null
  keywords: string[]
  occurred_on: ISODate | null
  is_favorite: boolean
}

export interface ReferenceAnalysis {
  hook: string
  structure: string[]
  angle: string
  psychology: string
  why_it_works: string
  patterns: string[]
  analyzed_at: ISODateTime
  provider: AiProviderId
}

export interface ResearchItem extends BaseRow {
  type: ResearchType
  title: string
  url: string
  source: string
  creator: string
  platform: PlatformId | null
  topic: string
  hook: string
  /** Pasted reference text / transcript (used for analysis, never republished). */
  content: string
  why_attention: string
  learnings: string
  adaptation: string
  analysis: ReferenceAnalysis | null
  status: ResearchStatus
  pillar_id: ID | null
}

/* -------------------------------------------------------------------------- */
/*                          Reviews, logs & settings                          */
/* -------------------------------------------------------------------------- */

export interface WeeklyReview extends BaseRow {
  /** Monday (or configured week start) of the reviewed week. */
  week_start: ISODate
  /** Strategic focus chosen in the Weekly Planner. */
  focus: string
  /** Frozen analytics snapshot at generation time. */
  stats: Record<string, unknown> | null
  what_worked: string
  what_didnt: string
  learned: string
  double_down: string
  stop: string
  test_next: string
  planned_item_ids: ID[]
  status: ReviewStatus
  generated_by: GeneratedBy | null
}

export interface MonthlyReview extends BaseRow {
  /** First day of the reviewed month. */
  month: ISODate
  stats: Record<string, unknown> | null
  summary: string
  continue_doing: string[]
  increase: string[]
  reduce: string[]
  stop: string[]
  experiment: string[]
  status: ReviewStatus
  generated_by: GeneratedBy | null
}

export interface AiGeneration extends BaseRow {
  task: string
  provider: AiProviderId
  model: string
  input: unknown
  output: unknown
  entity_type: string | null
  entity_id: ID | null
  status: "success" | "error"
  error: string | null
  duration_ms: number | null
}

export interface EngagementLog extends BaseRow {
  date: ISODate
  comments_replied: number
  dms_replied: number
  creator_comments: number
  questions_collected: number
  ideas_captured: number
  /** Keys of `AppSettings.engagement_tasks` completed that day. */
  completed_tasks: string[]
  notes: string
}

export interface EngagementTaskConfig {
  key: string
  label: string
  /** Daily target count (0 = checkbox only). */
  target: number
}

export interface FunnelTargets {
  tofu: number
  mofu: number
  bofu: number
}

export interface AppSettings extends BaseRow {
  weekly_post_target: number
  /** 0 = Sunday, 1 = Monday. */
  week_starts_on: 0 | 1
  timezone: string
  buffer_healthy_days: number
  buffer_warning_days: number
  winner_metric: WinnerMetric
  /** Compare against the last N posts on the same platform. */
  winner_window: number
  /** Minimum comparison posts before tiers are assigned. */
  winner_min_sample: number
  tier_good: number
  tier_winner: number
  tier_breakout: number
  funnel_targets: FunnelTargets
  engagement_tasks: EngagementTaskConfig[]
  default_owner: string
  /** Pillar mix deviation (percentage points) that triggers an imbalance warning. */
  pillar_tolerance: number
  // Language & display
  /** Language of the app's screens. The content language is Brand HQ's `brand_profiles.language`. */
  ui_language: UiLang
  /** Simple mode: the sidebar shows only the everyday modules (`NavItem.simple`); every page stays reachable. */
  simple_mode: boolean
  /** ISO 4217 code used as the default for new brand deals, income entries and rate cards. */
  currency: string
  // Reminders (Settings → Reminders)
  reminders_daily_enabled: boolean
  /** Local time of the daily digest, "HH:mm". */
  reminders_daily_time: string
  reminders_slot_enabled: boolean
  /** Minutes before each Posting Schedule slot. */
  reminders_slot_lead_minutes: number
  reminders_review_enabled: boolean
  /** Weekly review day: 0 = Sunday … 6 = Saturday. */
  reminders_review_day: number
  /** Local time of the weekly review reminder, "HH:mm". */
  reminders_review_time: string
}

/* -------------------------------------------------------------------------- */
/*                                   Money                                    */
/* -------------------------------------------------------------------------- */

/** Table: `brand_deals` — a sponsorship or collaboration (Money → Brand Deals). */
export interface BrandDeal extends BaseRow {
  brand_name: string
  contact_name: string
  contact_email: string
  /** Social handle or chat contact, e.g. "@kapihanroasters" or a Viber number. */
  contact_handle: string
  source: DealSource
  status: DealStatus
  /** Agreed fee in `currency`; null until quoted. */
  fee: number | null
  currency: string
  deliverables: string[]
  platforms: PlatformId[]
  /** Content made for the deal. Array reference to content_items (no FK; relations.ts array_remove). */
  content_item_ids: ID[]
  campaign_id: ID | null
  start_date: ISODate | null
  due_date: ISODate | null
  paid_at: ISODate | null
  usage_rights: string
  /** List the brand under "Past collaborations" in the media kit. */
  show_in_media_kit: boolean
  notes: string
}

/** Table: `income_entries` — money received or expected. */
export interface IncomeEntry extends BaseRow {
  date: ISODate
  amount: number
  currency: string
  source: IncomeSource
  /** Free text for affiliate income, e.g. "TikTok Shop" (see AFFILIATE_PROGRAM_SUGGESTIONS). */
  affiliate_program: string
  platform: PlatformId | null
  status: IncomeStatus
  brand_deal_id: ID | null
  content_item_id: ID | null
  description: string
}

/** Table: `rate_cards` — media-kit packages. */
export interface RateCard extends BaseRow {
  name: string
  description: string
  /** null = a multi-platform package. */
  platform: PlatformId | null
  deliverables: string[]
  /** null = "Ask for a quote". */
  price: number | null
  currency: string
  is_active: boolean
  sort_order: number
}

/* -------------------------------------------------------------------------- */
/*                                  Database                                  */
/* -------------------------------------------------------------------------- */

export interface Database {
  brand_profiles: BrandProfile[]
  content_goals: ContentGoal[]
  content_platforms: PlatformStrategy[]
  audience_personas: AudiencePersona[]
  audience_problems: AudienceProblem[]
  audience_questions: AudienceQuestion[]
  content_pillars: ContentPillar[]
  content_formats: ContentFormat[]
  angles: ContentAngle[]
  hooks: Hook[]
  tags: Tag[]
  content_tags: ContentTag[]
  content_ideas: ContentIdea[]
  content_campaigns: ContentCampaign[]
  content_series: ContentSeries[]
  content_items: ContentItem[]
  content_briefs: ContentBrief[]
  content_scripts: ContentScript[]
  content_calendar: PostingSlot[]
  content_metrics: ContentMetric[]
  content_experiments: ContentExperiment[]
  content_repurposing: ContentRepurpose[]
  stories: Story[]
  research_items: ResearchItem[]
  weekly_reviews: WeeklyReview[]
  monthly_reviews: MonthlyReview[]
  ai_generations: AiGeneration[]
  engagement_logs: EngagementLog[]
  app_settings: AppSettings[]
  brand_deals: BrandDeal[]
  income_entries: IncomeEntry[]
  rate_cards: RateCard[]
}

export type TableName = keyof Database
export type Row<T extends TableName> = Database[T][number]
export type MetaField = "id" | "user_id" | "created_at" | "updated_at"
/** Values accepted by `insert` — every non-meta field is optional and filled from table defaults. */
export type InsertRow<T extends TableName> = Partial<Omit<Row<T>, "user_id" | "created_at" | "updated_at">>
export type UpdateRow<T extends TableName> = Partial<Omit<Row<T>, MetaField>>
