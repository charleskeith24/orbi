/**
 * Weekly Report review (spec §33) and Monthly Review (spec §34). Inputs are compact, serialisable
 * summaries of the analytics reports — build them with `buildWeeklyReviewInput` / `buildMonthlyReviewInput`.
 */
import * as z from "zod"
import { EXPERIMENT_TEMPLATES } from "@/lib/constants"
import { createKit } from "../offline/brand"
import { seedFor, truncateWords } from "../offline/text"
import { defineTask, uniqueStrings } from "./shared"

const n = z.number().catch(0)
const nn = z.number().nullable().catch(null)
const s = (max = 300) => z.string().max(max).catch("")

export const postSummarySchema = z.object({
  title: s(300),
  platform: s(20),
  views: n,
  ratio: nn,
  engagement_rate: nn,
  hook: s(300),
  pillar: s(80),
  tier: s(12),
})
export const highlightSchema = z.object({ label: s(80), value: n, metric_label: s(40), posts: n })
export const groupSummarySchema = z.object({ label: s(80), posts: n, avg_views: nn, engagement_rate: nn, leads: n, winners: n })
const totalsSchema = z.object({
  posts: n,
  views: n,
  reach: n,
  engagements: n,
  engagement_rate: nn,
  leads: n,
  sales: n,
  followers: n,
  saves: n,
  shares: n,
  comments: n,
})
const deltasSchema = z.object({ posts: nn, views: nn, engagements: nn, engagement_rate: nn, leads: nn, followers: nn }).partial()

export const weeklyReportSummarySchema = z.object({
  week_start: s(10),
  week_end: s(10),
  in_progress: z.boolean().catch(false),
  published: n,
  target: n,
  consistency_pct: n,
  totals: totalsSchema,
  deltas: deltasSchema.catch({}),
  best_post: postSummarySchema.nullable().catch(null),
  worst_post: postSummarySchema.nullable().catch(null),
  best_platform: highlightSchema.nullable().catch(null),
  best_pillar: highlightSchema.nullable().catch(null),
  best_topic: highlightSchema.nullable().catch(null),
  best_format: highlightSchema.nullable().catch(null),
  best_hook: highlightSchema.nullable().catch(null),
  pillar_mix: z.array(z.object({ label: s(80), actual_pct: n, target_pct: n })).max(12).catch([]),
  mix_warnings: z.array(s(240)).max(8).catch([]),
  top_posts: z.array(postSummarySchema).max(10).catch([]),
  winners: n,
  ranked_by: s(30),
})

export const monthlyReportSummarySchema = z.object({
  month: s(40),
  in_progress: z.boolean().catch(false),
  totals: totalsSchema,
  deltas: deltasSchema.catch({}),
  audience_growth: z.object({ total: n, by_platform: z.array(z.object({ label: s(30), followers_gained: n })).max(8).catch([]) }),
  total_reach: n,
  total_content: n,
  best_content: postSummarySchema.nullable().catch(null),
  top_posts: z.array(postSummarySchema).max(10).catch([]),
  platforms: z.array(groupSummarySchema).max(8).catch([]),
  pillars: z.array(groupSummarySchema).max(10).catch([]),
  formats: z.array(groupSummarySchema).max(15).catch([]),
  topics: z.array(groupSummarySchema).max(10).catch([]),
  leads: z.object({ total: n, by_pillar: z.array(z.object({ label: s(80), leads: n, sales: n })).max(10).catch([]), by_platform: z.array(z.object({ label: s(30), leads: n, sales: n })).max(8).catch([]) }),
  business: z.object({ posts: n, leads: n, sales: n, link_clicks: n }),
  consistency: z.object({ weeks_total: n, weeks_hit: n, weeks_consistent: n }),
  winners: n,
  ranked_by: s(30),
})

export type WeeklyReportSummary = z.output<typeof weeklyReportSummarySchema>
export type MonthlyReportSummary = z.output<typeof monthlyReportSummarySchema>

const fmt = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits }))
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "" : `${v > 0 ? "+" : ""}${Math.round(v)}%`)
const post = (p: z.output<typeof postSummarySchema>) =>
  `“${truncateWords(p.title, 12)}” (${fmt(p.views)} views on ${p.platform}${p.ratio ? `, ${p.ratio.toFixed(1)}× baseline` : ""})`
