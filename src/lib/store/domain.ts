/**
 * Cross-feature domain operations. Features call these instead of stitching
 * several inserts/updates together, so side effects stay consistent everywhere
 * (e.g. converting an idea always creates a brief and marks the idea converted).
 */
import { CATEGORICAL_COLORS, PIPELINE_STAGE_ORDER, PUBLISHED_STAGES, REPURPOSE_TYPES, SCRIPT_FORMATS } from "@/lib/constants"
import { parseDate } from "@/lib/dates"
import { computeIdeaScore, priorityFromScore } from "@/lib/scoring"
import { useDataStore } from "@/lib/store/data-store"
import type {
  ContentBrief,
  ContentIdea,
  ContentItem,
  ContentMetric,
  ContentScript,
  Database,
  GeneratedBy,
  ID,
  IdeaScores,
  InsertRow,
  ISODate,
  ISODateTime,
  PipelineStage,
  PlatformId,
  RepurposeType,
  ScriptFormat,
  ScriptSection,
  Tag,
  TaggableEntity,
  UpdateRow,
} from "@/lib/types"

const store = () => useDataStore.getState()
const db = () => useDataStore.getState().db

/* ---------------------------------- Brand --------------------------------- */

export function updateBrand(patch: UpdateRow<"brand_profiles">) {
  const brand = db().brand_profiles[0]
  if (brand) store().update("brand_profiles", brand.id, patch)
  else store().insert("brand_profiles", patch)
}

export function updateSettings(patch: UpdateRow<"app_settings">) {
  const settings = db().app_settings[0]
  if (settings) store().update("app_settings", settings.id, patch)
  else store().insert("app_settings", patch)
}

/* ---------------------------------- Tags ---------------------------------- */

export function getEntityTagIds(database: Database, entityType: TaggableEntity, entityId: ID): ID[] {
  return database.content_tags
    .filter((l) => l.entity_type === entityType && l.entity_id === entityId)
    .map((l) => l.tag_id)
}

/** Make an entity's tags exactly `tagIds` (adds and removes links). */
export function setEntityTags(entityType: TaggableEntity, entityId: ID, tagIds: ID[]) {
  const existing = db().content_tags.filter((l) => l.entity_type === entityType && l.entity_id === entityId)
  const wanted = new Set(tagIds)
  const have = new Set(existing.map((l) => l.tag_id))
  const toRemove = existing.filter((l) => !wanted.has(l.tag_id)).map((l) => l.id)
  const toAdd = [...wanted].filter((id) => !have.has(id))
  if (toRemove.length) store().remove("content_tags", toRemove)
  if (toAdd.length) {
    store().insertMany(
      "content_tags",
      toAdd.map((tag_id) => ({ tag_id, entity_type: entityType, entity_id: entityId }))
    )
  }
}

