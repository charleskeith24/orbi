/**
 * Content Matrix engine (spec §7): pillars × formats × audience problems × goals × funnel stages.
 * Pure and deterministic — the same selection and coverage always produce the same ranked list.
 */
import { GOAL_CATEGORIES } from "@/lib/constants"
import type { FunnelStage, GoalCategory, ID } from "@/lib/types"
import { GOAL_FUNNEL } from "./funnel-utils"

export interface MatrixPillar {
  id: ID
  name: string
  /** −1…1 — how far under (+) or over (−) target the pillar is, relative to its target. */
  need: number
  /** actual − target in percentage points; null until the mix has enough data. */
  deviation: number | null
}

export interface MatrixFormat {
  id: ID
  name: string
}

export interface MatrixProblem {
  id: ID
  text: string
  /** 1 (minor) – 5 (critical). */
  severity: number
  personaId: ID | null
  pillarId: ID | null
  /** Active ideas and content items that already address the problem. */
  ideaCount: number
  itemCount: number
}

export interface MatrixGoal {
  id: ID
  name: string
  category: GoalCategory
}

export interface MatrixStage {
  id: FunnelStage
  label: string
  /** −1…1 like MatrixPillar.need. */
  need: number
}

export interface MatrixSelection {
  pillars: MatrixPillar[]
  formats: MatrixFormat[]
  problems: MatrixProblem[]
  goals: MatrixGoal[]
  stages: MatrixStage[]
}

export interface MatrixCoverage {
  /** Existing content items per `pillarId|formatId`. */
  pillarFormat: Map<string, number>
  /** `pillarId|formatId|problemId` already addressed by an idea or a content item. */
  covered: Set<string>
}

export interface MatrixCombo {
  /** `pillar|format|problem|goal|stage` ids. */
  key: string
  rank: number
  pillar: MatrixPillar
  format: MatrixFormat
  problem: MatrixProblem
  goal: MatrixGoal
  stage: MatrixStage
  score: number
  title: string
  /** Up to three short "why this combination" notes, strongest first. */
  reasons: string[]
}

export const MATRIX_LIMIT = 60
/** Best-scoring combinations kept before the diversity pass. */
const CANDIDATE_POOL = 2500

/** Diversity penalties per repeat of the same value in the picked list. */
const REPEAT_PENALTY = { pillar: 0.45, problem: 0.35, format: 0.2, goal: 0.1, stage: 0.1 }

export function comboCount(selection: MatrixSelection): number {
  return (
    selection.pillars.length *
    selection.formats.length *
    selection.problems.length *
    selection.goals.length *
    selection.stages.length
  )
}

export function comboKey(pillarId: ID, formatId: ID, problemId: ID, goalId: ID, stage: FunnelStage): string {
  return [pillarId, formatId, problemId, goalId, stage].join("|")
}

const STAGE_ORDER: Record<FunnelStage, number> = { tofu: 0, mofu: 1, bofu: 2 }

/** 1 when the stage is the goal's natural stage, 0 next to it, −1 at the opposite end of the funnel. */
export function goalStageFit(category: GoalCategory, stage: FunnelStage): number {
  const gap = Math.abs(STAGE_ORDER[GOAL_FUNNEL[category]] - STAGE_ORDER[stage])
  return gap === 0 ? 1 : gap === 1 ? 0 : -1
}

interface Factors {
  pillarNeed: number
  severity: number
  untapped: number
  stageNeed: number
  problemFit: number
  goalFit: number
  formatGap: number
  duplicate: number
}

const clampSeverity = (severity: number) => Math.min(5, Math.max(1, Math.round(severity) || 1))

