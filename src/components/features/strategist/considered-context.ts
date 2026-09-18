/**
 * "What the answer considered" (spec §57) as compact chips: positioning, audience, goal, platform,
 * pillar, funnel stage, recent performance, existing content, audience problems and previous winners.
 * All of it is sent with every question; platform, pillar and funnel chips narrow to the ones the
 * question, the answer or its suggested ideas actually refer to.
 */
import type { AnalyticsSnapshot, BrandContext } from "@/lib/ai"
import { FUNNEL_STAGES, PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { translator, type Translator, type UiLang } from "@/lib/i18n/core"
import type { FunnelStage, PlatformId } from "@/lib/types"
import { contextChipMessages } from "./strategist-messages"
import { clip, type ContextChip, type SuggestedIdea } from "./turns"

export interface ConsideredInput {
  context: BrandContext
  snapshot: AnalyticsSnapshot
  question: string
  reply: string
  ideas: SuggestedIdea[]
  /** Language of the chip text (display-only, stored with the turn). Default English. */
  lang?: UiLang
}

const FUNNEL_IDS: FunnelStage[] = ["tofu", "mofu", "bofu"]

type ChipT = Translator<(typeof contextChipMessages)["en"]>
type CountKey = "posts" | "platforms" | "pillars" | "leads" | "recent_titles" | "ranked" | "problems" | "audience_questions"

const whole = (n: number) => Math.round(n).toLocaleString("en-US")
const times = (n: number | null) => (n === null ? null : `${n.toFixed(1)}×`)
const plural = (t: ChipT, key: CountKey, n: number) => t.plural(key, n, { count: whole(n) })

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

function platformChip({ context, snapshot, ideas }: ConsideredInput, text: string, t: ChipT): ContextChip | null {
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
        if (!stat?.posts || stat.avg_views === null) return t("platform_unmeasured", { platform: label })
        const ratio = times(stat.ratio)
        return t("platform_stat", {
          platform: label,
          views: whole(stat.avg_views),
          ratio: ratio ? t("platform_ratio", { ratio }) : "",
          posts: plural(t, "posts", stat.posts),
        })
      })
      .join(" · ")
    return { key: "platform", label: withMore(PLATFORMS[named[0]].label, named.length), detail, platform: named[0] }
  }
  if (!context.platforms.length) return null
  return {
    key: "platform",
    label: plural(t, "platforms", context.platforms.length),
    detail: t("platforms_detail", { list: context.platforms.map((p) => p.label).join(", ") }),
  }
}

function pillarChip({ context, snapshot, ideas }: ConsideredInput, text: string, t: ChipT): ContextChip | null {
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
        const share = mix
          ? t("pillar_share", { actual: mix.actual_pct, target: mix.target_pct })
          : t("pillar_target", { target: pillar.target_percentage })
        const ratio = times(perf?.ratio ?? null)
        return `${pillar.name}: ${share}${ratio ? t("pillar_ratio", { ratio }) : ""}`
      })
      .join(" · ")
    return { key: "pillar", label: withMore(named[0].name, named.length), detail, pillar_id: named[0].id }
  }
  if (!context.pillars.length) return null
  return {
    key: "pillar",
    label: plural(t, "pillars", context.pillars.length),
    detail: t("pillars_detail", { list: context.pillars.map((p) => p.name).join(", ") }),
  }
}

/** The context chips for one answer, in spec order; categories without data are left out. */
export function consideredContext(input: ConsideredInput): ContextChip[] {
  const { context, snapshot, question, reply } = input
  const t = translator(contextChipMessages, input.lang ?? "en")
  const text = `${question}\n${reply}`
  const chips: ContextChip[] = []
  const { brand } = context

  const positioning = brand.positioning_statement || brand.known_for || brand.point_of_view
  if (positioning) chips.push({ key: "positioning", label: t("title_positioning"), detail: clip(positioning, 180) })

  const persona = context.personas.find((p) => p.is_primary) ?? context.personas[0]
  if (persona) {
    const detail = [persona.profession, persona.problems[0] ? t("top_problem", { problem: persona.problems[0] }) : ""]
      .filter(Boolean)
      .join(" · ")
    chips.push({ key: "audience", label: t("audience_label", { name: persona.name || t("primary_persona") }), detail: detail || t("your_persona") })
  }

  const goal = context.goals.find((g) => g.is_primary) ?? context.goals[0]
  if (goal) {
    chips.push({
      key: "goal",
      label: t("goal_label", { name: goal.name || t("primary_goal") }),
      detail: goal.target ? t("goal_target", { target: goal.target }) : goal.description || t("your_goal"),
    })
  }

  const platform = platformChip(input, text, t)
  if (platform) chips.push(platform)
  const pillar = pillarChip(input, text, t)
  if (pillar) chips.push(pillar)

  if (snapshot.funnel_mix.length) {
    const named = FUNNEL_IDS.filter((stage) => new RegExp(`\\b${stage}\\b`, "i").test(text))
    chips.push({
      key: "funnel",
      label: named.length ? t("funnel_label", { stages: named.map((stage) => FUNNEL_STAGES[stage].label).join(" / ") }) : t("funnel_mix"),
      detail: snapshot.funnel_mix.map((row) => t("funnel_row", { label: row.label, actual: row.actual_pct, target: row.target_pct })).join(" · "),
    })
  }

  const totals = snapshot.totals_30d
  if (totals.posts > 0 || snapshot.weekly.target > 0) {
    const parts = [t("last_30", { posts: plural(t, "posts", totals.posts) }), t("views", { count: whole(totals.views) })]
    if (totals.engagement_rate !== null) parts.push(t("engagement", { rate: totals.engagement_rate.toFixed(1) }))
    parts.push(
      plural(t, "leads", totals.leads),
      t("this_week", { published: snapshot.weekly.published, target: snapshot.weekly.target })
    )
    chips.push({ key: "performance", label: t("title_performance"), detail: parts.join(" · ") })
  }

  const recent = context.recent_titles.length
  const ranked = snapshot.recommendations.length
  if (recent || ranked) {
    const parts = [
      recent ? plural(t, "recent_titles", recent) : "",
      ranked ? t("ranked_ideas", { ideas: plural(t, "ranked", ranked) }) : "",
    ]
    chips.push({
      key: "content",
      label: t("title_content"),
      detail: t("content_detail", { parts: parts.filter(Boolean).join(" · ") }),
    })
  }

  const problems = context.problems.length
  const questions = context.questions.length
  if (problems || questions) {
    const counts = [problems ? plural(t, "problems", problems) : "", questions ? plural(t, "audience_questions", questions) : ""]
    const top = context.problems[0]?.problem || context.questions[0]?.question
    chips.push({
      key: "problems",
      label: t("title_problems"),
      detail: `${counts.filter(Boolean).join(t("list_and"))}${top ? t("most_relevant", { text: clip(top, 90) }) : ""}`,
    })
  }

  if (snapshot.winners.length) {
    const best = [...snapshot.winners].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0]
    const ratio = times(best.ratio)
    chips.push({
      key: "winners",
      label: t("winners_label", { count: snapshot.winners.length }),
      detail: `${t("winners_detail", { title: clip(best.title, 80) })}${ratio ? t("winners_ratio", { ratio }) : ""}`,
    })
  }

  return chips
}
