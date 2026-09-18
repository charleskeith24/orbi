/** Funnel helpers: stage colours, goal → stage mapping, quick-assign suggestions and item ordering. */
import { FUNNEL_STAGE_IDS, GOAL_CATEGORIES, PUBLISHED_STAGES } from "@/lib/constants"
import { contentItemDate, parseDate } from "@/lib/dates"
import { translator, type UiLang } from "@/lib/i18n/core"
import type { CategoricalColor, ContentGoal, ContentIdea, ContentItem, FunnelStage, GoalCategory, ID } from "@/lib/types"
import { funnelMessages } from "./funnel-messages"

/** Stages have no colour field, so they take the first categorical slots in funnel order. */
export const FUNNEL_COLORS: Record<FunnelStage, CategoricalColor> = { tofu: "blue", mofu: "orange", bofu: "aqua" }

/** The funnel stage each goal category naturally serves. */
export const GOAL_FUNNEL: Record<GoalCategory, FunnelStage> = {
  awareness: "tofu",
  authority: "mofu",
  community: "mofu",
  leads: "bofu",
  business: "bofu",
}

export interface FunnelSuggestion {
  stage: FunnelStage
  /** e.g. "from its idea", "Authority goal". */
  reason: string
}

/** The idea's stage wins; otherwise the stage its goal category serves; otherwise no suggestion. */
export function suggestFunnelStage(
  item: Pick<ContentItem, "idea_id" | "goal_id">,
  ideas: Map<ID, ContentIdea>,
  goals: Map<ID, ContentGoal>,
  lang: UiLang = "en"
): FunnelSuggestion | null {
  const t = translator(funnelMessages, lang)
  const idea = item.idea_id ? ideas.get(item.idea_id) : undefined
  if (idea?.funnel_stage) return { stage: idea.funnel_stage, reason: t("reason_idea") }
  const goal = item.goal_id ? goals.get(item.goal_id) : undefined
  if (goal) {
    const category = GOAL_CATEGORIES[goal.category]?.label
    return { stage: GOAL_FUNNEL[goal.category], reason: category ? t("reason_goal", { category }) : t("reason_goal_unknown") }
  }
  return null
}

const isPublished = (item: ContentItem) => PUBLISHED_STAGES.includes(item.stage)
const dateMs = (item: ContentItem): number | null => contentItemDate(item)?.getTime() ?? null

/** Work still to ship first (soonest date first, undated last), then published pieces (newest first). */
export function sortForAssignment(items: ContentItem[]): ContentItem[] {
  const upcoming = items
    .filter((i) => !isPublished(i))
    .sort((a, b) => (dateMs(a) ?? Number.MAX_SAFE_INTEGER) - (dateMs(b) ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title))
  const live = items.filter(isPublished).sort((a, b) => (dateMs(b) ?? 0) - (dateMs(a) ?? 0))
  return [...upcoming, ...live]
}

export interface StageContent {
  /** Latest published pieces, newest first. */
  recent: ContentItem[]
  /** Pieces with this stage that aren't published yet. */
  inProduction: number
}

/** Recent published items and in-production counts per funnel stage. */
export function contentByStage(items: ContentItem[], limit = 4): Record<FunnelStage, StageContent> {
  const out = Object.fromEntries(FUNNEL_STAGE_IDS.map((s) => [s, { recent: [], inProduction: 0 }])) as unknown as Record<
    FunnelStage,
    StageContent
  >
  const published: ContentItem[] = []
  for (const item of items) {
    if (!item.funnel_stage || !(item.funnel_stage in out)) continue
    if (isPublished(item)) published.push(item)
    else out[item.funnel_stage].inProduction++
  }
  published.sort(
    (a, b) =>
      (dateMs(b) ?? parseDate(b.created_at)?.getTime() ?? 0) - (dateMs(a) ?? parseDate(a.created_at)?.getTime() ?? 0)
  )
  for (const item of published) {
    const bucket = out[item.funnel_stage as FunnelStage]
    if (bucket.recent.length < limit) bucket.recent.push(item)
  }
  return out
}
