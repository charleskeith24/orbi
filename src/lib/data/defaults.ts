/**
 * Default values for every table. `buildRow` merges caller values over these so
 * `insert("content_ideas", { title })` always produces a complete, valid row.
 */
import { DEFAULT_ENGAGEMENT_TASKS } from "@/lib/constants"
import type { Database, InsertRow, MetaField, Row, TableName } from "@/lib/types"
import { uid } from "@/lib/utils"

/** Insert order that satisfies foreign keys (parents before children). */
export const TABLE_NAMES: TableName[] = [
  "content_goals",
  "brand_profiles",
  "content_platforms",
  "content_pillars",
  "content_formats",
  "angles",
  "hooks",
  "tags",
  "audience_personas",
  "audience_problems",
  "content_campaigns",
  "content_series",
  "content_ideas",
  "content_items",
  "content_briefs",
  "content_scripts",
  "content_calendar",
  "content_metrics",
  "content_experiments",
  "content_repurposing",
  "stories",
  "research_items",
  "audience_questions",
  "content_tags",
  "weekly_reviews",
  "monthly_reviews",
  "ai_generations",
  "engagement_logs",
  "app_settings",
]

export function emptyDatabase(): Database {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, []])) as unknown as Database
}

type Defaults = { [T in TableName]: Omit<Row<T>, MetaField> }

