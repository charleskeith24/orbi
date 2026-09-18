/**
 * Search index for the command palette: pure builders (one per entity kind, so the palette can memoize
 * per table) and a small ranked matcher over normalized fields. Scores are comparable across kinds, so
 * the palette can order its groups by their best hit.
 */
import {
  CAMPAIGN_STATUS_MAP,
  DEAL_STATUS_MAP,
  EXPERIMENT_METRIC_MAP,
  EXPERIMENT_STATUS_MAP,
  HOOK_CATEGORIES,
  IDEA_STATUS_MAP,
  PIPELINE_STAGE_MAP,
  PLATFORMS,
  PROBLEM_CATEGORY_MAP,
  PUBLISHED_STAGES,
  QUESTION_STATUS_MAP,
  RESEARCH_TYPE_MAP,
  SERIES_FREQUENCY_MAP,
  STORY_TYPE_MAP,
} from "@/lib/constants"
import { searchDocMessages } from "@/components/app-shell/command-palette-messages"
import { contentItemDate, formatDate, formatShortDate } from "@/lib/dates"
import { translator, type UiLang } from "@/lib/i18n/core"
import type {
  AudiencePersona,
  AudienceProblem,
  AudienceQuestion,
  BrandDeal,
  ContentAngle,
  ContentCampaign,
  ContentExperiment,
  ContentIdea,
  ContentItem,
  ContentMetric,
  ContentPillar,
  ContentScript,
  ContentSeries,
  Hook,
  ID,
  ResearchItem,
  Story,
} from "@/lib/types"
import { formatCompact, formatMoney, formatNumber } from "@/lib/utils"

/** Entity kinds the palette searches. */
export type SearchKind =
  | "content"
  | "idea"
  | "hook"
  | "angle"
  | "story"
  | "campaign"
  | "series"
  | "pillar"
  | "persona"
  | "problem"
  | "question"
  | "research"
  | "experiment"
  | "deal"
  | "topic"
  | "analytics"

export interface SearchField {
  text: string
  weight: number
}

export interface SearchDoc {
  /** Unique palette value: `<kind>:<id>`. */
  key: string
  kind: SearchKind
  id: string
  title: string
  /** Context line (platform · stage · pillar …). */
  secondary: string
  /** Right-aligned hint (date, score, views …). */
  hint: string
  href: string
  updatedAt: string
  /** Normalized searchable text, title first. */
  fields: SearchField[]
}

export interface SearchHit {
  doc: SearchDoc
  score: number
}

export type SearchIndex = Record<SearchKind, SearchDoc[]>

const MAX_FIELD_LENGTH = 4000
const WORD_CHAR = /[\p{L}\p{N}]/u
/** Tokens shorter than this only match at word starts ("ads" must not hit "leads"). */
const MIN_INFIX_TOKEN = 4

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export function tokenize(query: string): string[] {
  return normalizeText(query).split(" ").filter(Boolean)
}

function field(text: string | null | undefined, weight: number): SearchField[] {
  const normalized = normalizeText(text ?? "")
  return normalized ? [{ text: normalized.slice(0, MAX_FIELD_LENGTH), weight }] : []
}

/** 1 = the field starts with the token, 0.75 = a word starts with it, 0.4 = inside a word (long tokens only), 0 = absent. */
function matchQuality(text: string, token: string): number {
  let index = text.indexOf(token)
  if (index === -1) return 0
  if (index === 0) return 1
  for (let guard = 0; index !== -1 && guard < 32; guard++) {
    if (!WORD_CHAR.test(text[index - 1])) return 0.75
    index = text.indexOf(token, index + 1)
  }
  return token.length >= MIN_INFIX_TOKEN ? 0.4 : 0
}

/** Every token must match some field (AND). Weights favor the title; phrase matches on the title add a bonus. */
export function scoreFields(tokens: string[], fields: SearchField[]): number {
  if (!tokens.length || !fields.length) return 0
  let score = 0
  for (const token of tokens) {
    let best = 0
    for (const f of fields) best = Math.max(best, matchQuality(f.text, token) * f.weight)
    if (best === 0) return 0
    score += best
  }
  const [title] = fields
  const phrase = tokens.join(" ")
  if (title.text === phrase) score += 2 * title.weight
  else if (title.text.startsWith(phrase)) score += title.weight
  else if (tokens.length > 1 && title.text.includes(phrase)) score += title.weight / 2
  return score
}