const isRate = (label: string) => /rate|%/i.test(label)
/** "12,137 avg. views" or "8.4% engagement rate" — views are never shown with decimals. */
const metric = (h: z.output<typeof highlightSchema>) => `${fmt(h.value, isRate(h.metric_label) ? 1 : 0)}${isRate(h.metric_label) ? "%" : ""} ${h.metric_label}`
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`
const hl = (h: z.output<typeof highlightSchema>) => `${metric(h)} across ${plural(h.posts, "post")}`

/* --------------------------------- Weekly ---------------------------------- */

const weeklyOutput = z.object({
  what_worked: z.string(),
  what_didnt: z.string(),
  learned: z.string(),
  double_down: z.string(),
  stop: z.string(),
  test_next: z.string(),
})

export const weeklyReviewTask = defineTask({
  name: "weekly_review",
  description: "Weekly Report review: what worked, what didn't, what we learned, what to double down on, stop and test next — citing the week's numbers.",
  input: z.object({ report: weeklyReportSummarySchema, focus: z.string().max(300).default("") }),
  output: weeklyOutput,
  maxTokens: 2500,

  buildPrompt(_ctx, i) {
    return {
      user: [
        `Task: write the weekly review for ${i.report.week_start} – ${i.report.week_end}${i.report.in_progress ? " (week still in progress — deltas compare the same days of last week)" : ""}.`,
        i.focus ? `This week's focus was: ${i.focus}` : "",
        `<weekly_report>\n${JSON.stringify(i.report, null, 1)}\n</weekly_report>`,
        "Each field is 1–3 sentences, specific and in the creator's voice, citing the numbers above (posts, views, rates, deltas, best/worst posts). test_next proposes one concrete experiment with a hypothesis and the metric to watch. If there's little data, say so plainly and focus on what to log and publish.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("weekly_review", i))
    const r = i.report
    if (!r.published) {
      return {
        what_worked: "Nothing was published this week, so there's no performance to learn from yet.",
        what_didnt: `Consistency: 0/${r.target} posts. The week slipped before anything went out.`,
        learned: "A week without posts usually means the buffer ran dry — the fix is production, not ideas.",
        double_down: "Batch two or three pieces from your highest-scored ideas in one sitting this weekend.",
        stop: "Stop waiting for the perfect idea — ship what's closest to ready.",
        test_next: `Test a fixed batching day: produce ${Math.max(2, Math.ceil(r.target / 2))} pieces every Sunday for two weeks and watch whether you hit your ${r.target}-post target.`,
      }
    }
    const worked = [
      r.best_post ? `${post(r.best_post)} was your best post${r.best_post.hook ? ` — hook: “${truncateWords(r.best_post.hook, 12)}”` : ""}.` : "",
      r.best_pillar ? `${r.best_pillar.label} led the pillars with ${hl(r.best_pillar)}.` : "",
      r.best_platform ? `${r.best_platform.label} was the strongest platform (${metric(r.best_platform)}).` : "",
      r.deltas.views !== undefined && r.deltas.views !== null && r.deltas.views > 0 ? `Views ${pct(r.deltas.views)} vs last week.` : "",
    ].filter(Boolean)
    const didnt = [
      r.consistency_pct < 100 ? `Consistency: ${r.published}/${r.target} posts (${Math.round(r.consistency_pct)}%).` : "",
      r.worst_post ? `${post(r.worst_post)} underperformed.` : "",
      r.deltas.engagement_rate !== undefined && r.deltas.engagement_rate !== null && r.deltas.engagement_rate < 0 ? `Engagement rate ${pct(r.deltas.engagement_rate)} vs last week.` : "",
      r.mix_warnings[0] ? `${r.mix_warnings[0]}.` : "",
    ].filter(Boolean)
    const hookLabel = r.best_hook?.label
    const learned = [
      hookLabel ? `${hookLabel} hooks carried the week — ${hl(r.best_hook!)}.` : "",
      r.best_format ? `${r.best_format.label} was the format that worked best.` : "",
      r.best_post && r.worst_post && r.best_post.platform !== r.worst_post.platform ? `Same week, different platforms: ${r.best_post.platform} rewarded what ${r.worst_post.platform} didn't.` : "",
    ].filter(Boolean)
    const template = EXPERIMENT_TEMPLATES.find((t) => (hookLabel === "Story" ? t.name.includes("Storytelling") : t.name.includes("hooks"))) ?? EXPERIMENT_TEMPLATES[0]
    return kit.scrubDeep({
      what_worked: worked.join(" ") || "Every post landed close to your average — steady, but no standout.",
      what_didnt: didnt.join(" ") || "No clear misses this week.",
      learned: learned.join(" ") || "Not enough measured posts to separate signal from noise yet — log metrics for every post this week.",
      double_down: r.best_post
        ? `Make a follow-up to “${truncateWords(r.best_post.title, 10)}”${r.best_pillar ? ` and give ${r.best_pillar.label} at least two slots next week` : ""}${hookLabel ? `, opening with ${hookLabel.toLowerCase()} hooks` : ""}.`
        : "Repeat the pillar and format that got the most engagement.",
      stop: r.worst_post
        ? `Stop publishing ${r.worst_post.pillar ? `${r.worst_post.pillar} ` : ""}posts without a sharp first line — “${truncateWords(r.worst_post.title, 10)}” got ${fmt(r.worst_post.views)} views.`
        : r.mix_warnings[0]
          ? `Stop over-weighting one pillar: ${r.mix_warnings[0]}.`
          : "Stop posting without logging metrics — you can't learn from what you don't measure.",
      test_next: `${template.name}: ${template.hypothesis.toLowerCase()}. Run ${template.variant_a} vs ${template.variant_b} on ${r.best_platform?.label ?? "your main platform"} (two posts each) and compare ${template.metric.replace(/_/g, " ")}.`,
    })
  },
})

