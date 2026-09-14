/** Workspace → Content Matrix inputs: dimension lists with need scores, coverage counts and existing matrix ideas. */
import { funnelMix, pillarMix } from "@/lib/analytics"
import { FORMAT_CATEGORIES, FUNNEL_STAGE_IDS, FUNNEL_STAGES, GOAL_CATEGORIES, PUBLISHED_STAGES } from "@/lib/constants"
import type { AppSettings, CategoricalColor, Database, FormatCategory, FunnelStage, ID } from "@/lib/types"
import {
  comboKey,
  type MatrixCoverage,
  type MatrixFormat,
  type MatrixGoal,
  type MatrixPillar,
  type MatrixProblem,
  type MatrixSelection,
  type MatrixStage,
} from "./matrix-engine"
import { sortPillars } from "./pillar-math"

export type MatrixPillarOption = MatrixPillar & { color: CategoricalColor }
export type MatrixFormatOption = MatrixFormat & { category: FormatCategory }

export interface MatrixData {
  /** Active pillars in display order. */
  pillars: MatrixPillarOption[]
  formats: MatrixFormatOption[]
  /** Most severe first, then the least covered. */
  problems: MatrixProblem[]
  /** Active goals. */
  goals: MatrixGoal[]
  stages: MatrixStage[]
  coverage: MatrixCoverage
  /** A non-archived idea per full combination key (pillar|format|problem|goal|stage). */
  ideaByKey: Map<string, ID>
  /** Content items per `pillarId|formatId`: every stage, and published only. */
  counts: { all: Map<string, number>; published: Map<string, number> }
  /** Content items per format, any pillar. */
  formatUsage: Map<ID, number>
}

export interface MatrixSelectionIds {
  pillars: ID[]
  formats: ID[]
  /** Optional persona filter for the problem list. */
  personaId: ID | null
  problems: ID[]
  goals: ID[]
  stages: FunnelStage[]
}

export const DEFAULT_PROBLEM_COUNT = 6
const DEFAULT_FORMAT_COUNT = 4

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/** −1…1: positive when under target (relative to the target); 0 until the mix has enough data. */
function needOf(row: { targetPct: number; actualPct: number } | undefined, enoughData: boolean): number {
  if (!row || !enoughData) return 0
  return Math.max(-1, Math.min(1, (row.targetPct - row.actualPct) / Math.max(row.targetPct, 5)))
}