/** Ranked matches with their scores: best first, most recently updated on ties. */
export function searchScored(docs: SearchDoc[], query: string, limit = 6): SearchHit[] {
  const tokens = tokenize(query)
  if (!tokens.length) return []
  const hits: SearchHit[] = []
  for (const doc of docs) {
    const score = scoreFields(tokens, doc.fields)
    if (score > 0) hits.push({ doc, score })
  }
  hits.sort((a, b) => b.score - a.score || b.doc.updatedAt.localeCompare(a.doc.updatedAt))
  return hits.slice(0, limit)
}

/** Ranked matches: best score first, most recently updated on ties. */
export function searchDocs(docs: SearchDoc[], query: string, limit = 6): SearchDoc[] {
  return searchScored(docs, query, limit).map((hit) => hit.doc)
}

/** Most recently updated documents. */
export function recentDocs(docs: SearchDoc[], limit = 5): SearchDoc[] {
  return [...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit)
}

const joinParts = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ")
const pillarName = (names: Map<ID, string>, id: ID | null) => (id ? names.get(id) : undefined)

/** Current script body per content item (all current formats joined). */
export function currentScriptBodies(scripts: ContentScript[]): Map<ID, string> {
  const bodies = new Map<ID, string>()
  for (const script of scripts) {
    if (!script.is_current || !script.body) continue
    const previous = bodies.get(script.content_item_id)
    bodies.set(script.content_item_id, previous ? `${previous} ${script.body}` : script.body)
  }
  return bodies
}

export function buildContentDocs(
  items: ContentItem[],
  pillarNames: Map<ID, string>,
  scriptBodies: Map<ID, string>,
  lang: UiLang = "en"
): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return items.map((item): SearchDoc => {
    const date = contentItemDate(item)
    return {
      key: `content:${item.id}`,
      kind: "content",
      id: item.id,
      title: item.title || t("untitled_content"),
      secondary: joinParts(
        PLATFORMS[item.platform]?.label,
        PIPELINE_STAGE_MAP[item.stage]?.label,
        pillarName(pillarNames, item.pillar_id)
      ),
      hint: date ? formatShortDate(date) : "",
      href: `/studio/${item.id}`,
      updatedAt: item.updated_at,
      fields: [
        ...field(item.title, 3),
        ...field(item.hook, 2),
        ...field(item.notes, 1),
        ...field(scriptBodies.get(item.id), 1),
      ],
    }
  })
}

export function buildIdeaDocs(ideas: ContentIdea[], pillarNames: Map<ID, string>, lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return ideas.map(
    (idea): SearchDoc => ({
      key: `idea:${idea.id}`,
      kind: "idea",
      id: idea.id,
      title: idea.title || t("untitled_idea"),
      secondary: joinParts(IDEA_STATUS_MAP[idea.status]?.label, pillarName(pillarNames, idea.pillar_id), idea.core_topic),
      hint: idea.score !== null ? t("score", { score: Math.round(idea.score) }) : "",
      href: `/ideas?open=${idea.id}`,
      updatedAt: idea.updated_at,
      fields: [
        ...field(idea.title, 3),
        ...field(idea.core_topic, 2),
        ...field(idea.hook, 2),
        ...field(idea.description, 1),
        ...field(idea.talking_points.join(" "), 1),
        ...field(idea.why_it_matters, 1),
      ],
    })
  )
}