function factorsFor(
  p: MatrixPillar,
  f: MatrixFormat,
  q: MatrixProblem,
  g: MatrixGoal,
  s: MatrixStage,
  coverage: MatrixCoverage
): Factors {
  return {
    pillarNeed: 1.4 * p.need,
    severity: 1.2 * ((clampSeverity(q.severity) - 1) / 4),
    untapped: q.itemCount === 0 ? (q.ideaCount === 0 ? 0.6 : 0.3) : 0,
    stageNeed: 0.5 * s.need,
    problemFit: q.pillarId ? (q.pillarId === p.id ? 0.5 : -0.15) : 0,
    goalFit: 0.4 * goalStageFit(g.category, s.id),
    formatGap: (coverage.pillarFormat.get(`${p.id}|${f.id}`) ?? 0) === 0 ? 0.25 : 0,
    duplicate: coverage.covered.has(`${p.id}|${f.id}|${q.id}`) ? -0.8 : 0,
  }
}

const totalOf = (x: Factors) =>
  x.pillarNeed + x.severity + x.untapped + x.stageNeed + x.problemFit + x.goalFit + x.formatGap + x.duplicate

interface Candidate {
  score: number
  p: number
  f: number
  q: number
  g: number
  s: number
}

/**
 * Cartesian product of the selection, scored to favour under-target pillars, severe and untapped problems,
 * under-served funnel stages, goal-appropriate stages and pillar × format gaps — then picked greedily with
 * repeat penalties so the list rotates through pillars and problems instead of stacking one pair.
 */
export function generateCombinations(
  selection: MatrixSelection,
  coverage: MatrixCoverage,
  limit = MATRIX_LIMIT
): MatrixCombo[] {
  const { pillars, formats, problems, goals, stages } = selection
  if (!comboCount(selection) || limit <= 0) return []

  const candidates: Candidate[] = []
  for (let p = 0; p < pillars.length; p++) {
    for (let q = 0; q < problems.length; q++) {
      for (let f = 0; f < formats.length; f++) {
        for (let g = 0; g < goals.length; g++) {
          for (let s = 0; s < stages.length; s++) {
            const score = totalOf(factorsFor(pillars[p], formats[f], problems[q], goals[g], stages[s], coverage))
            candidates.push({ score, p, f, q, g, s })
          }
        }
      }
    }
  }
  // Stable sort: equal scores keep enumeration order, so ties resolve the same way every time.
  candidates.sort((a, b) => b.score - a.score)
  const pool = candidates.slice(0, CANDIDATE_POOL)

  const used = { p: new Map<number, number>(), q: new Map<number, number>(), f: new Map<number, number>(), g: new Map<number, number>(), s: new Map<number, number>() }
  const bump = (map: Map<number, number>, key: number) => map.set(key, (map.get(key) ?? 0) + 1)
  const taken = new Uint8Array(pool.length)
  const picked: Candidate[] = []
  while (picked.length < Math.min(limit, pool.length)) {
    let best = -1
    let bestScore = -Infinity
    for (let i = 0; i < pool.length; i++) {
      if (taken[i]) continue
      const c = pool[i]
      const adjusted =
        c.score -
        REPEAT_PENALTY.pillar * (used.p.get(c.p) ?? 0) -
        REPEAT_PENALTY.problem * (used.q.get(c.q) ?? 0) -
        REPEAT_PENALTY.format * (used.f.get(c.f) ?? 0) -
        REPEAT_PENALTY.goal * (used.g.get(c.g) ?? 0) -
        REPEAT_PENALTY.stage * (used.s.get(c.s) ?? 0)
      if (adjusted > bestScore) {
        bestScore = adjusted
        best = i
      }
    }
    if (best < 0) break
    taken[best] = 1
    const c = pool[best]
    picked.push(c)
    bump(used.p, c.p)
    bump(used.q, c.q)
    bump(used.f, c.f)
    bump(used.g, c.g)
    bump(used.s, c.s)
  }

  return picked.map((c, i) => {
    const pillar = pillars[c.p]
    const format = formats[c.f]
    const problem = problems[c.q]
    const goal = goals[c.g]
    const stage = stages[c.s]
    const key = comboKey(pillar.id, format.id, problem.id, goal.id, stage.id)
    const factors = factorsFor(pillar, format, problem, goal, stage, coverage)
    return {
      key,
      rank: i + 1,
      pillar,
      format,
      problem,
      goal,
      stage,
      score: Math.round(c.score * 100) / 100,
      title: workingTitle(key, pillar.name, problem.text, stage.id),
      reasons: reasonsFor({ pillar, format, problem, goal, stage }, factors),
    }
  })
}