export const TABLE_DEFAULTS: Defaults = {
  brand_profiles: {
    name: "",
    brand_name: "",
    role: "",
    industry: "",
    expertise_summary: "",
    years_experience: null,
    location: "",
    main_platforms: [],
    who_am_i: "",
    known_for: "",
    problems_solved: "",
    why_listen: "",
    point_of_view: "",
    positioning_audience: "",
    positioning_result: "",
    positioning_method: "",
    expertise_areas: [],
    personality_traits: [],
    language: "english",
    tones: ["conversational"],
    always_do: "",
    never_do: "",
    phrases_used: [],
    phrases_avoid: [],
    cta_style: "",
    storytelling_style: "",
    primary_goal_id: null,
    secondary_goal_id: null,
    onboarding_completed: false,
  },
  content_goals: {
    category: "awareness",
    name: "",
    description: "",
    kpis: [],
    target_metric: null,
    target_value: null,
    period: "monthly",
    is_active: true,
  },
  content_platforms: {
    platform: "facebook",
    is_active: true,
    handle: "",
    primary_goal_id: null,
    posting_frequency: 3,
    preferred_format_ids: [],
    preferred_pillar_ids: [],
    audience: "",
    cta_style: "",
    current_followers: null,
    notes: "",
  },
  audience_personas: {
    name: "",
    age_range: "",
    profession: "",
    industry: "",
    experience_level: "",
    location: "",
    goals: [],
    problems: [],
    fears: [],
    frustrations: [],
    aspirations: [],
    questions: [],
    objections: [],
    buying_motivation: "",
    content_consumed: [],
    platforms: [],
    influencers: [],
    language_used: [],
    is_primary: false,
    color: "blue",
    notes: "",
  },
  audience_problems: {
    persona_id: null,
    problem: "",
    category: "beginner",
    severity: 3,
    pillar_id: null,
    notes: "",
  },
  audience_questions: {
    question: "",
    source_person: "",
    platform: null,
    topic: "",
    frequency: 1,
    pillar_id: null,
    persona_id: null,
    status: "new",
    idea_id: null,
    content_item_id: null,
    last_asked_at: new Date().toISOString().slice(0, 10),
  },
  content_pillars: {
    name: "",
    description: "",
    color: "blue",
    icon: "Layers",
    target_percentage: 0,
    examples: [],
    sort_order: 0,
    is_active: true,
  },
  content_formats: {
    name: "",
    category: "video",
    description: "",
    script_format: "custom",
    is_default: false,
    sort_order: 0,
  },
  angles: { name: "", description: "", example: "", is_default: false },
  hooks: {
    text: "",
    category: "custom",
    is_template: false,
    source: "user",
    pillar_id: null,
    notes: "",
    is_favorite: false,
  },
  tags: { name: "", color: "gray" },
  content_tags: { tag_id: "", entity_type: "content_ideas", entity_id: "" },
  content_ideas: {
    title: "",
    core_topic: "",
    description: "",
    hook: "",
    hook_category: null,
    angle_id: null,
    pillar_id: null,
    persona_id: null,
    problem_id: null,
    goal_id: null,
    platforms: [],
    format_id: null,
    funnel_stage: null,
    inspiration: "",
    source: "manual",
    source_ref_id: null,
    priority: "medium",
    status: "inbox",
    scores: null,
    score: null,
    why_it_matters: "",
    talking_points: [],
    cta: "",
    campaign_id: null,
    series_id: null,
    converted_item_id: null,
  },
  content_items: {
    title: "",
    idea_id: null,
    pillar_id: null,
    persona_id: null,
    problem_id: null,
    goal_id: null,
    angle_id: null,
    hook_id: null,
    hook: "",
    hook_category: null,
    platform: "facebook",
    format_id: null,
    funnel_stage: null,
    stage: "idea",
    priority: "medium",
    owner: "",
    due_date: null,
    scheduled_at: null,
    published_at: null,
    published_url: "",
    thumbnail_url: "",
    campaign_id: null,
    series_id: null,
    parent_id: null,
    repurpose_type: null,
    quality_score: null,
    pinned_winner: false,
    why_it_worked: "",
    replication_ideas: [],
    notes: "",
  },
  content_briefs: {
    content_item_id: "",
    objective: "",
    main_message: "",
    supporting_points: [],
    cta: "",
    visual_direction: "",
    reference: "",
    caption: "",
    production_notes: "",
    b_roll: [],
    on_screen_text: [],
  },
  content_scripts: {
    content_item_id: "",
    format: "custom",
    title: "",
    sections: [],
    body: "",
    caption: "",
    hashtags: [],
    version: 1,
    is_current: true,
    generated_by: "manual",
  },
  content_calendar: {
    day_of_week: 1,
    label: "",
    pillar_id: null,
    format_id: null,
    platforms: [],
    time: null,
    sort_order: 0,
    is_active: true,
  },
  content_campaigns: {
    name: "",
    objective: "",
    description: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    persona_id: null,
    pillar_id: null,
    goal_id: null,
    platforms: [],
    message: "",
    status: "planning",
    target_posts: null,
    color: "blue",
  },
  content_series: {
    name: "",
    description: "",
    frequency: "weekly",
    day_of_week: null,
    platforms: [],
    pillar_id: null,
    format_id: null,
    hook_template: "",
    is_active: true,
  },
  content_metrics: {
    content_item_id: "",
    platform: "facebook",
    recorded_at: new Date().toISOString().slice(0, 10),
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    followers_gained: 0,
    profile_visits: 0,
    link_clicks: 0,
    leads: 0,
    sales: 0,
    watch_time_seconds: null,
    avg_retention: null,
    notes: "",
    source: "manual",
  },
  content_experiments: {
    name: "",
    hypothesis: "",
    variant_a: "",
    variant_b: "",
    metric: "engagement_rate",
    start_date: null,
    end_date: null,
    status: "planned",
    variant_a_item_ids: [],
    variant_b_item_ids: [],
    result: "",
    winner: null,
    lesson: "",
  },
  content_repurposing: {
    source_item_id: "",
    target_item_id: null,
    type: "facebook_post",
    platform: null,
    status: "suggested",
    title: "",
    draft: "",
  },
  stories: {
    type: "story",
    title: "",
    situation: "",
    problem: "",
    action: "",
    result: "",
    lesson: "",
    emotion: "",
    pillar_id: null,
    keywords: [],
    occurred_on: null,
    is_favorite: false,
  },
  research_items: {
    type: "post",
    title: "",
    url: "",
    source: "",
    creator: "",
    platform: null,
    topic: "",
    hook: "",
    content: "",
    why_attention: "",
    learnings: "",
    adaptation: "",
    analysis: null,
    status: "saved",
    pillar_id: null,
  },
  weekly_reviews: {
    week_start: new Date().toISOString().slice(0, 10),
    focus: "",
    stats: null,
    what_worked: "",
    what_didnt: "",
    learned: "",
    double_down: "",
    stop: "",
    test_next: "",
    planned_item_ids: [],
    status: "draft",
    generated_by: null,
  },
  monthly_reviews: {
    month: new Date().toISOString().slice(0, 8) + "01",
    stats: null,
    summary: "",
    continue_doing: [],
    increase: [],
    reduce: [],
    stop: [],
    experiment: [],
    status: "draft",
    generated_by: null,
  },
  ai_generations: {
    task: "",
    provider: "offline",
    model: "",
    input: null,
    output: null,
    entity_type: null,
    entity_id: null,
    status: "success",
    error: null,
    duration_ms: null,
  },
  engagement_logs: {
    date: new Date().toISOString().slice(0, 10),
    comments_replied: 0,
    dms_replied: 0,
    creator_comments: 0,
    questions_collected: 0,
    ideas_captured: 0,
    completed_tasks: [],
    notes: "",
  },
  app_settings: {
    weekly_post_target: 10,
    week_starts_on: 1,
    timezone: "Asia/Manila",
    buffer_healthy_days: 7,
    buffer_warning_days: 3,
    winner_metric: "views",
    winner_window: 20,
    winner_min_sample: 3,
    tier_good: 1.5,
    tier_winner: 2,
    tier_breakout: 3,
    funnel_targets: { tofu: 50, mofu: 35, bofu: 15 },
    engagement_tasks: DEFAULT_ENGAGEMENT_TASKS,
    default_owner: "",
    pillar_tolerance: 10,
  },
}

