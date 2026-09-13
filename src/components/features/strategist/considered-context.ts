/**
 * "What the answer considered" (spec §57) as compact chips: positioning, audience, goal, platform,
 * pillar, funnel stage, recent performance, existing content, audience problems and previous winners.
 * All of it is sent with every question; platform, pillar and funnel chips narrow to the ones the
 * question, the answer or its suggested ideas actually refer to.
 */
import type { AnalyticsSnapshot, BrandContext } from "@/lib/ai"
import { FUNNEL_STAGES, PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import type { FunnelStage, PlatformId } from "@/lib/types"
import { clip, type ContextChip, type SuggestedIdea } from "./turns"

export interface ConsideredInput {
  context: BrandContext
  snapshot: AnalyticsSnapshot
  question: string
  reply: string
  ideas: SuggestedIdea[]
}

const FUNNEL_IDS: FunnelStage[] = ["tofu", "mofu", "bofu"]

const whole = (n: number) => Math.round(n).toLocaleString("en-US")
const times = (n: number | null) => (n === null ? null : `${n.toFixed(1)}×`)
const plural = (n: number, word: string) => `${whole(n)} ${word}${n === 1 ? "" : "s"}`

function unique<T>(list: T[]): T[] {
  return [...new Set(list)]
}

function withMore(first: string, count: number): string {
  return count > 1 ? `${first} +${count - 1}` : first
}

/** Whole-word, case-insensitive mention of a name in free text. */
export function mentions(text: string, name: string): boolean {
  const needle = name.trim()
  if (needle.length < 2) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "iu").test(text)
}

function platformChip({ context, snapshot, ideas }: ConsideredInput, text: string): ContextChip | null {
  // "X" is too ambiguous to detect in prose; it still counts when a suggested idea targets it.
  const named: PlatformId[] = unique([
    ...ideas.map((idea) => idea.platform),
    ...PLATFORM_IDS.filter((id) => id !== "x" && mentions(text, PLATFORMS[id].label)),
  ])
  if (named.length) {
    const detail = named
      .slice(0, 3)
      .map((id) => {
        const label = PLATFORMS[id].label
        const stat = snapshot.platforms.find((p) => p.key === id || p.label === label)
        if (!stat?.posts || stat.avg_views === null) return `${label}: no measured posts in the last 90 days`
        const ratio = times(stat.ratio)
        return `${label}: ${whole(stat.avg_views)} avg views${ratio ? ` (${ratio} your average)` : ""} across ${plural(stat.posts, "post")}`
      })
      .join(" · ")
    return { key: "platform", label: withMore(PLATFORMS[named[0]].label, named.length), detail, platform: named[0] }
  }
  if (!context.platforms.length) return null
  return {
    key: "platform",
    label: plural(context.platforms.length, "platform"),
    detail: `Platform strategies for ${context.platforms.map((p) => p.label).join(", ")}`,
  }
}

function pillarChip({ context, snapshot, ideas }: ConsideredInput, text: string): ContextChip | null {
  const ids = unique([
    ...ideas.map((idea) => idea.pillar_id).filter((id): id is string => Boolean(id)),
    ...context.pillars.filter((p) => mentions(text, p.name)).map((p) => p.id),
  ])
  const named = ids.flatMap((id) => context.pillars.filter((p) => p.id === id))
  if (named.length) {
    const detail = named
      .slice(0, 3)
      .map((pillar) => {
        const mix = snapshot.pillar_mix.find((row) => row.pillar_id === pillar.id)
        const perf = snapshot.pillars.find((row) => row.key === pillar.id || row.label === pillar.name)
        const share = mix ? `${mix.actual_pct}% of recent content vs a ${mix.target_pct}% target` : `${pillar.target_percentage}% target`
        const ratio = times(perf?.ratio ?? null)
        return `${pillar.name}: ${share}${ratio ? ` · ${ratio} your average views` : ""}`
      })
      .join(" · ")
    return { key: "pillar", label: withMore(named[0].name, named.length), detail, pillar_id: named[0].id }
  }
  if (!context.pillars.length) return null
  return {
    key: "pillar",
    label: plural(context.pillars.length, "pillar"),
    detail: `Targets and recent mix for ${context.pillars.map((p) => p.name).join(", ")}`,
  }
}