export function buildHookDocs(hooks: Hook[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return hooks.map(
    (hook): SearchDoc => ({
      key: `hook:${hook.id}`,
      kind: "hook",
      id: hook.id,
      title: hook.text || t("untitled_hook"),
      secondary: joinParts(HOOK_CATEGORIES[hook.category]?.label, hook.is_template && t("template")),
      hint: hook.is_favorite ? t("favorite") : "",
      href: `/ideas/hooks?open=${hook.id}`,
      updatedAt: hook.updated_at,
      fields: [...field(hook.text, 3), ...field(hook.notes, 1)],
    })
  )
}

export function buildAngleDocs(angles: ContentAngle[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return angles.map(
    (angle): SearchDoc => ({
      key: `angle:${angle.id}`,
      kind: "angle",
      id: angle.id,
      title: angle.name || t("untitled_angle"),
      secondary: angle.description,
      hint: "",
      href: `/ideas/angles?open=${angle.id}`,
      updatedAt: angle.updated_at,
      fields: [...field(angle.name, 3), ...field(angle.description, 1), ...field(angle.example, 1)],
    })
  )
}

export function buildStoryDocs(stories: Story[], pillarNames: Map<ID, string>, lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return stories.map(
    (story): SearchDoc => ({
      key: `story:${story.id}`,
      kind: "story",
      id: story.id,
      title: story.title || t("untitled_story"),
      secondary: joinParts(STORY_TYPE_MAP[story.type]?.label, pillarName(pillarNames, story.pillar_id)),
      hint: story.occurred_on ? formatDate(story.occurred_on, "MMM yyyy") : "",
      href: `/stories?open=${story.id}`,
      updatedAt: story.updated_at,
      fields: [
        ...field(story.title, 3),
        ...field(story.keywords.join(" "), 2),
        ...field(story.lesson, 1),
        ...field([story.situation, story.problem, story.action, story.result, story.emotion].join(" "), 1),
      ],
    })
  )
}

export function buildCampaignDocs(campaigns: ContentCampaign[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return campaigns.map(
    (campaign): SearchDoc => ({
      key: `campaign:${campaign.id}`,
      kind: "campaign",
      id: campaign.id,
      title: campaign.name || t("untitled_campaign"),
      secondary: joinParts(
        CAMPAIGN_STATUS_MAP[campaign.status]?.label,
        campaign.start_date && campaign.end_date
          ? `${formatShortDate(campaign.start_date)} – ${formatShortDate(campaign.end_date)}`
          : null
      ),
      hint: "",
      href: `/campaigns/${campaign.id}`,
      updatedAt: campaign.updated_at,
      fields: [
        ...field(campaign.name, 3),
        ...field(campaign.objective, 2),
        ...field(campaign.message, 1),
        ...field(campaign.description, 1),
      ],
    })
  )
}

export function buildSeriesDocs(series: ContentSeries[], pillarNames: Map<ID, string>, lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return series.map(
    (entry): SearchDoc => ({
      key: `series:${entry.id}`,
      kind: "series",
      id: entry.id,
      title: entry.name || t("untitled_series"),
      secondary: joinParts(
        SERIES_FREQUENCY_MAP[entry.frequency]?.label,
        pillarName(pillarNames, entry.pillar_id),
        !entry.is_active && t("paused")
      ),
      hint: "",
      href: `/series?open=${entry.id}`,
      updatedAt: entry.updated_at,
      fields: [...field(entry.name, 3), ...field(entry.description, 1), ...field(entry.hook_template, 1)],
    })
  )
}

export function buildPillarDocs(pillars: ContentPillar[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return pillars.map(
    (pillar): SearchDoc => ({
      key: `pillar:${pillar.id}`,
      kind: "pillar",
      id: pillar.id,
      title: pillar.name || t("untitled_pillar"),
      secondary: joinParts(t("share_of_mix", { pct: Math.round(pillar.target_percentage) }), !pillar.is_active && t("inactive")),
      hint: "",
      href: `/pillars?open=${pillar.id}`,
      updatedAt: pillar.updated_at,
      fields: [...field(pillar.name, 3), ...field(pillar.description, 1), ...field(pillar.examples.join(" "), 1)],
    })
  )
}

export function buildPersonaDocs(personas: AudiencePersona[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return personas.map(
    (persona): SearchDoc => ({
      key: `persona:${persona.id}`,
      kind: "persona",
      id: persona.id,
      title: persona.name || t("untitled_persona"),
      secondary: joinParts(persona.profession, persona.industry),
      hint: persona.is_primary ? t("primary") : "",
      href: `/audience?open=${persona.id}`,
      updatedAt: persona.updated_at,
      fields: [
        ...field(persona.name, 3),
        ...field([persona.profession, persona.industry].join(" "), 2),
        ...field([...persona.goals, ...persona.problems, ...persona.frustrations, ...persona.language_used].join(" "), 1),
        ...field(persona.notes, 1),
      ],
    })
  )
}

export function buildResearchDocs(research: ResearchItem[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return research.map(
    (item): SearchDoc => ({
      key: `research:${item.id}`,
      kind: "research",
      id: item.id,
      title: item.title || item.url || t("untitled_reference"),
      secondary: joinParts(
        RESEARCH_TYPE_MAP[item.type]?.label,
        item.platform ? PLATFORMS[item.platform]?.label : null,
        item.creator
      ),
      hint: "",
      href: `/research?open=${item.id}`,
      updatedAt: item.updated_at,
      fields: [
        ...field(item.title, 3),
        ...field(item.hook, 2),
        ...field(item.topic, 2),
        ...field(item.creator, 1),
        ...field([item.source, item.why_attention, item.learnings, item.adaptation].join(" "), 1),
        ...field(item.content, 1),
      ],
    })
  )
}

export function buildProblemDocs(problems: AudienceProblem[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return problems.map(
    (problem): SearchDoc => ({
      key: `problem:${problem.id}`,
      kind: "problem",
      id: problem.id,
      title: problem.problem || t("untitled_problem"),
      secondary: joinParts(PROBLEM_CATEGORY_MAP[problem.category]?.label, t("severity", { severity: problem.severity })),
      hint: "",
      href: `/audience/problems?open=${problem.id}`,
      updatedAt: problem.updated_at,
      fields: [...field(problem.problem, 3), ...field(problem.notes, 1)],
    })
  )
}

export function buildQuestionDocs(questions: AudienceQuestion[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return questions.map(
    (question): SearchDoc => ({
      key: `question:${question.id}`,
      kind: "question",
      id: question.id,
      title: question.question || t("untitled_question"),
      secondary: joinParts(
        QUESTION_STATUS_MAP[question.status]?.label,
        question.topic,
        question.frequency > 1 && t("asked", { count: question.frequency })
      ),
      hint: "",
      href: `/audience/questions?open=${question.id}`,
      updatedAt: question.updated_at,
      fields: [...field(question.question, 3), ...field(question.topic, 2), ...field(question.source_person, 1)],
    })
  )
}

export function buildExperimentDocs(experiments: ContentExperiment[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return experiments.map(
    (experiment): SearchDoc => ({
      key: `experiment:${experiment.id}`,
      kind: "experiment",
      id: experiment.id,
      title: experiment.name || t("untitled_experiment"),
      secondary: joinParts(
        EXPERIMENT_STATUS_MAP[experiment.status]?.label,
        EXPERIMENT_METRIC_MAP[experiment.metric]?.label
      ),
      hint: "",
      href: `/experiments?open=${experiment.id}`,
      updatedAt: experiment.updated_at,
      fields: [
        ...field(experiment.name, 3),
        ...field(experiment.hypothesis, 2),
        ...field([experiment.variant_a, experiment.variant_b, experiment.result, experiment.lesson].join(" "), 1),
      ],
    })
  )
}

/** Distinct idea topics (case-insensitive) → the Idea Bank filtered by that topic. */
export function buildTopicDocs(ideas: ContentIdea[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  const topics = new Map<string, { label: string; count: number; updatedAt: string }>()
  for (const idea of ideas) {
    const label = idea.core_topic.trim()
    if (!label) continue
    const key = normalizeText(label)
    const current = topics.get(key)
    if (current) {
      current.count += 1
      if (idea.updated_at > current.updatedAt) current.updatedAt = idea.updated_at
    } else {
      topics.set(key, { label, count: 1, updatedAt: idea.updated_at })
    }
  }
  return [...topics.entries()].map(
    ([key, topic]): SearchDoc => ({
      key: `topic:${key}`,
      kind: "topic",
      id: key,
      title: topic.label,
      secondary: t.plural("ideas", topic.count, { count: formatNumber(topic.count) }),
      hint: t("topic"),
      href: `/ideas?q=${encodeURIComponent(topic.label)}`,
      updatedAt: topic.updatedAt,
      fields: field(topic.label, 3),
    })
  )
}

/** Published items that have at least one metrics snapshot (latest snapshot supplies the views hint). */
export function buildAnalyticsDocs(items: ContentItem[], metrics: ContentMetric[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  const latest = new Map<ID, ContentMetric>()
  for (const metric of metrics) {
    const current = latest.get(metric.content_item_id)
    if (
      !current ||
      metric.recorded_at > current.recorded_at ||
      (metric.recorded_at === current.recorded_at && metric.created_at > current.created_at)
    ) {
      latest.set(metric.content_item_id, metric)
    }
  }
  const docs: SearchDoc[] = []
  for (const item of items) {
    const metric = latest.get(item.id)
    if (!metric || !(item.published_at || PUBLISHED_STAGES.includes(item.stage))) continue
    docs.push({
      key: `analytics:${item.id}`,
      kind: "analytics",
      id: item.id,
      title: item.title || t("untitled_post"),
      secondary: joinParts(PLATFORMS[item.platform]?.label, item.published_at ? formatShortDate(item.published_at) : null),
      hint: t("views", { views: formatCompact(metric.views) }),
      href: `/analytics/posts?open=${item.id}`,
      updatedAt: metric.updated_at > item.updated_at ? metric.updated_at : item.updated_at,
      fields: [...field(item.title, 3), ...field(item.hook, 2)],
    })
  }
  return docs
}

/** Brand deals → `/money/deals?open=<id>`, found by brand, contact, deliverables and notes. */
export function buildDealDocs(deals: BrandDeal[], lang: UiLang = "en"): SearchDoc[] {
  const t = translator(searchDocMessages, lang)
  return deals.map(
    (deal): SearchDoc => ({
      key: `deal:${deal.id}`,
      kind: "deal",
      id: deal.id,
      title: deal.brand_name || t("untitled_deal"),
      secondary: joinParts(
        DEAL_STATUS_MAP[deal.status]?.label,
        deal.fee !== null ? formatMoney(deal.fee, deal.currency) : null,
        deal.platforms.map((p) => PLATFORMS[p]?.label).filter(Boolean).join(", ")
      ),
      hint: deal.due_date ? formatShortDate(deal.due_date) : "",
      href: `/money/deals?open=${deal.id}`,
      updatedAt: deal.updated_at,
      fields: [
        ...field(deal.brand_name, 3),
        ...field([deal.contact_name, deal.contact_handle, deal.contact_email].join(" "), 2),
        ...field(deal.deliverables.join(" "), 1),
        ...field([deal.notes, deal.usage_rights].join(" "), 1),
      ],
    })
  )
}

export interface SearchSources {
  items: ContentItem[]
  ideas: ContentIdea[]
  hooks: Hook[]
  angles: ContentAngle[]
  stories: Story[]
  campaigns: ContentCampaign[]
  series: ContentSeries[]
  pillars: ContentPillar[]
  personas: AudiencePersona[]
  problems: AudienceProblem[]
  questions: AudienceQuestion[]
  research: ResearchItem[]
  experiments: ContentExperiment[]
  deals: BrandDeal[]
  scripts: ContentScript[]
  metrics: ContentMetric[]
}

/** Whole index in one call (the palette memoizes per kind instead). */
export function buildSearchIndex(sources: SearchSources, lang: UiLang = "en"): SearchIndex {
  const pillarNames = new Map(sources.pillars.map((p) => [p.id, p.name]))
  return {
    content: buildContentDocs(sources.items, pillarNames, currentScriptBodies(sources.scripts), lang),
    idea: buildIdeaDocs(sources.ideas, pillarNames, lang),
    hook: buildHookDocs(sources.hooks, lang),
    angle: buildAngleDocs(sources.angles, lang),
    story: buildStoryDocs(sources.stories, pillarNames, lang),
    campaign: buildCampaignDocs(sources.campaigns, lang),
    series: buildSeriesDocs(sources.series, pillarNames, lang),
    pillar: buildPillarDocs(sources.pillars, lang),
    persona: buildPersonaDocs(sources.personas, lang),
    problem: buildProblemDocs(sources.problems, lang),
    question: buildQuestionDocs(sources.questions, lang),
    research: buildResearchDocs(sources.research, lang),
    experiment: buildExperimentDocs(sources.experiments, lang),
    deal: buildDealDocs(sources.deals, lang),
    topic: buildTopicDocs(sources.ideas, lang),
    analytics: buildAnalyticsDocs(sources.items, sources.metrics, lang),
  }
}