export function buildMatrixData(db: Database, now: Date, settings: AppSettings): MatrixData {
  const pMix = pillarMix(db, now, settings)
  const fMix = funnelMix(db, now, settings)
  const pillarRows = new Map(pMix.rows.map((r) => [r.pillar.id, r]))
  const stageRows = new Map(fMix.rows.map((r) => [r.stage, r]))

  const pillars = sortPillars(db.content_pillars.filter((p) => p.is_active)).map((p) => {
    const row = pillarRows.get(p.id)
    return {
      id: p.id,
      name: p.name || "Untitled pillar",
      color: p.color,
      need: needOf(row, pMix.enoughData),
      deviation: row && pMix.enoughData ? row.deviation : null,
    }
  })

  const categoryOrder = FORMAT_CATEGORIES.map((c) => c.id)
  const formats = [...db.content_formats]
    .sort(
      (a, b) =>
        categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name)
    )
    .map((f) => ({ id: f.id, name: f.name || "Untitled format", category: f.category }))

  const ideaCount = new Map<string, number>()
  const itemCount = new Map<string, number>()
  const covered = new Set<string>()
  const ideaByKey = new Map<string, ID>()
  for (const idea of db.content_ideas) {
    if (idea.status === "archived") continue
    if (idea.problem_id) bump(ideaCount, idea.problem_id)
    if (!idea.pillar_id || !idea.format_id || !idea.problem_id) continue
    covered.add(`${idea.pillar_id}|${idea.format_id}|${idea.problem_id}`)
    if (idea.goal_id && idea.funnel_stage) {
      const key = comboKey(idea.pillar_id, idea.format_id, idea.problem_id, idea.goal_id, idea.funnel_stage)
      if (!ideaByKey.has(key)) ideaByKey.set(key, idea.id)
    }
  }

  const all = new Map<string, number>()
  const published = new Map<string, number>()
  const formatUsage = new Map<string, number>()
  for (const item of db.content_items) {
    if (item.problem_id) bump(itemCount, item.problem_id)
    if (item.format_id) bump(formatUsage, item.format_id)
    if (!item.pillar_id || !item.format_id) continue
    const cell = `${item.pillar_id}|${item.format_id}`
    bump(all, cell)
    if (PUBLISHED_STAGES.includes(item.stage)) bump(published, cell)
    if (item.problem_id) covered.add(`${cell}|${item.problem_id}`)
  }

  const problems = db.audience_problems
    .map((p) => ({
      id: p.id,
      text: p.problem.trim() || "Untitled problem",
      severity: p.severity,
      personaId: p.persona_id,
      pillarId: p.pillar_id,
      ideaCount: ideaCount.get(p.id) ?? 0,
      itemCount: itemCount.get(p.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.severity - a.severity || a.itemCount + a.ideaCount - (b.itemCount + b.ideaCount) || a.text.localeCompare(b.text)
    )

  const goals = db.content_goals
    .filter((g) => g.is_active)
    .map((g) => ({ id: g.id, name: g.name || GOAL_CATEGORIES[g.category]?.label || "Untitled goal", category: g.category }))

  const stages = FUNNEL_STAGE_IDS.map((id) => ({
    id,
    label: FUNNEL_STAGES[id].label,
    need: needOf(stageRows.get(id), fMix.enoughData),
  }))

  return {
    pillars,
    formats,
    problems,
    goals,
    stages,
    coverage: { pillarFormat: all, covered },
    ideaByKey,
    counts: { all, published },
    formatUsage,
  }
}

/**
 * Starting dimensions: URL `?pillar=` / `?format=` (comma-separated ids) and `?persona=` when valid; otherwise
 * every active pillar, the most-used formats your platforms prefer, the most severe least-covered problems,
 * the brand's primary + secondary goals and all three funnel stages.
 */
export function defaultSelection(
  data: MatrixData,
  db: Database,
  params: { pillar?: string | null; format?: string | null; persona?: string | null } = {}
): MatrixSelectionIds {
  const fromParam = (param: string | null | undefined, known: { id: ID }[]) => {
    if (!param) return []
    const ids = new Set(known.map((k) => k.id))
    return param
      .split(",")
      .map((s) => s.trim())
      .filter((id) => ids.has(id))
  }
  const pillars = fromParam(params.pillar, data.pillars)
  const formats = fromParam(params.format, data.formats)
  const personaId = params.persona && db.audience_personas.some((p) => p.id === params.persona) ? params.persona : null

  const preferred = new Set(db.content_platforms.filter((p) => p.is_active).flatMap((p) => p.preferred_format_ids))
  const byUsage = [...data.formats].sort((a, b) => (data.formatUsage.get(b.id) ?? 0) - (data.formatUsage.get(a.id) ?? 0))
  const preferredByUsage = byUsage.filter((f) => preferred.has(f.id))
  const chosen = new Set((preferredByUsage.length ? preferredByUsage : byUsage).slice(0, DEFAULT_FORMAT_COUNT).map((f) => f.id))

  const brand = db.brand_profiles[0]
  const brandGoals = [brand?.primary_goal_id, brand?.secondary_goal_id].filter(
    (id, i, list): id is ID => Boolean(id) && list.indexOf(id) === i && data.goals.some((g) => g.id === id)
  )

  return {
    pillars: pillars.length ? pillars : data.pillars.map((p) => p.id),
    formats: formats.length ? formats : data.formats.filter((f) => chosen.has(f.id)).map((f) => f.id),
    personaId,
    problems: data.problems
      .filter((p) => !personaId || p.personaId === personaId)
      .slice(0, DEFAULT_PROBLEM_COUNT)
      .map((p) => p.id),
    goals: brandGoals.length ? brandGoals : data.goals.map((g) => g.id),
    stages: [...FUNNEL_STAGE_IDS],
  }
}

/** Ids → engine input, in the data's display order; problems respect the persona filter. */
export function resolveSelection(data: MatrixData, ids: MatrixSelectionIds): MatrixSelection {
  const pick = <T extends { id: string }>(list: T[], wanted: string[]) => {
    const set = new Set(wanted)
    return list.filter((x) => set.has(x.id))
  }
  return {
    pillars: pick(data.pillars, ids.pillars),
    formats: pick(data.formats, ids.formats),
    problems: pick(data.problems, ids.problems).filter((p) => !ids.personaId || p.personaId === ids.personaId),
    goals: pick(data.goals, ids.goals),
    stages: data.stages.filter((s) => ids.stages.includes(s.id)),
  }
}

/** Order-insensitive fingerprint used to tell when the generated list is out of date. */
export function selectionSignature(ids: MatrixSelectionIds): string {
  const sorted = (list: string[]) => [...list].sort()
  return JSON.stringify([
    sorted(ids.pillars),
    sorted(ids.formats),
    ids.personaId,
    sorted(ids.problems),
    sorted(ids.goals),
    sorted(ids.stages),
  ])
}

export interface CoverageGap {
  pillarId: ID
  formatId: ID
  count: number
  reason: string
}

/** Empty or thin pillar × format cells, weighted by pillar need and how much the format is used overall. */
export function coverageGaps(data: MatrixData, counts: Map<string, number>, limit = 6): CoverageGap[] {
  let totalUsage = 0
  for (const n of data.formatUsage.values()) totalUsage += n
  const candidates: (CoverageGap & { score: number })[] = []
  for (const p of data.pillars) {
    for (const f of data.formats) {
      const count = counts.get(`${p.id}|${f.id}`) ?? 0
      if (count > 1) continue
      const share = totalUsage ? (data.formatUsage.get(f.id) ?? 0) / totalUsage : 0
      const score = (count === 0 ? 1 : 0.5) * (1 + Math.max(0, p.need)) * (0.3 + share * 3)
      const reason =
        p.need > 0.1 ? `${p.name} is under target` : share >= 0.1 ? `${f.name} is one of your most-used formats` : "Untested combination"
      candidates.push({ pillarId: p.id, formatId: f.id, count, reason, score })
    }
  }
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => ({ pillarId: c.pillarId, formatId: c.formatId, count: c.count, reason: c.reason }))
}