/** The context chips for one answer, in spec order; categories without data are left out. */
export function consideredContext(input: ConsideredInput): ContextChip[] {
  const { context, snapshot, question, reply } = input
  const text = `${question}\n${reply}`
  const chips: ContextChip[] = []
  const { brand } = context

  const positioning = brand.positioning_statement || brand.known_for || brand.point_of_view
  if (positioning) chips.push({ key: "positioning", label: "Positioning", detail: clip(positioning, 180) })

  const persona = context.personas.find((p) => p.is_primary) ?? context.personas[0]
  if (persona) {
    const detail = [persona.profession, persona.problems[0] ? `top problem: ${persona.problems[0]}` : ""].filter(Boolean).join(" · ")
    chips.push({ key: "audience", label: `Audience · ${persona.name || "Primary persona"}`, detail: detail || "Your primary persona" })
  }

  const goal = context.goals.find((g) => g.is_primary) ?? context.goals[0]
  if (goal) {
    chips.push({
      key: "goal",
      label: `Goal · ${goal.name || "Primary goal"}`,
      detail: goal.target ? `Target: ${goal.target}` : goal.description || "Your primary goal",
    })
  }

  const platform = platformChip(input, text)
  if (platform) chips.push(platform)
  const pillar = pillarChip(input, text)
  if (pillar) chips.push(pillar)

  if (snapshot.funnel_mix.length) {
    const named = FUNNEL_IDS.filter((stage) => new RegExp(`\\b${stage}\\b`, "i").test(text))
    chips.push({
      key: "funnel",
      label: named.length ? `Funnel · ${named.map((stage) => FUNNEL_STAGES[stage].label).join(" / ")}` : "Funnel mix",
      detail: snapshot.funnel_mix.map((row) => `${row.label} ${row.actual_pct}% (target ${row.target_pct}%)`).join(" · "),
    })
  }

  const totals = snapshot.totals_30d
  if (totals.posts > 0 || snapshot.weekly.target > 0) {
    const parts = [`Last 30 days: ${plural(totals.posts, "post")}`, `${whole(totals.views)} views`]
    if (totals.engagement_rate !== null) parts.push(`${totals.engagement_rate.toFixed(1)}% engagement`)
    parts.push(plural(totals.leads, "lead"), `this week ${snapshot.weekly.published}/${snapshot.weekly.target} published`)
    chips.push({ key: "performance", label: "Recent performance", detail: parts.join(" · ") })
  }

  const recent = context.recent_titles.length
  const ranked = snapshot.recommendations.length
  if (recent || ranked) {
    const parts = [recent ? plural(recent, "recent title") : "", ranked ? `${plural(ranked, "ranked idea")} from the Idea Bank and pipeline` : ""]
    chips.push({
      key: "content",
      label: "Existing content",
      detail: `${parts.filter(Boolean).join(" · ")} — so suggestions don't repeat what you've already made`,
    })
  }

  const problems = context.problems.length
  const questions = context.questions.length
  if (problems || questions) {
    const counts = [problems ? plural(problems, "problem") : "", questions ? plural(questions, "audience question") : ""]
    const top = context.problems[0]?.problem || context.questions[0]?.question
    chips.push({
      key: "problems",
      label: "Audience problems",
      detail: `${counts.filter(Boolean).join(" and ")}${top ? ` — most relevant: “${clip(top, 90)}”` : ""}`,
    })
  }

  if (snapshot.winners.length) {
    const best = [...snapshot.winners].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0]
    const ratio = times(best.ratio)
    chips.push({
      key: "winners",
      label: `Previous winners · ${snapshot.winners.length}`,
      detail: `Best of the last 90 days: “${clip(best.title, 80)}”${ratio ? ` at ${ratio} its platform baseline` : ""}`,
    })
  }

  return chips
}