/* --------------------------------- Titles ---------------------------------- */

const STAGE_LEADS: Record<FunnelStage, string[]> = {
  tofu: ["Why this keeps happening", "Nobody talks about this", "The real cost of this", "Unpopular opinion"],
  mofu: ["How to fix it, step by step", "My framework for this", "The exact process I use", "What to do instead"],
  bofu: ["How we solve this for clients", "If this is you, let's talk", "The fastest way out", "What working with me on this looks like"],
}

/** Extra lens for pillars whose name suggests a storytelling angle (awareness and trust stages only). */
const PILLAR_LEADS: [RegExp, string][] = [
  [/journey|build|behind/i, "What I learned the hard way"],
  [/personal|life|story/i, "My honest story with this"],
  [/lead|team|manag/i, "How I lead my team through this"],
  [/author|expert|opinion/i, "My take after years in the trenches"],
]

/** FNV-1a — a tiny stable hash so a combination always gets the same phrasing. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The first clause of a problem statement (when it stands on its own), trimmed to `max` characters. */
export function problemTopic(text: string, max = 72): string {
  const clean = text.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "")
  const first = clean.split(/\s[—–-]\s|[:;]\s|,\s(?:so|then|but|and|which)\s/)[0] ?? clean
  const topic = first.length >= 24 ? first : clean
  if (topic.length <= max) return topic
  const slice = topic.slice(0, max - 1)
  const space = slice.lastIndexOf(" ")
  return `${(space > max * 0.6 ? slice.slice(0, space) : slice).trimEnd()}…`
}

/** Deterministic working title: a stage-appropriate lead + the problem's first clause. */
export function workingTitle(key: string, pillarName: string, problemText: string, stage: FunnelStage): string {
  const leads = [...STAGE_LEADS[stage]]
  if (stage !== "bofu") {
    const lens = PILLAR_LEADS.find(([pattern]) => pattern.test(pillarName))
    if (lens) leads.push(lens[1])
  }
  const lead = leads[hash(key) % leads.length]
  const topic = problemTopic(problemText)
  return topic ? `${lead}: ${topic}` : lead
}

/* --------------------------------- Reasons --------------------------------- */

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a")

/** Notes in a fixed explanatory order (strategic gap → audience need → coverage → fit), max three. */
function reasonsFor(
  c: Pick<MatrixCombo, "pillar" | "format" | "problem" | "goal" | "stage">,
  x: Factors
): string[] {
  const notes: string[] = []
  if (x.duplicate < 0) notes.push("Similar content already exists — find a new angle")
  if (c.pillar.need > 0.1 && c.pillar.deviation !== null && c.pillar.deviation < 0) {
    notes.push(`${c.pillar.name} is ${Math.round(Math.abs(c.pillar.deviation))} pts under target`)
  }
  if (x.untapped > 0) notes.push(c.problem.ideaCount ? "Problem only exists as ideas so far" : "Untapped problem — no content yet")
  if (clampSeverity(c.problem.severity) >= 4) notes.push(`Severity ${clampSeverity(c.problem.severity)}/5 problem`)
  if (x.formatGap > 0) notes.push(`No ${c.format.name} in ${c.pillar.name} yet`)
  if (c.stage.need > 0.1) notes.push(`${c.stage.label} is under its funnel target`)
  if (x.goalFit > 0) {
    const label = GOAL_CATEGORIES[c.goal.category]?.label ?? c.goal.category
    notes.push(`${c.stage.label} suits ${article(label)} ${label} goal`)
  }
  return notes.slice(0, 3)
}
