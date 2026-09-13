/**
 * Offline Content Strategist (spec §56–57): answers by intent — what to post, why something
 * underperforms, which platform, where leads come from, what to stop, N ideas about X, turn an
 * experience into posts, what to double down on, best hooks, next week's plan, buffer/pace — always
 * leading with the answer, then the reasoning, with the real numbers from the analytics snapshot.
 */
import { HOOK_CATEGORIES, PLATFORMS } from "@/lib/constants"
import type { HookCategory, PlatformId } from "@/lib/types"
import type { AnalyticsSnapshot, BrandContext } from "../context"
import type { Kit } from "./brand"
import { experienceStory, parseExperience } from "./experience"
import { hookSlots, writeHook } from "./hooks"
import { generateOfflineIdeas } from "./ideas"
import { clip, headline, looksTagalog, lowerFirst, stripEndPunct, truncateWords } from "./text"
import { analyzeTopic, isWeakSubject } from "./topic"

export interface StrategistReply {
  reply: string
  suggested_ideas: { title: string; hook: string; pillar_id: string | null; platform: PlatformId; format: string }[]
  follow_up_questions: string[]
}

type Intent = "greeting" | "ideas" | "what_to_post" | "underperforming" | "experience" | "double_down" | "hooks" | "plan" | "buffer" | "platform" | "leads" | "stop" | "summary"
type Group = AnalyticsSnapshot["platforms"][number]
type Suggestion = StrategistReply["suggested_ideas"][number]

const fmt = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits }))
const x = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n.toFixed(1)}×`)
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`

const PLATFORM_PATTERNS: [PlatformId, RegExp][] = [
  ["tiktok", /\btiktok\b/],
  ["facebook", /\bfacebook\b|\bfb\b/],
  ["instagram", /\binstagram\b|\big\b/],
  ["youtube", /\byoutube\b|\byt\b/],
  ["linkedin", /\blinkedin\b/],
  ["x", /\btwitter\b|\bx\b/],
  ["threads", /\bthreads\b/],
]
const mentionedPlatforms = (message: string) => PLATFORM_PATTERNS.filter(([, re]) => re.test(message.toLowerCase())).map(([id]) => id)

