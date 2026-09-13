/**
 * Search index for the command palette: pure builders (one per entity kind, so the palette can memoize
 * per table) and a small ranked matcher over normalized fields. Scores are comparable across kinds, so
 * the palette can order its groups by their best hit.
 */
import {
  CAMPAIGN_STATUS_MAP,
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
import { contentItemDate, formatDate, formatShortDate } from "@/lib/dates"
import type {
  AudiencePersona,
  AudienceProblem,
  AudienceQuestion,
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
import { formatCompact, pluralize } from "@/lib/utils"

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

export function buildContentDocs(items: ContentItem[], pillarNames: Map<ID, string>, scriptBodies: Map<ID, string>): SearchDoc[] {
  return items.map((item): SearchDoc => {
    const date = contentItemDate(item)
    return {
      key: `content:${item.id}`,
      kind: "content",
      id: item.id,
      title: item.title || "Untitled content",
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

export function buildIdeaDocs(ideas: ContentIdea[], pillarNames: Map<ID, string>): SearchDoc[] {
  return ideas.map(
    (idea): SearchDoc => ({
      key: `idea:${idea.id}`,
      kind: "idea",
      id: idea.id,
      title: idea.title || "Untitled idea",
      secondary: joinParts(IDEA_STATUS_MAP[idea.status]?.label, pillarName(pillarNames, idea.pillar_id), idea.core_topic),
      hint: idea.score !== null ? `Score ${Math.round(idea.score)}` : "",
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

export function buildHookDocs(hooks: Hook[]): SearchDoc[] {
  return hooks.map(
    (hook): SearchDoc => ({
      key: `hook:${hook.id}`,
      kind: "hook",
      id: hook.id,
      title: hook.text || "Untitled hook",
      secondary: joinParts(HOOK_CATEGORIES[hook.category]?.label, hook.is_template && "Template"),
      hint: hook.is_favorite ? "Favorite" : "",
      href: `/ideas/hooks?open=${hook.id}`,
      updatedAt: hook.updated_at,
      fields: [...field(hook.text, 3), ...field(hook.notes, 1)],
    })
  )
}

export function buildAngleDocs(angles: ContentAngle[]): SearchDoc[] {
  return angles.map(
    (angle): SearchDoc => ({
      key: `angle:${angle.id}`,
      kind: "angle",
      id: angle.id,
      title: angle.name || "Untitled angle",
      secondary: angle.description,
      hint: "",
      href: `/ideas/angles?open=${angle.id}`,
      updatedAt: angle.updated_at,
      fields: [...field(angle.name, 3), ...field(angle.description, 1), ...field(angle.example, 1)],
    })
  )
}

export function buildStoryDocs(stories: Story[], pillarNames: Map<ID, string>): SearchDoc[] {
  return stories.map(
    (story): SearchDoc => ({
      key: `story:${story.id}`,
      kind: "story",
      id: story.id,
      title: story.title || "Untitled story",
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

export function buildCampaignDocs(campaigns: ContentCampaign[]): SearchDoc[] {
  return campaigns.map(
    (campaign): SearchDoc => ({
      key: `campaign:${campaign.id}`,
      kind: "campaign",
      id: campaign.id,
      title: campaign.name || "Untitled campaign",
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

export function buildSeriesDocs(series: ContentSeries[], pillarNames: Map<ID, string>): SearchDoc[] {
  return series.map(
    (entry): SearchDoc => ({
      key: `series:${entry.id}`,
      kind: "series",
      id: entry.id,
      title: entry.name || "Untitled series",
      secondary: joinParts(
        SERIES_FREQUENCY_MAP[entry.frequency]?.label,
        pillarName(pillarNames, entry.pillar_id),
        !entry.is_active && "Paused"
      ),
      hint: "",
      href: `/series?open=${entry.id}`,
      updatedAt: entry.updated_at,
      fields: [...field(entry.name, 3), ...field(entry.description, 1), ...field(entry.hook_template, 1)],
    })
  )
}

export function buildPillarDocs(pillars: ContentPillar[]): SearchDoc[] {
  return pillars.map(
    (pillar): SearchDoc => ({
      key: `pillar:${pillar.id}`,
      kind: "pillar",
      id: pillar.id,
      title: pillar.name || "Untitled pillar",
      secondary: joinParts(`${Math.round(pillar.target_percentage)}% of the mix`, !pillar.is_active && "Inactive"),
      hint: "",
      href: `/pillars?open=${pillar.id}`,
      updatedAt: pillar.updated_at,
      fields: [...field(pillar.name, 3), ...field(pillar.description, 1), ...field(pillar.examples.join(" "), 1)],
    })
  )
}

export function buildPersonaDocs(personas: AudiencePersona[]): SearchDoc[] {
  return personas.map(
    (persona): SearchDoc => ({
      key: `persona:${persona.id}`,
      kind: "persona",
      id: persona.id,
      title: persona.name || "Untitled persona",
      secondary: joinParts(persona.profession, persona.industry),
      hint: persona.is_primary ? "Primary" : "",
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

export function buildResearchDocs(research: ResearchItem[]): SearchDoc[] {
  return research.map(
    (item): SearchDoc => ({
      key: `research:${item.id}`,
      kind: "research",
      id: item.id,
      title: item.title || item.url || "Untitled reference",
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

export function buildProblemDocs(problems: AudienceProblem[]): SearchDoc[] {
  return problems.map(
    (problem): SearchDoc => ({
      key: `problem:${problem.id}`,
      kind: "problem",
      id: problem.id,
      title: problem.problem || "Untitled problem",
      secondary: joinParts(PROBLEM_CATEGORY_MAP[problem.category]?.label, `Severity ${problem.severity}/5`),
      hint: "",
      href: `/audience/problems?open=${problem.id}`,
      updatedAt: problem.updated_at,
      fields: [...field(problem.problem, 3), ...field(problem.notes, 1)],
    })
  )
}

export function buildQuestionDocs(questions: AudienceQuestion[]): SearchDoc[] {
  return questions.map(
    (question): SearchDoc => ({
      key: `question:${question.id}`,
      kind: "question",
      id: question.id,
      title: question.question || "Untitled question",
      secondary: joinParts(
        QUESTION_STATUS_MAP[question.status]?.label,
        question.topic,
        question.frequency > 1 && `Asked ${question.frequency}×`
      ),
      hint: "",
      href: `/audience/questions?open=${question.id}`,
      updatedAt: question.updated_at,
      fields: [...field(question.question, 3), ...field(question.topic, 2), ...field(question.source_person, 1)],
    })
  )
}

export function buildExperimentDocs(experiments: ContentExperiment[]): SearchDoc[] {
  return experiments.map(
    (experiment): SearchDoc => ({
      key: `experiment:${experiment.id}`,
      kind: "experiment",
      id: experiment.id,
      title: experiment.name || "Untitled experiment",
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
export function buildTopicDocs(ideas: ContentIdea[]): SearchDoc[] {
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
      secondary: pluralize(topic.count, "idea"),
      hint: "Topic",
      href: `/ideas?q=${encodeURIComponent(topic.label)}`,
      updatedAt: topic.updatedAt,
      fields: field(topic.label, 3),
    })
  )
}

/** Published items that have at least one metrics snapshot (latest snapshot supplies the views hint). */
export function buildAnalyticsDocs(items: ContentItem[], metrics: ContentMetric[]): SearchDoc[] {
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
      title: item.title || "Untitled post",
      secondary: joinParts(PLATFORMS[item.platform]?.label, item.published_at ? formatShortDate(item.published_at) : null),
      hint: `${formatCompact(metric.views)} views`,
      href: `/analytics/posts?open=${item.id}`,
      updatedAt: metric.updated_at > item.updated_at ? metric.updated_at : item.updated_at,
      fields: [...field(item.title, 3), ...field(item.hook, 2)],
    })
  }
  return docs
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
  scripts: ContentScript[]
  metrics: ContentMetric[]
}

/** Whole index in one call (the palette memoizes per kind instead). */
export function buildSearchIndex(sources: SearchSources): SearchIndex {
  const pillarNames = new Map(sources.pillars.map((p) => [p.id, p.name]))
  return {
    content: buildContentDocs(sources.items, pillarNames, currentScriptBodies(sources.scripts)),
    idea: buildIdeaDocs(sources.ideas, pillarNames),
    hook: buildHookDocs(sources.hooks),
    angle: buildAngleDocs(sources.angles),
    story: buildStoryDocs(sources.stories, pillarNames),
    campaign: buildCampaignDocs(sources.campaigns),
    series: buildSeriesDocs(sources.series, pillarNames),
    pillar: buildPillarDocs(sources.pillars),
    persona: buildPersonaDocs(sources.personas),
    problem: buildProblemDocs(sources.problems),
    question: buildQuestionDocs(sources.questions),
    research: buildResearchDocs(sources.research),
    experiment: buildExperimentDocs(sources.experiments),
    topic: buildTopicDocs(sources.ideas),
    analytics: buildAnalyticsDocs(sources.items, sources.metrics),
  }
}
