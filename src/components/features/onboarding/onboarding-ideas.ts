/**
 * Starter ideas from `onboarding_strategy`: the editable draft the wizard keeps, and the pure matching
 * that links each idea to the rows Finish setup creates — a pillar (balanced toward the pillar
 * targets), the audience problem it addresses and the goal its funnel stage serves.
 * The AI task returns ideas without ids because none of those rows exist yet.
 */
import type { GeneratedIdea } from "@/lib/ai"
import { FUNNEL_STAGE_IDS, HOOK_CATEGORY_IDS, PLATFORM_IDS } from "@/lib/constants"
import type { FunnelStage, GoalCategory, HookCategory, PlatformId } from "@/lib/types"
import { largestRemainder, norm } from "./onboarding-model"

export interface IdeaDraft extends GeneratedIdea {
  /** Stable key within one generation. */
  key: string
  selected: boolean
  /** Pillar name picked by the creator: undefined = automatic match, null = no pillar. */
  pillar?: string | null
}

export function toIdeaDrafts(ideas: GeneratedIdea[]): IdeaDraft[] {
  return ideas.map((idea, index) => ({ ...idea, key: `idea-${index}`, selected: true }))
}

/* --------------------------------- Tokens --------------------------------- */

const STOP = new Set(
  "the and for you your with that this from what how why are was were they them their into about when who but not can get got our out one all its have has had just more most than then will would should could here there make made every each only also very too use using way ways really still even much many like".split(
    " "
  )
)

/** Lower-case content words (≥ 3 letters, crude plural folding) for overlap scoring. */
export function tokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 3 || STOP.has(raw)) continue
    out.add(raw.length > 4 && raw.endsWith("s") && !raw.endsWith("ss") ? raw.slice(0, -1) : raw)
  }
  return out
}

const ideaText = (idea: GeneratedIdea) => [idea.title, idea.core_idea, idea.hook, idea.angle, ...idea.talking_points].join(" ")

/* --------------------------------- Pillars -------------------------------- */

export interface PillarTarget {
  name: string
  description: string
  examples: string[]
  target: number
}

/** Extra vocabulary for the preset pillars (spec §6), keyed by normalized name. */
const PRESET_HINTS: Record<string, string[]> = {
  education: ["tutorial", "guide", "step", "framework", "checklist", "mistake", "tip", "tool", "system", "learn", "explain", "myth"],
  authority: ["opinion", "case", "study", "analysis", "prediction", "industry", "trend", "unpopular", "contrarian", "breakdown"],
  journey: ["behind", "scene", "building", "journey", "failure", "win", "experiment", "tested", "learned", "progress"],
  leadership: ["team", "hire", "hiring", "culture", "leader", "leadership", "manage", "manager", "decision", "delegate", "accountability"],
  personal: ["story", "belief", "value", "routine", "life", "reflection", "personal", "family"],
  business: ["offer", "client", "service", "sale", "lead", "launch", "partner", "recruit", "book", "call", "price", "pricing"],
}

/** Angle library name → preset pillars it usually belongs to (first = strongest). */
const ANGLE_PILLARS: Record<string, string[]> = {
  problem: ["education"],
  mistake: ["education"],
  myth: ["education", "authority"],
  contrarian: ["authority"],
  tutorial: ["education"],
  checklist: ["education"],
  framework: ["education"],
  story: ["personal", "journey"],
  failure: ["journey"],
  success: ["journey", "authority"],
  "case study": ["authority", "business"],
  transformation: ["journey"],
  "behind the scenes": ["journey"],
  prediction: ["authority"],
  comparison: ["education", "authority"],
  opinion: ["authority", "leadership"],
  reaction: ["authority"],
  observation: ["authority"],
  question: ["education"],
  challenge: ["journey"],
  lesson: ["journey", "personal"],
  "before vs after": ["journey"],
}

function scorePillar(idea: GeneratedIdea, words: Set<string>, pillar: PillarTarget): number {
  const key = norm(pillar.name)
  const vocabulary = tokens([pillar.name, pillar.description, ...pillar.examples, ...(PRESET_HINTS[key] ?? [])].join(" "))
  let score = 0
  for (const word of vocabulary) if (words.has(word)) score++
  const rank = (ANGLE_PILLARS[norm(idea.angle)] ?? []).indexOf(key)
  if (rank === 0) score += 3
  else if (rank > 0) score += 2
  if (idea.funnel_stage === "bofu" && key === "business") score += 3
  return score
}

/**
 * One pillar name per idea. Relevance first (vocabulary overlap, the idea's angle, BOFU → Business);
 * quotas from the pillar targets break ties and spread ideas nobody claims, so 30 ideas land close
 * to the chosen mix.
 */