/* --------------------------------- Monthly --------------------------------- */

const monthlyOutput = z.object({
  summary: z.string().describe("3–4 sentences with the month's key numbers"),
  continue_doing: z.array(z.string()),
  increase: z.array(z.string()),
  reduce: z.array(z.string()),
  stop: z.array(z.string()),
  experiment: z.array(z.string()),
})

export const monthlyReviewTask = defineTask({
  name: "monthly_review",
  description: "Monthly Review: summary plus continue / increase / reduce / stop / experiment, grounded in the month's report.",
  input: z.object({ report: monthlyReportSummarySchema }),
  output: monthlyOutput,
  maxTokens: 3000,

  buildPrompt(_ctx, i) {
    return {
      user: [
        `Task: write the Monthly Review for ${i.report.month}${i.report.in_progress ? " (month in progress — deltas compare the same days of last month)" : ""}.`,
        `<monthly_report>\n${JSON.stringify(i.report, null, 1)}\n</monthly_report>`,
        "summary: 3–4 sentences with the key numbers. Each list: 1–4 specific, actionable items citing the numbers (pillars, platforms, formats, topics, leads, consistency). Reduce/stop only what the data shows is weak (enough posts to judge). experiment: 1–3 concrete tests with the metric to watch.",
      ].join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("monthly_review", i))
    const r = i.report
    const measured = [...r.pillars, ...r.platforms, ...r.formats].filter((g) => g.posts > 0)
    const totalViews = r.platforms.reduce((a, g) => a + (g.avg_views ?? 0) * g.posts, 0)
    const totalPosts = r.platforms.reduce((a, g) => a + g.posts, 0)
    const avg = totalPosts ? totalViews / totalPosts : null
    const ratio = (g: z.output<typeof groupSummarySchema>) => (avg && g.avg_views !== null ? g.avg_views / avg : null)
    const strong = (rows: z.output<typeof groupSummarySchema>[]) => rows.filter((g) => g.posts >= 2 && (ratio(g) ?? 0) >= 1.15).sort((a, b) => (ratio(b) ?? 0) - (ratio(a) ?? 0))
    const weak = (rows: z.output<typeof groupSummarySchema>[], below: number) => rows.filter((g) => g.posts >= 3 && (ratio(g) ?? 1) < below).sort((a, b) => (ratio(a) ?? 0) - (ratio(b) ?? 0))
    const stats = (g: z.output<typeof groupSummarySchema>) => `${fmt(g.avg_views)} avg views (${(ratio(g) ?? 0).toFixed(1)}× your average) across ${plural(g.posts, "post")}${g.leads ? `, ${plural(g.leads, "lead")}` : ""}`
    const monthLabel = r.month || "this month"
    // Don't tell the creator to cut what brings in leads, even when its views are low.
    const leadRate = r.total_content ? r.leads.total / r.total_content : 0
    const bringsLeads = (g: z.output<typeof groupSummarySchema>) => g.posts > 0 && leadRate > 0 && g.leads / g.posts >= leadRate * 1.2

    if (!r.total_content) {
      return {
        summary: `Nothing was published in ${monthLabel}, so there's no performance to review yet.`,
        continue_doing: [],
        increase: ["Publishing volume — start with two posts a week you can sustain."],
        reduce: [],
        stop: ["Waiting for perfect ideas before posting."],
        experiment: ["Batch four pieces in one session and schedule them across two weeks."],
      }
    }
    const summary = [
      `${r.month || "This month"}: ${r.total_content} posts, ${fmt(r.total_reach)} reach${r.deltas.views !== undefined && r.deltas.views !== null ? ` (views ${pct(r.deltas.views)} vs last month)` : ""}, ${fmt(r.audience_growth.total)} new followers and ${fmt(r.leads.total)} leads.`,
      r.best_content ? `Best piece: ${post(r.best_content)}.` : "",
      `You hit your weekly target in ${r.consistency.weeks_hit} of ${r.consistency.weeks_total} weeks${r.winners ? `, with ${r.winners} winner${r.winners === 1 ? "" : "s"}` : ""}.`,
    ]
      .filter(Boolean)
      .join(" ")
    const strongGroups = [...strong(r.formats).slice(0, 1), ...strong(r.platforms).slice(0, 1), ...strong(r.pillars).slice(0, 1)]
    const weakGroups = [...weak(r.pillars, 0.7), ...weak(r.formats, 0.7), ...weak(r.platforms, 0.7)].filter((g) => !bringsLeads(g))
    const stopGroups = [...weak(r.formats, 0.45), ...weak(r.topics, 0.45)].filter((g) => !bringsLeads(g))
    const leadPillar = [...r.leads.by_pillar].sort((a, b) => b.leads - a.leads)[0]
    return kit.scrubDeep({
      summary,
      continue_doing: uniqueStrings(
        [
          ...strongGroups.map((g) => `Keep ${g.label}: ${stats(g)}.`),
          r.best_content ? `Keep the structure of “${truncateWords(r.best_content.title, 10)}” — replicate it from a new angle.` : "",
        ].filter(Boolean),
        4
      ),
      increase: uniqueStrings(
        [
          ...strong(r.pillars).slice(0, 2).map((g) => `More ${g.label}: ${fmt(g.avg_views)} avg views from only ${g.posts} posts.`),
          leadPillar?.leads ? `More ${leadPillar.label} content with a clear CTA — it produced ${leadPillar.leads} of your ${r.leads.total} leads.` : "",
          r.consistency.weeks_hit < r.consistency.weeks_total ? `Consistency — you missed the target in ${r.consistency.weeks_total - r.consistency.weeks_hit} week${r.consistency.weeks_total - r.consistency.weeks_hit === 1 ? "" : "s"}; build a 7-day buffer.` : "",
        ].filter(Boolean),
        4
      ),
      reduce: uniqueStrings(weakGroups.slice(0, 3).map((g) => `Less ${g.label}: ${stats(g)}.`), 3),
      stop: uniqueStrings(
        [
          ...stopGroups.slice(0, 2).map((g) => `Stop ${g.label} in its current form: ${stats(g)}.`),
          r.business.posts && !r.business.leads ? `Stop BOFU posts without a direct CTA — ${r.business.posts} conversion posts produced 0 leads.` : "",
        ].filter(Boolean),
        3
      ),
      experiment: uniqueStrings(
        [
          strongGroups[0] && weakGroups[0] && strongGroups[0].label !== weakGroups[0].label
            ? `Take one ${weakGroups[0].label} topic and publish it as ${strongGroups[0].label} — does the format or the topic drive the gap?`
            : "",
          `${EXPERIMENT_TEMPLATES[0].name}: ${EXPERIMENT_TEMPLATES[0].variant_a} vs ${EXPERIMENT_TEMPLATES[0].variant_b}, measured on ${EXPERIMENT_TEMPLATES[0].metric.replace(/_/g, " ")}.`,
          measured.length < 3 ? "Log metrics for every post next month so the review can compare pillars and formats properly." : "",
        ].filter(Boolean),
        3
      ),
    })
  },
})