export function detectIntent(message: string): Intent {
  const m = message.toLowerCase().trim()
  if (/^(hi|hello|hey|yo|hiya|good (morning|afternoon|evening)|kumusta|musta|uy|hoy)\b[\s!.?]*$/.test(m) || m.replace(/[^a-z]/g, "").length <= 3) return "greeting"
  if (/\b\d+\s+(?:content\s+|post\s+|video\s+)?ideas?\b|\bideas?\s+(?:about|on|for)\b|\bgive me (?:some |a few )?ideas\b|\bmga idea\b/.test(m)) return "ideas"
  if (/turn (?:this|my|an|that|it) (?:experience|story|moment)|(?:something|this) happened|\bi just (?:had|went|finished|closed|lost|hired|fired|got)\b|\bnangyari\b|into (?:a )?(?:post|content)/.test(m)) return "experience"
  if (/what (?:should|do|can) i post|what to post|post (?:today|next|tomorrow)|\bano(?:ng)?\b.*\bi-?post\b|\bi-?post\b.*\b(?:ngayon|bukas)\b|ipopost/.test(m)) return "what_to_post"
  if (/\bstop (?:doing|posting|making)\b|should i stop|what (?:should|can) i (?:stop|cut|drop)|\bless of\b|\bitigil\b/.test(m)) return "stop"
  if (/underperform|not working|isn't working|aren't working|flop|low views|why (?:is|are|did|does|do) .*(?:low|down|bad|poor|dropping|weak|worse)|walang views|mahina|struggling/.test(m)) return "underperforming"
  if (/\bleads?\b|inquir\w*|\bclients? from\b|\bsales from\b|convert\w*|\bbookings?\b|\bbenta\b/.test(m)) return "leads"
  const platforms = mentionedPlatforms(m)
  if (platforms.length >= 2 || /which platform|best platform|where should i (?:post|focus)/.test(m) || (platforms.length === 1 && /\b(focus|more|less|worth|better|vs|versus)\b/.test(m))) return "platform"
  if (/double down|what(?:'s| is) working|best (?:performing|content|posts?)|winners?|what worked/.test(m)) return "double_down"
  if (/\bhooks?\b/.test(m)) return "hooks"
  if (/(?:next|this) week|weekly plan|plan my|schedule|calendar/.test(m)) return "plan"
  if (/buffer|consisten|behind|on track|pace|how am i doing/.test(m)) return "buffer"
  return "summary"
}

/** "Give me 5 ideas about hiring" → "hiring"; never a pronoun ("…work best for me"). */
function topicAfter(message: string): string {
  const m = /\b(?:about|on|for|regarding|tungkol sa)\s+(.+)$/i.exec(message)
  const topic = m ? stripEndPunct(m[1]).replace(/^(my|our|the)\s+/i, "") : ""
  return topic && !isWeakSubject(topic) && !/^(me|us|my brand|my business|myself)$/i.test(topic) ? topic : ""
}

function mentioned<T extends { label: string }>(message: string, rows: T[]): T | undefined {
  const m = message.toLowerCase()
  return rows.find((r) => r.label && m.includes(r.label.toLowerCase()))
}

function asPlatform(value: string): PlatformId {
  return (Object.keys(PLATFORMS) as PlatformId[]).includes(value as PlatformId) ? (value as PlatformId) : "facebook"
}

/** A hook for a title that came without one: a first-person title opens as the story it is; the rest use the brand's best style. */
function fallbackHook(kit: Kit, title: string): string {
  const topic = analyzeTopic(title)
  if (/^(?:i|we|my|our)\b/i.test(title)) {
    const parts = parseExperience(title, kit)
    return writeHook("story", hookSlots(topic, kit, { subject: parts.subject, story: experienceStory(parts) }), kit).text
  }
  const story = kit.storyFor(title, { minHits: 2 })
  const category = story ? "story" : (kit.hookCategories().find((c) => c !== "story") ?? "curiosity")
  return writeHook(category, hookSlots(topic, kit, { story, subject: kit.subjectFor(title) }), kit).text
}

function ideaSuggestion(ctx: BrandContext, kit: Kit, title: string, platform: PlatformId, pillarId: string | null, hook = "", formatId: string | null = null): Suggestion {
  const format = ctx.formats.find((f) => f.id === formatId) ?? kit.formatFor(platform)
  return { title, hook: hook || fallbackHook(kit, title), pillar_id: pillarId, platform, format: format?.name ?? "" }
}

const toSuggestion = (i: Suggestion): Suggestion => ({ title: i.title, hook: i.hook, pillar_id: i.pillar_id, platform: i.platform, format: i.format })

const ranked = (rows: Group[], min: number, dir: "best" | "worst") =>
  rows.filter((g) => g.posts >= min && g.ratio !== null).sort((a, b) => (dir === "best" ? (b.ratio ?? 0) - (a.ratio ?? 0) : (a.ratio ?? 0) - (b.ratio ?? 0)))

/** "I just fired a client…" → "the time I fired a client…"; "The ₱380k test…" → "the ₱380k test…". */
function momentPhrase(title: string): string {
  const t = stripEndPunct(title)
  if (/^(?:i|we)\b/i.test(t)) return `the time ${t.replace(/^i\b/, "I").replace(/^we\b/i, "we").replace(/^(I|we)\s+just\s+/, "$1 ")}`
  return /^[A-Z][a-z]/.test(t) ? lowerFirst(t) : t
}

export function strategistOffline(ctx: BrandContext, kit: Kit, messages: { role: "user" | "assistant"; content: string }[], s: AnalyticsSnapshot): StrategistReply {
  const userTurns = messages.filter((m) => m.role === "user")
  const last = userTurns[userTurns.length - 1]?.content.trim() ?? ""
  // A short follow-up ("Why?") is read together with the question before it.
  const probe = last.split(/\s+/).length < 4 && userTurns.length > 1 ? `${userTurns[userTurns.length - 2].content} ${last}` : last
  const intent = detectIntent(probe)
  // A question asked in Taglish gets its headline lines back in Taglish.
  const say = (en: string, tl: string) => (looksTagalog(last) ? tl : kit.say(en, tl))
  const measured = s.platforms.reduce((n, p) => n + p.posts, 0)
  const noData = measured === 0
  const lines: string[] = []
  let suggested: Suggestion[] = []
  const worstPillar = ranked(s.pillars, 3, "worst")[0]
  const bestPillar = ranked(s.pillars, 3, "best")[0]
  const bestPlatform = ranked(s.platforms, 2, "best")[0]
  const bestHook = ranked(s.hook_styles, 2, "best")[0]
  const bestFormat = ranked(s.formats, 2, "best")[0]
  const w = s.weekly
  const missing = Math.max(0, w.target - w.published - w.scheduled_remaining)
  const pace = say(
    `You're at ${w.published}/${w.target} posts this week with ${w.scheduled_remaining} scheduled and ${plural(w.days_left, "day")} left — ${w.on_track ? "on track" : `${missing} more needed`}.`,
    `Nasa ${w.published}/${w.target} posts ka this week, ${w.scheduled_remaining} ang naka-schedule at ${plural(w.days_left, "day")} na lang ang natitira — ${w.on_track ? "on track ka" : `kulang pa ng ${missing}`}.`
  )
  const followUps: string[] = []
  const area = ctx.brand.expertise_areas[0]?.toLowerCase()

  switch (intent) {
    case "greeting": {
      const name = kit.firstName
      lines.push(say(`**Hi${name ? ` ${name}` : ""}! Here's where things stand:**`, `**Kumusta${name ? `, ${name}` : ""}! Ito ang status mo ngayon:**`), "")
      if (noData && !s.recommendations.length) {
        lines.push("- Your workspace is still empty — no measured posts and no ideas to rank yet.", "- Start with Brand HQ and a few ideas in the Idea Bank (Quick Capture works); I'll take it from there.")
      } else {
        lines.push(
          `- **Content Health:** ${s.health.score}/100${s.health.band ? ` (${s.health.band})` : ""}`,
          `- **This week:** ${w.published}/${w.target} posts published, ${w.scheduled_remaining} scheduled`,
          `- **Buffer:** ${fmt(s.buffer.days, 1)} days of ready content`
        )
        if (s.recommendations[0]) lines.push(`- **Next up:** “${s.recommendations[0].title}”`)
      }
      lines.push("", say("Ask me what to post today, why something is underperforming, or to plan your week.", "Tanungin mo ako kung ano ang ipo-post today, bakit mahina ang isang pillar, o i-plan natin ang week mo."))
      followUps.push("What should I post today?", "What's working best right now?", "Plan my next week")
      break
    }
    case "what_to_post": {
      const [pick, ...rest] = s.recommendations
      if (!pick) {
        lines.push("**Nothing is queued to recommend yet.** Add a few ideas to the Idea Bank (Quick Capture works) and I'll rank them against your pillar gaps, today's slot and what's been winning.")
        followUps.push(area ? `Give me 5 ideas about ${area}` : "Give me 5 ideas", "How's my buffer?", "Plan my next week")
        break
      }
      const label = PLATFORMS[asPlatform(pick.platform)]?.label ?? pick.platform
      lines.push(`${say(`**Post this next: “${pick.title}”**`, `**I-post mo 'to next: “${pick.title}”**`)} — ${label}, decision score ${pick.score}/100.`)
      if (pick.hook) lines.push(`Hook: “${pick.hook}”`)
      lines.push("", `- **Why this topic:** ${pick.reasons.topic}`, `- **Why ${label}:** ${pick.reasons.platform}`, `- **Format:** ${pick.reasons.format}`, `- **Angle:** ${pick.reasons.angle}`)
      if (rest.length) lines.push("", `Backups: ${rest.slice(0, 2).map((r) => `“${r.title}” (${r.score})`).join(" · ")}`)
      lines.push("", pace)
      suggested = [pick, ...rest.slice(0, 2)].map((r) => ideaSuggestion(ctx, kit, r.title, asPlatform(r.platform), r.pillar_id, r.hook, r.format_id))
      followUps.push(`Write the script for “${truncateWords(pick.title, 8)}”`, "Plan my next week", "What's working best right now?")
      break
    }
    case "underperforming": {
      if (noData) {
        lines.push("**I can't diagnose performance yet — there are no measured posts in the last 90 days.** Log analytics for at least five posts (Add Metrics on Today or Analytics) and ask again; I'll compare pillars, formats, platforms and hook styles against your average.")
        followUps.push("What should I post today?", "Plan my next week", "How's my buffer?")
        break
      }
      const target = mentioned(probe, s.pillars) ?? mentioned(probe, s.formats) ?? mentioned(probe, s.platforms) ?? mentioned(probe, s.hook_styles) ?? worstPillar
      if (!target) {
        lines.push(`Nothing is clearly underperforming — every group with 3+ measured posts is within range of your average. The bigger lever right now is the mix: ${s.mix_warnings[0] ?? "keep pillars close to their targets"}.`)
        followUps.push("What should I double down on?", "What should I post today?", "Plan my next week")
        break
      }
      const isPillar = s.pillars.includes(target)
      const weakPosts = s.underperformers.filter((u) => !isPillar || u.pillar_id === target.key).slice(0, 3)
      const stats = `${fmt(target.avg_views)} avg views across ${plural(target.posts, "post")}, ${fmt(target.engagement_rate, 1)}% engagement${target.leads ? `, ${plural(target.leads, "lead")}` : ""}`
      if (target.ratio !== null && target.ratio >= 1) {
        lines.push(`**${target.label} isn't underperforming overall — it's at ${x(target.ratio)} your average views** (${stats}).`)
        if (weakPosts.length) {
          lines.push("", "**The dip is in specific posts:**")
          weakPosts.forEach((u) => lines.push(`- “${u.title}” — ${x(u.ratio)} baseline, ${fmt(u.views)} views${u.hook ? `. Hook: “${truncateWords(u.hook, 12)}”` : ""}`))
        } else {
          lines.push("", "No single recent post is dragging it down — if it feels slow, compare the last 30 days in Analytics.")
        }
      } else {
        lines.push(`**${target.label} is running at ${x(target.ratio)} your average views** — ${stats}.`, "", "**What the numbers suggest:**")
        const mix = s.pillar_mix.find((p) => p.label === target.label)
        if (mix && mix.actual_pct > mix.target_pct + 5) lines.push(`- You're over-posting it: ${fmt(mix.actual_pct)}% of your recent mix vs a ${fmt(mix.target_pct)}% target — the audience is seeing more of the same.`)
        if (weakPosts.length) lines.push(`- Weakest recent posts: ${weakPosts.map((wp) => `“${wp.title}” (${x(wp.ratio)} baseline)`).join(", ")}${weakPosts[0].hook ? ` — the first opens with “${truncateWords(weakPosts[0].hook, 10)}”` : ""}.`)
        if (bestHook && bestHook.label !== target.label) lines.push(`- Your ${bestHook.label.toLowerCase()} hooks average ${x(bestHook.ratio)} your views; if these posts use other openers, that explains part of the gap.`)
        if (bestFormat && bestFormat.label !== target.label) lines.push(`- ${bestFormat.label} is your strongest format (${x(bestFormat.ratio)}).`)
      }
      lines.push("", say("**One experiment for next week:**", "**Isang experiment para next week:**"))
      lines.push(`- Take your next ${target.label} topic and open it with a ${bestHook ? bestHook.label.toLowerCase() : "story"} hook${bestPlatform ? ` on ${bestPlatform.label} (${x(bestPlatform.ratio)} your average)` : ""}. Keep everything else the same so you know what moved the number.`)
      if (isPillar) suggested = generateOfflineIdeas(ctx, kit, { count: 2, pillarId: target.key, platform: bestPlatform ? asPlatform(bestPlatform.key) : null }).map(toSuggestion)
      followUps.push(`Give me 5 ideas about ${target.label}`, "What should I post today?", "Which hooks work best for me?")
      break
    }
    case "platform": {
      const wanted = mentionedPlatforms(probe)
      const rows = wanted.length ? s.platforms.filter((p) => wanted.includes(p.key as PlatformId)) : [...s.platforms].sort((a, b) => b.posts - a.posts).slice(0, 3)
      if (!rows.length) {
        lines.push(`**No measured posts on ${wanted.length ? wanted.map((p) => PLATFORMS[p].label).join(" or ") : "any platform"} yet** — post there at least five times and log the metrics, then I can compare them honestly.`)
        followUps.push("What should I post today?", "Plan my next week", "How's my buffer?")
        break
      }
      lines.push("**Here's how they compare (last 90 days):**", "")
      rows.forEach((r) => lines.push(`- **${r.label}** — ${fmt(r.avg_views)} avg views (${x(r.ratio)} your average), ${fmt(r.engagement_rate, 1)}% engagement, ${plural(r.leads, "lead")} from ${plural(r.posts, "post")}`))
      const reach = [...rows].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0]
      const perPost = (g: Group) => (g.posts ? g.leads / g.posts : 0)
      const converts = [...rows].sort((a, b) => perPost(b) - perPost(a))[0]
      lines.push("")
      if (rows.length >= 2 && reach && converts && reach.key !== converts.key && converts.leads > 0) {
        lines.push(
          `**My call: don't pick one — give each a job.** ${reach.label} is your reach engine (${x(reach.ratio)} your average views), so it gets your TOFU ideas and the hooks you want to test. ${converts.label} converts better (${perPost(converts).toFixed(1)} leads per post vs ${perPost(reach).toFixed(1)}), so it gets your MOFU and BOFU pieces.`
        )
      } else if (reach) {
        lines.push(`**My call: put your best ideas on ${reach.label} first** — it leads on reach (${x(reach.ratio)} your average)${reach.leads ? ` and brought ${plural(reach.leads, "lead")}` : ""}.`)
      }
      rows.slice(0, 2).forEach((r) => {
        const audience = ctx.platforms.find((p) => p.platform === r.key)?.audience
        if (audience) lines.push(`- ${r.label} audience: ${lowerFirst(stripEndPunct(clip(audience, 140)))}.`)
      })
      if (reach) suggested = generateOfflineIdeas(ctx, kit, { count: 2, platform: asPlatform(reach.key) }).map(toSuggestion)
      followUps.push(`Give me 3 ideas for ${reach?.label ?? "my best platform"}`, "Where do my leads come from?", "What should I stop doing?")
      break
    }
    case "leads": {
      if (noData) {
        lines.push("**I can't see where leads come from yet.** Log leads in Add Metrics for your recent posts — then I can tell you which pillars, platforms and CTAs actually bring inquiries.")
        followUps.push("What should I post today?", "Plan my next week", "How's my buffer?")
        break
      }
      const pillarLeads = s.pillars.filter((p) => p.leads > 0).sort((a, b) => b.leads - a.leads)
      const platformLeads = s.platforms.filter((p) => p.leads > 0).sort((a, b) => b.leads - a.leads)
      const bofu = s.funnel_mix.find((f) => f.stage === "bofu")
      lines.push(`**You got ${plural(s.totals_30d.leads, "lead")} in the last 30 days.** Here's where they come from (90 days):`, "")
      if (pillarLeads.length) lines.push(`- **Pillars:** ${pillarLeads.slice(0, 3).map((p) => `${p.label} (${p.leads} from ${plural(p.posts, "post")})`).join(", ")}`)
      if (platformLeads.length) lines.push(`- **Platforms:** ${platformLeads.slice(0, 3).map((p) => `${p.label} (${p.leads} from ${plural(p.posts, "post")})`).join(", ")}`)
      if (bofu) lines.push(`- **BOFU share:** ${fmt(bofu.actual_pct)}% of your recent mix vs a ${fmt(bofu.target_pct)}% target${bofu.actual_pct < bofu.target_pct ? " — that's the gap" : ""}`)
      lines.push("", "**What I'd do next:**")
      const offer = /book (?:a |an )?([^,.;]+)/i.exec(ctx.brand.cta_style)?.[1]?.trim().replace(/^(a|an)\s+/i, "")
      lines.push(`- Put a direct CTA${offer ? ` (book a ${offer})` : ""} on one of every five posts — keep the rest soft.`)
      if (pillarLeads[0]) lines.push(`- Give ${pillarLeads[0].label} an extra slot next week — it's where your leads already come from.`)
      const bofuIdeas = generateOfflineIdeas(ctx, kit, { count: 2, funnel: "bofu" })
      if (bofuIdeas[0]) lines.push(`- Publish one BOFU piece this week: “${bofuIdeas[0].title}”.`)
      suggested = bofuIdeas.map(toSuggestion)
      followUps.push("Write the BOFU post", "Which platform should I focus on?", "Plan my next week")
      break
    }
    case "stop": {
      if (noData) {
        lines.push("**There isn't enough data to call anything a failure yet.** Log metrics for your recent posts and I'll show you what to cut.")
        followUps.push("What should I post today?", "Plan my next week", "How's my buffer?")
        break
      }
      const weak = (rows: Group[]) => rows.filter((g) => g.posts >= 3 && g.ratio !== null && g.ratio < 0.75).sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0))
      const format = weak(s.formats)[0]
      const hookStyle = weak(s.hook_styles)[0]
      const pillar = weak(s.pillars)[0]
      const over = s.pillar_mix.find((p) => p.actual_pct > p.target_pct + 8)
      const overdue = s.insights.find((i) => /overdue/i.test(i.text))
      lines.push("**Stop (or shrink) these:**", "")
      if (format) lines.push(`- **${format.label} as a default format** — ${x(format.ratio)} your average across ${plural(format.posts, "post")}.${bestFormat && bestFormat.label !== format.label ? ` Test the same topics as ${bestFormat.label} (${x(bestFormat.ratio)}).` : ""}`)
      if (hookStyle) lines.push(`- **${hookStyle.label} hooks** — ${x(hookStyle.ratio)} your average across ${plural(hookStyle.posts, "post")}. Retire them for a month${bestHook ? ` and open with ${bestHook.label.toLowerCase()} hooks (${x(bestHook.ratio)})` : ""}.`)
      if (pillar) lines.push(`- **Posting ${pillar.label} the way you do now** — ${x(pillar.ratio)} your average across ${plural(pillar.posts, "post")}${pillar.leads ? `, though it brought ${plural(pillar.leads, "lead")} — keep the topic, change the format and the hook` : ""}.`)
      if (over) lines.push(`- **Over-posting ${over.label}** — ${fmt(over.actual_pct)}% of your recent mix vs a ${fmt(over.target_pct)}% target.`)
      if (overdue) lines.push(`- ${stripEndPunct(overdue.text)}.`)
      if (lines.length === 2) lines.push("Nothing is clearly failing — every group with 3+ measured posts is within range of your average. Keep the mix close to your pillar targets.")
      followUps.push("What should I double down on?", "Plan my next week", "What should I post today?")
      break
    }
    case "ideas": {
      const count = Math.min(10, Math.max(1, Number(/(\d+)/.exec(probe)?.[1] ?? 5)))
      // "ideas about Personal" / "ideas for my Education pillar" means the pillar, not a topic called "Personal".
      const pillar = ctx.pillars.find((p) => p.name && new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(probe))
      const topic = pillar ? "" : topicAfter(probe)
      const ideas = generateOfflineIdeas(ctx, kit, { count, topic: topic || null, pillarId: pillar?.id ?? null })
      lines.push(`**${ideas.length} ideas${topic ? ` about ${topic}` : pillar ? ` for your ${pillar.name} pillar` : ""}**, built from your Problem Bank, Question Bank, Story Vault and winners:`, "")
      ideas.forEach((idea, n) => lines.push(`${n + 1}. **${idea.title}** — “${idea.hook}” _(${PLATFORMS[idea.platform].label}, ${idea.format || "any format"}, ${idea.angle})_`))
      suggested = ideas.map(toSuggestion)
      followUps.push("Which of these should I post first?", "Write a script for idea 1", "Give me better hooks for these")
      break
    }
    case "experience": {
      const parts = parseExperience(last, kit)
      const story = experienceStory(parts)
      const topic = analyzeTopic(last)
      const title = stripEndPunct(parts.title)
      lines.push(`${say("**That's a real story — here's how I'd use it.**", "**Totoong kwento 'yan — ganito ko siya gagamitin.**")} Save it to your Story Vault as “${title}”.`, "")
      if (parts.lesson) lines.push(`**The lesson:** ${parts.lesson}`, "")
      const on = (p: PlatformId) => (ctx.platforms.some((x2) => x2.platform === p) ? p : (ctx.platforms[0]?.platform ?? p))
      // A moment reads inside a title ("3 lessons from the time I fired a client…"); a cut-off quote doesn't.
      const moment = momentPhrase(title)
      const angles: [string, HookCategory, PlatformId, string][] = [
        ["Storytelling post", "story", on("facebook"), title],
        ["Leadership lesson", "authority", on("linkedin"), parts.lesson ? `Leadership lesson: ${lowerFirst(stripEndPunct(parts.lesson))}` : `What I learned from ${moment}`],
        ["60-second educational video", "list", on("tiktok"), `3 lessons from ${moment}`],
      ]
      const slots = hookSlots(topic, kit, { subject: parts.subject, story })
      angles.forEach(([label, cat, platform, ideaTitle], n) => {
        const hook = writeHook(cat, cat === "list" ? { ...slots, number: 3 } : slots, kit).text
        lines.push(`${n + 1}. **${label}** on ${PLATFORMS[platform].label} — “${ideaTitle}”. Hook: “${hook}”`)
        suggested.push({ title: ideaTitle, hook, pillar_id: kit.pillarFor(`${label} ${last}`)?.id ?? null, platform, format: kit.formatFor(platform)?.name ?? "" })
      })
      lines.push("", "Open Experience → Content for all 8 angles with full drafts.")
      followUps.push("Write the storytelling post in full", "Which angle fits this week's schedule?", "What pillar is this?")
      break
    }
    case "double_down": {
      if (!s.winners.length && noData) {
        lines.push("**No winners yet.** Log metrics for your recent posts — winners are posts at 2× or more of your platform average, and they're the fastest way to know what to repeat.")
        followUps.push("What should I post today?", "Plan my next week", "How's my buffer?")
        break
      }
      lines.push("**Double down on what's already proven:**", "")
      s.winners.slice(0, 3).forEach((win) => {
        const note = ctx.winners.find((cw) => cw.item_id === win.item_id)?.why_it_worked
        lines.push(`- **“${win.title}”** — ${win.tier}${win.ratio ? ` at ${x(win.ratio)}` : ""}, ${fmt(win.views)} views on ${PLATFORMS[asPlatform(win.platform)]?.label ?? win.platform}.${note ? ` Why it worked: ${lowerFirst(clip(note, 150))}` : ""} Make a part 2 or a new-angle version.`)
      })
      if (bestPillar) lines.push(`- **${bestPillar.label}** is your strongest pillar: ${x(bestPillar.ratio)} your average across ${plural(bestPillar.posts, "post")}.`)
      if (bestPlatform) lines.push(`- **${bestPlatform.label}** averages ${x(bestPlatform.ratio)} your views — give it your best ideas first.`)
      if (bestHook) {
        const category = (bestHook.key as HookCategory) in HOOK_CATEGORIES ? (bestHook.key as HookCategory) : "custom"
        lines.push(`- **${bestHook.label} hooks** average ${x(bestHook.ratio)} — ${HOOK_CATEGORIES[category].description.toLowerCase()}.`)
      }
      const repurpose = s.insights.find((i) => /repurpos/i.test(i.text))
      if (repurpose) lines.push(`- ${stripEndPunct(repurpose.text)}.`)
      // A part 2 opens as the continuation it is — not with a generic list hook about a stray keyword.
      suggested = s.winners.slice(0, 3).map((win) => {
        const short = headline(stripEndPunct(win.title), 8)
        const hook = say(`Part 2 of “${short}” — what happened after.`, `Part 2 ng “${short}” — ito ang nangyari after.`)
        return ideaSuggestion(ctx, kit, `${stripEndPunct(win.title)} — part 2`, asPlatform(win.platform), win.pillar_id, hook)
      })
      followUps.push(`Replicate “${truncateWords(s.winners[0]?.title ?? "my best post", 8)}”`, "What should I stop doing?", "Plan my next week")
      break
    }
    case "hooks": {
      const topic = topicAfter(probe) || (s.winners[0] ? kit.subjectFor(s.winners[0].title) : "") || area || "your topic"
      const rankedHooks = [...s.hook_styles].filter((h) => h.posts >= 2).sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
      if (rankedHooks.length) {
        lines.push("**Your hook styles, ranked by average views vs your overall average (90 days):**", "")
        rankedHooks.slice(0, 5).forEach((h) => lines.push(`- **${h.label}** — ${x(h.ratio)} (${plural(h.posts, "post")}, ${fmt(h.engagement_rate, 1)}% ER)`))
      } else {
        lines.push("You haven't measured enough posts per hook style yet, so these follow your personality and pillars instead of data.")
      }
      // One hook per style, best-measured styles first; a story hook borrows the story behind your best winner.
      const measuredStyles = rankedHooks.map((h) => h.key).filter((k): k is HookCategory => k in HOOK_CATEGORIES && k !== "custom")
      const cats = Array.from(new Set([...measuredStyles, ...kit.hookCategories()])).slice(0, 3)
      const story = kit.storyFor(topic, { minHits: 1 }) ?? (s.winners[0] ? kit.storyFor(s.winners[0].title, { minHits: 2 }) : null)
      const slots = hookSlots(analyzeTopic(topic), kit, { story, subject: kit.subjectFor(topic) })
      lines.push("", `**Three hooks for ${topic}:**`)
      cats.forEach((cat) => {
        const h = writeHook(cat, slots, kit)
        lines.push(`- “${h.text}” _(${HOOK_CATEGORIES[h.category].label} — ${lowerFirst(stripEndPunct(HOOK_CATEGORIES[h.category].description))})_`)
      })
      followUps.push("Give me 10 more hooks", "Which hook style should I test next?", "What should I post today?")
      break
    }
    case "plan": {
      lines.push(`**Next week: ${ctx.settings.weekly_post_target} posts.** ${pace}`, "")
      const start = ctx.settings.week_starts_on
      const schedule = [...ctx.schedule].sort((a, b) => ((a.day_of_week - start + 7) % 7) - ((b.day_of_week - start + 7) % 7) || a.label.localeCompare(b.label))
      const used = new Set<string>()
      if (schedule.length) {
        schedule.slice(0, 7).forEach((slot) => {
          const rec = s.recommendations.find((r) => !used.has(r.id) && r.pillar_id && r.pillar_id === slot.pillar_id) ?? s.recommendations.find((r) => !used.has(r.id))
          let title = rec?.title ?? ""
          let pillarId = rec?.pillar_id ?? slot.pillar_id
          let hook = rec?.hook ?? ""
          if (rec) used.add(rec.id)
          else {
            // An empty slot gets a fresh idea from the banks — with the hook written for that idea.
            const [idea] = generateOfflineIdeas(ctx, kit, { count: 1, pillarId: slot.pillar_id, platform: slot.platforms[0] ?? null, avoidTitles: suggested.map((sg) => sg.title) })
            title = idea?.title ?? ""
            pillarId = idea?.pillar_id ?? slot.pillar_id
            hook = idea?.hook ?? ""
          }
          const platform = slot.platforms[0] ?? asPlatform(rec?.platform ?? "")
          lines.push(`- **${slot.day}** — ${slot.label || "open slot"}${slot.platforms.length ? ` (${slot.platforms.map((p) => PLATFORMS[p].label).join(", ")})` : ""}: ${title ? `“${title}”${rec ? "" : " _(new idea)_"}` : "_add an idea_"}`)
          if (title) suggested.push(ideaSuggestion(ctx, kit, title, platform, pillarId, hook, slot.format_id ?? rec?.format_id ?? null))
        })
      } else {
        s.recommendations.forEach((r) => lines.push(`- “${r.title}” on ${PLATFORMS[asPlatform(r.platform)]?.label ?? r.platform} — ${r.reasons.topic}`))
      }
      if (s.mix_warnings[0]) lines.push("", `Balance note: ${stripEndPunct(s.mix_warnings[0])}.`)
      lines.push("", say("Open the Weekly Planner to turn this into scheduled content.", "Buksan mo ang Weekly Planner para ma-schedule na 'to."))
      followUps.push("What should I post today?", "Give me 5 ideas for the empty slots", "What's working best right now?")
      break
    }
    case "buffer": {
      lines.push(`**Content Buffer: ${fmt(s.buffer.days, 1)} days** (${s.buffer.ready_count} ready; target ${plural(s.buffer.target_days, "day")}) — ${s.buffer.label || s.buffer.status}.`, "", pace)
      if (s.buffer.days < s.buffer.target_days) {
        const need = Math.max(1, Math.ceil(((s.buffer.target_days - s.buffer.days) * ctx.settings.weekly_post_target) / 7))
        lines.push("", `To get back to ${plural(s.buffer.target_days, "day")}, batch about ${plural(need, "piece")}${bestFormat ? ` — ${bestFormat.label} is your strongest format, so start there` : ""}.`)
      } else {
        lines.push("", "Your buffer is healthy — use the slack to make one higher-effort piece (a case study or long-form video).")
      }
      followUps.push("Plan my next week", "What should I post today?", "What's working best right now?")
      break
    }
    case "summary": {
      lines.push(`**Content Health ${s.health.score}/100 — ${s.health.band || "not scored yet"}.**`, "")
      const weakest = [...s.health.components].sort((a, b) => a.score / Math.max(1, a.max) - b.score / Math.max(1, b.max)).slice(0, 2)
      if (weakest.length) {
        lines.push("**Biggest levers:**")
        weakest.forEach((c) => lines.push(`- ${c.label} (${fmt(c.score, 1)}/${c.max}): ${c.detail}`))
      }
      if (s.insights.length) {
        lines.push("", "**What the data says:**")
        s.insights.slice(0, 3).forEach((i) => lines.push(`- ${i.text}`))
      }
      const pick = s.recommendations[0]
      if (pick) {
        lines.push("", `**Do this next:** “${pick.title}” on ${PLATFORMS[asPlatform(pick.platform)]?.label ?? pick.platform} — ${stripEndPunct(pick.reasons.topic)}.`)
        suggested = [ideaSuggestion(ctx, kit, pick.title, asPlatform(pick.platform), pick.pillar_id, pick.hook, pick.format_id)]
      }
      followUps.push("What should I post today?", worstPillar ? `Why is ${worstPillar.label} underperforming?` : "What's working best right now?", "Plan my next week")
      break
    }
  }

  const closing = kit.phrase(probe)
  if (closing && intent !== "ideas" && intent !== "greeting") lines.push("", `_${stripEndPunct(closing)}._`)
  return {
    reply: kit.scrub(lines.join("\n")),
    suggested_ideas: kit.scrubDeep(suggested.slice(0, 10)),
    follow_up_questions: followUps.slice(0, 3),
  }
}