export function assignPillars(ideas: GeneratedIdea[], pillars: PillarTarget[]): (string | null)[] {
  if (!pillars.length) return ideas.map(() => null)
  const quotas = largestRemainder(
    pillars.map((p) => p.target),
    ideas.length,
    0
  )
  const scores = ideas.map((idea) => {
    const words = tokens(ideaText(idea))
    return pillars.map((p) => scorePillar(idea, words, p))
  })
  const best = scores.map((row) => Math.max(...row))
  const order = ideas.map((_, i) => i).sort((a, b) => best[b] - best[a] || a - b)
  const counts = pillars.map(() => 0)
  const out: (string | null)[] = ideas.map(() => null)
  for (const i of order) {
    const row = scores[i]
    const ranked = pillars
      .map((_, j) => j)
      .sort((x, y) => row[y] - row[x] || quotas[y] - counts[y] - (quotas[x] - counts[x]) || x - y)
    const open = ranked.filter((j) => counts[j] < quotas[j])
    // A relevant pillar beats an empty quota slot the idea has nothing to do with.
    const pick = open.length && !(row[ranked[0]] > 0 && row[open[0]] === 0) ? open[0] : ranked[0]
    counts[pick]++
    out[i] = pillars[pick].name
  }
  return out
}

/** The pillar each idea is saved under: the creator's pick while it still exists, else the automatic match. */
export function effectivePillars(ideas: IdeaDraft[], pillars: PillarTarget[]): (string | null)[] {
  const auto = assignPillars(ideas, pillars)
  const names = new Map(pillars.map((p) => [norm(p.name), p.name]))
  return ideas.map((idea, i) => {
    if (idea.pillar === null) return null
    if (typeof idea.pillar === "string") {
      const hit = names.get(norm(idea.pillar))
      if (hit) return hit
    }
    return auto[i]
  })
}

/* ------------------------------ Problems & goals -------------------------- */

/** Index of the audience problem an idea clearly addresses (≥ half of the problem's words), or -1. */
export function matchProblem(idea: GeneratedIdea, problems: string[]): number {
  const text = tokens([ideaText(idea), idea.why_it_matters].join(" "))
  let best = -1
  let bestScore = 0
  problems.forEach((problem, index) => {
    const words = tokens(problem)
    if (!words.size) return
    let hits = 0
    for (const word of words) if (text.has(word)) hits++
    const score = hits / words.size
    if (hits >= Math.min(2, words.size) && score >= 0.5 && score > bestScore) {
      best = index
      bestScore = score
    }
  })
  return best
}

const FUNNEL_GOALS: Record<FunnelStage, GoalCategory[]> = {
  tofu: ["awareness", "community"],
  mofu: ["authority", "community"],
  bofu: ["leads", "business"],
}

/** The chosen goal an idea's funnel stage serves; falls back to the primary goal. */
export function goalForIdea(funnel: FunnelStage | null, chosen: GoalCategory[]): GoalCategory | null {
  if (funnel) {
    const hit = chosen.find((c) => FUNNEL_GOALS[funnel].includes(c))
    if (hit) return hit
  }
  return chosen[0] ?? null
}

/* ------------------------------- Draft safety ----------------------------- */

const str = (value: unknown) => (typeof value === "string" ? value : "")

function member<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** Idea drafts restored from localStorage; malformed entries are dropped. */
export function sanitizeIdeaDrafts(raw: unknown): IdeaDraft[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .filter((x) => typeof x.title === "string" && (PLATFORM_IDS as string[]).includes(str(x.platform)))
    .slice(0, 50)
    .map((x, index) => {
      const draft: IdeaDraft = {
        title: str(x.title),
        core_idea: str(x.core_idea),
        why_it_matters: str(x.why_it_matters),
        hook: str(x.hook),
        hook_category: member<HookCategory>(x.hook_category, HOOK_CATEGORY_IDS, "custom"),
        format: str(x.format),
        angle: str(x.angle),
        talking_points: Array.isArray(x.talking_points) ? x.talking_points.filter((t): t is string => typeof t === "string") : [],
        cta: str(x.cta),
        platform: x.platform as PlatformId,
        funnel_stage: member<FunnelStage>(x.funnel_stage, FUNNEL_STAGE_IDS, "tofu"),
        pillar_id: null,
        persona_id: null,
        problem_id: null,
        key: typeof x.key === "string" && x.key ? x.key : `idea-${index}`,
        selected: x.selected !== false,
      }
      if (x.pillar === null) draft.pillar = null
      else if (typeof x.pillar === "string") draft.pillar = x.pillar
      return draft
    })
}