/** Date columns whose default is "today" in the user's local calendar, evaluated per insert. */
const LOCAL_DATE_DEFAULTS: Partial<Record<TableName, readonly string[]>> = {
  audience_questions: ["last_asked_at"],
  content_campaigns: ["start_date", "end_date"],
  content_metrics: ["recorded_at"],
  engagement_logs: ["date"],
  weekly_reviews: ["week_start"],
}

/** Deep-ish clone for defaults so array/object defaults are never shared between rows. */
function cloneDefault<T>(value: T): T {
  return value === null || typeof value !== "object" ? value : (JSON.parse(JSON.stringify(value)) as T)
}

/** Create a complete row from partial values. Undefined values fall back to defaults. */
export function buildRow<T extends TableName>(
  table: T,
  values: InsertRow<T>,
  userId: string,
  now: Date = new Date()
): Row<T> {
  const defaults = TABLE_DEFAULTS[table] as Record<string, unknown>
  const row: Record<string, unknown> = {}
  for (const key of Object.keys(defaults)) row[key] = cloneDefault(defaults[key])
  // Calendar-day defaults use the local day at insert time (the static defaults are UTC at module load).
  const pad = (n: number) => String(n).padStart(2, "0")
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  for (const key of LOCAL_DATE_DEFAULTS[table] ?? []) row[key] = today
  if (table === "monthly_reviews") row.month = `${today.slice(0, 8)}01`
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    if (value !== undefined) row[key] = value
  }
  const iso = now.toISOString()
  row.id = (values as { id?: string }).id ?? uid()
  row.user_id = userId
  row.created_at = (values as { created_at?: string }).created_at ?? iso
  row.updated_at = (values as { updated_at?: string }).updated_at ?? iso
  return row as unknown as Row<T>
}

/**
 * Fill any fields missing from a stored row (e.g. after a schema addition) so
 * older persisted data keeps working.
 */
export function normalizeRow<T extends TableName>(table: T, row: Row<T>): Row<T> {
  const defaults = TABLE_DEFAULTS[table] as Record<string, unknown>
  const out = { ...(row as unknown as Record<string, unknown>) }
  for (const key of Object.keys(defaults)) {
    if (out[key] === undefined) out[key] = cloneDefault(defaults[key])
  }
  return out as unknown as Row<T>
}

export function normalizeDatabase(db: Partial<Database>): Database {
  const out = emptyDatabase() as unknown as Record<TableName, unknown[]>
  for (const table of TABLE_NAMES) {
    const rows = (db[table] ?? []) as Row<typeof table>[]
    out[table] = rows.map((r) => normalizeRow(table, r))
  }
  return out as unknown as Database
}