/** Find a tag by name (case-insensitive, "#" optional) or create it. */
export function ensureTag(name: string): Tag {
  const clean = name.replace(/^#/, "").trim().toLowerCase().replace(/\s+/g, "-")
  const existing = db().tags.find((t) => t.name.toLowerCase() === clean)
  if (existing) return existing
  const color = CATEGORICAL_COLORS[db().tags.length % CATEGORICAL_COLORS.length]
  return store().insert("tags", { name: clean, color })
}

/* ---------------------------------- Ideas --------------------------------- */

/** Insert an idea, deriving `score` and `priority` from `scores` when given. */
export function createIdea(values: InsertRow<"content_ideas">): ContentIdea {
  const scores = values.scores ?? null
  const score = values.score ?? (scores ? computeIdeaScore(scores) : null)
  const priority = values.priority ?? (score !== null ? priorityFromScore(score) : "medium")
  return store().insert("content_ideas", { ...values, scores, score, priority })
}

export function setIdeaScores(ideaId: ID, scores: IdeaScores, options: { updatePriority?: boolean } = {}) {
  const score = computeIdeaScore(scores)
  const patch: UpdateRow<"content_ideas"> = { scores, score }
  if (options.updatePriority ?? true) patch.priority = priorityFromScore(score)
  store().update("content_ideas", ideaId, patch)
}

/* ------------------------------ Content items ----------------------------- */

/** Pick the content format row whose default script structure matches. */
export function formatIdForScriptFormat(database: Database, scriptFormat: ScriptFormat): ID | null {
  return database.content_formats.find((f) => f.script_format === scriptFormat)?.id ?? null
}

/** Create a content item together with its (empty or prefilled) brief. */
export function createContentItem(
  values: InsertRow<"content_items">,
  brief: InsertRow<"content_briefs"> = {}
): ContentItem {
  const settings = db().app_settings[0]
  const item = store().insert("content_items", { owner: settings?.default_owner ?? "", ...values })
  store().insert("content_briefs", { ...brief, content_item_id: item.id })
  return item
}

export function ensureBrief(itemId: ID): ContentBrief {
  return db().content_briefs.find((b) => b.content_item_id === itemId) ?? store().insert("content_briefs", { content_item_id: itemId })
}

export interface ConvertIdeaOptions {
  platforms?: PlatformId[]
  stage?: PipelineStage
  due_date?: ISODate | null
  scheduled_at?: ISODateTime | null
  campaign_id?: ID | null
}

/** Idea → one content item per platform (spec: Idea Bank → Content Brief). Marks the idea converted. */
export function convertIdeaToContent(ideaId: ID, options: ConvertIdeaOptions = {}): ContentItem[] {
  const database = db()
  const idea = database.content_ideas.find((i) => i.id === ideaId)
  if (!idea) throw new Error("Idea not found")
  const brand = database.brand_profiles[0]
  const platforms: PlatformId[] = options.platforms?.length
    ? options.platforms
    : idea.platforms.length
      ? idea.platforms
      : [brand?.main_platforms[0] ?? "facebook"]

  const items = platforms.map((platform) =>
    createContentItem(
      {
        title: idea.title,
        idea_id: idea.id,
        pillar_id: idea.pillar_id,
        persona_id: idea.persona_id,
        problem_id: idea.problem_id,
        goal_id: idea.goal_id,
        angle_id: idea.angle_id,
        hook: idea.hook,
        hook_category: idea.hook_category,
        platform,
        format_id: idea.format_id,
        funnel_stage: idea.funnel_stage,
        stage: options.stage ?? "brief",
        priority: idea.priority,
        due_date: options.due_date ?? null,
        scheduled_at: options.scheduled_at ?? null,
        campaign_id: options.campaign_id ?? idea.campaign_id,
        series_id: idea.series_id,
      },
      {
        objective: idea.why_it_matters,
        main_message: idea.description || idea.core_topic,
        supporting_points: idea.talking_points,
        cta: idea.cta,
        reference: idea.inspiration,
      }
    )
  )

  store().update("content_ideas", idea.id, { status: "converted", converted_item_id: items[0]?.id ?? null })
  const tagIds = getEntityTagIds(database, "content_ideas", idea.id)
  if (tagIds.length) for (const item of items) setEntityTags("content_items", item.id, tagIds)
  return items
}

/** Move an item through the pipeline, keeping publish timestamps consistent. */
export function moveItemToStage(itemId: ID, stage: PipelineStage) {
  const item = db().content_items.find((i) => i.id === itemId)
  if (!item || item.stage === stage) return
  const patch: UpdateRow<"content_items"> = { stage }
  const isPublished = PUBLISHED_STAGES.includes(stage)
  if (isPublished && !item.published_at) {
    const scheduled = parseDate(item.scheduled_at)
    patch.published_at = scheduled && scheduled <= new Date() ? item.scheduled_at : new Date().toISOString()
  }
  if (!isPublished && item.published_at) patch.published_at = null
  store().update("content_items", itemId, patch)
}

/** Set the planned publish time. Ready-to-post items become Scheduled. */
export function scheduleItem(itemId: ID, when: Date | ISODateTime) {
  const item = db().content_items.find((i) => i.id === itemId)
  if (!item) return
  const iso = when instanceof Date ? when.toISOString() : when
  if (PUBLISHED_STAGES.includes(item.stage)) {
    store().update("content_items", itemId, { published_at: iso })
    return
  }
  const patch: UpdateRow<"content_items"> = { scheduled_at: iso }
  if (item.stage === "ready_to_post") patch.stage = "scheduled"
  store().update("content_items", itemId, patch)
}

export function unscheduleItem(itemId: ID) {
  const item = db().content_items.find((i) => i.id === itemId)
  if (!item) return
  store().update("content_items", itemId, {
    scheduled_at: null,
    ...(item.stage === "scheduled" ? { stage: "ready_to_post" as const } : {}),
  })
}

export type MetricValues = Partial<Omit<ContentMetric, "id" | "user_id" | "created_at" | "updated_at" | "content_item_id" | "platform">>

/** Record an analytics snapshot. Unpublished items are marked published. */
export function logMetrics(itemId: ID, values: MetricValues): ContentMetric {
  const item = db().content_items.find((i) => i.id === itemId)
  if (!item) throw new Error("Content item not found")
  const metric = store().insert("content_metrics", { ...values, content_item_id: itemId, platform: item.platform })
  if (!PUBLISHED_STAGES.includes(item.stage)) moveItemToStage(itemId, "published")
  return metric
}

/** Log a post that was published outside the app (spec §32 "Log Published Post"). */
export function logPublishedPost(input: { item: InsertRow<"content_items">; metrics?: MetricValues | null }): ContentItem {
  const item = createContentItem({
    ...input.item,
    stage: input.item.stage ?? "published",
    published_at: input.item.published_at ?? new Date().toISOString(),
  })
  const metrics = input.metrics
  if (metrics && Object.values(metrics).some((v) => typeof v === "number" && v > 0)) {
    store().insert("content_metrics", { ...metrics, content_item_id: item.id, platform: item.platform })
  }
  return item
}

/* --------------------------------- Scripts -------------------------------- */

export function getCurrentScript(database: Database, itemId: ID, format?: ScriptFormat): ContentScript | undefined {
  const scripts = database.content_scripts.filter(
    (s) => s.content_item_id === itemId && s.is_current && (!format || s.format === format)
  )
  return scripts.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
}

/** Join sections into postable copy (labels omitted). */
export function renderScriptBody(sections: ScriptSection[]): string {
  return sections
    .map((s) => s.content.trim())
    .filter(Boolean)
    .join("\n\n")
}

/** Save a new version of an item's script for a format; previous versions stay in history. */
export function saveScriptVersion(
  itemId: ID,
  values: {
    format: ScriptFormat
    sections: ScriptSection[]
    title?: string
    caption?: string
    hashtags?: string[]
    generated_by: GeneratedBy
  }
): ContentScript {
  const existing = db().content_scripts.filter((s) => s.content_item_id === itemId && s.format === values.format)
  const current = existing.filter((s) => s.is_current)
  if (current.length) {
    store().updateMany(
      "content_scripts",
      current.map((s) => ({ id: s.id, patch: { is_current: false } }))
    )
  }
  const version = existing.reduce((max, s) => Math.max(max, s.version), 0) + 1
  return store().insert("content_scripts", {
    content_item_id: itemId,
    format: values.format,
    title: values.title ?? SCRIPT_FORMATS[values.format].label,
    sections: values.sections,
    body: renderScriptBody(values.sections),
    caption: values.caption ?? "",
    hashtags: values.hashtags ?? [],
    version,
    is_current: true,
    generated_by: values.generated_by,
  })
}

/** Empty sections for a script format, ready to fill in. */
export function blankSections(format: ScriptFormat): ScriptSection[] {
  return SCRIPT_FORMATS[format].sections.map((s) => ({ key: s.key, label: s.label, content: "" }))
}

/* ------------------------------- Repurposing ------------------------------ */

/**
 * Create a new content item derived from a published piece (spec §23) and
 * record it in `content_repurposing` so the Content Tree can draw it.
 */
export function createRepurposedItem(
  sourceItemId: ID,
  type: RepurposeType,
  draft: {
    title?: string
    sections?: ScriptSection[]
    platform?: PlatformId
    generated_by?: GeneratedBy
    /** The content_repurposing suggestion this item fulfils (defaults to an open suggestion of the same type). */
    suggestionId?: ID
  } = {}
): ContentItem {
  const database = db()
  const source = database.content_items.find((i) => i.id === sourceItemId)
  if (!source) throw new Error("Source content not found")
  const spec = REPURPOSE_TYPES[type]
  const platform = draft.platform ?? spec.platform ?? source.platform
  const hookSection = draft.sections?.find((s) => s.key === "hook" || s.key === "slide_1" || s.key === "subject")

  const item = createContentItem({
    title: draft.title ?? `${source.title} — ${spec.label}`,
    idea_id: source.idea_id,
    pillar_id: source.pillar_id,
    persona_id: source.persona_id,
    problem_id: source.problem_id,
    goal_id: source.goal_id,
    angle_id: source.angle_id,
    hook: hookSection?.content ?? source.hook,
    hook_category: source.hook_category,
    platform,
    format_id: formatIdForScriptFormat(database, spec.scriptFormat) ?? source.format_id,
    funnel_stage: source.funnel_stage,
    stage: draft.sections?.length ? "scripting" : "brief",
    priority: source.priority,
    campaign_id: source.campaign_id,
    series_id: source.series_id,
    parent_id: source.id,
    repurpose_type: type,
  })

  if (draft.sections?.length) {
    saveScriptVersion(item.id, { format: spec.scriptFormat, sections: draft.sections, generated_by: draft.generated_by ?? "manual" })
  }

  const suggestion =
    (draft.suggestionId ? database.content_repurposing.find((r) => r.id === draft.suggestionId) : undefined) ??
    database.content_repurposing.find(
      (r) =>
        r.source_item_id === source.id &&
        r.type === type &&
        !r.target_item_id &&
        (r.status === "suggested" || r.status === "drafted")
    )
  const draftText = draft.sections ? renderScriptBody(draft.sections) : ""
  if (suggestion) {
    store().update("content_repurposing", suggestion.id, { status: "created", target_item_id: item.id, platform, draft: draftText || suggestion.draft })
  } else {
    store().insert("content_repurposing", {
      source_item_id: source.id,
      target_item_id: item.id,
      type,
      platform,
      status: "created",
      title: item.title,
      draft: draftText,
    })
  }
  return item
}

/** Copy an item (brief + current scripts) back to the start of production. */
export function duplicateContentItem(itemId: ID): ContentItem {
  const database = db()
  const source = database.content_items.find((i) => i.id === itemId)
  if (!source) throw new Error("Content item not found")
  const { id: _id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = source
  void _id
  void _u
  void _c
  void _up
  const brief = database.content_briefs.find((b) => b.content_item_id === itemId)
  const briefValues: InsertRow<"content_briefs"> = {}
  if (brief) {
    const { id: _bid, user_id: _bu, created_at: _bc, updated_at: _bup, content_item_id: _bi, ...briefRest } = brief
    void _bid
    void _bu
    void _bc
    void _bup
    void _bi
    Object.assign(briefValues, briefRest)
  }
  const copy = createContentItem(
    {
      ...rest,
      title: `${source.title} (copy)`,
      stage: PIPELINE_STAGE_ORDER[source.stage] >= PIPELINE_STAGE_ORDER.published ? "brief" : source.stage,
      scheduled_at: null,
      published_at: null,
      published_url: "",
      quality_score: null,
      pinned_winner: false,
      why_it_worked: "",
      replication_ideas: [],
    },
    briefValues
  )
  for (const script of database.content_scripts.filter((s) => s.content_item_id === itemId && s.is_current)) {
    saveScriptVersion(copy.id, {
      format: script.format,
      sections: script.sections,
      title: script.title,
      caption: script.caption,
      hashtags: script.hashtags,
      generated_by: script.generated_by,
    })
  }
  return copy
}
