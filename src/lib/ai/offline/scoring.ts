/**
 * Transparent offline scoring. Content Score (spec §28) is a quality evaluation — never a
 * virality prediction; Idea Score (spec §39) rates seven 1–10 dimensions. Every point comes
 * from a visible heuristic, and every improvement is a concrete edit.
 */
import { IDEA_SCORE_DIMENSIONS, PLATFORMS, SCRIPT_FORMATS } from "@/lib/constants"
import { computeIdeaScore, priorityFromScore } from "@/lib/scoring"
import type { FunnelStage, IdeaScores, PlatformId, ScriptFormat } from "@/lib/types"
import type { BrandContext } from "../context"
import type { Kit } from "./brand"
import { hookSlots, writeHook } from "./hooks"
import { clean, jaccard, splitSentences, stripEndPunct, tokenSet, truncateWords } from "./text"
import { analyzeTopic } from "./topic"

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)))

const CLICHES = [
  "in today's fast-paced world",
  "unlock your potential",
  "game-changer",
  "game changer",
  "level up",
  "take it to the next level",
  "dive in",
  "let's dive",
  "at the end of the day",
  "think outside the box",
  "hustle",
  "grind",
  "synergy",
  "leverage",
  "journey to success",
]
const FILLER_OPENERS = /^(hi|hello|hey)\b|^(so|okay|ok),?\s|^(in this (video|post)|today i('m| am)? (want|going) to|welcome back|in today's)/i
const CTA_RE = /\b(comment|dm|message me|save|share|follow|book|link in|subscribe|reply|click|download|register|join|tell me|let me know|i-dm|i-save|send me|apply)\b/i
const STORY_RE = /\b(years? ago|last (week|month|year)|yesterday|i remember|when i|the day|that night|we lost|i lost|i burned|i fired|i hired|kanina|nung)\b/i
const TAGALOG_RE = /\b(ang|ng|mga|hindi|kasi|pero|natin|namin|mo|ko|lang|talaga|naman|yung|'yung|ito|'to|kaya|sa'yo|ikaw|tayo)\b/i
const LIST_RE = /(^|\n)\s*(\d+[.)/]|[-•*])\s+|\b(first|second|third|step \d|step one)\b/i
const HOW_RE = /\b(how to|here's how|framework|template|checklist|steps?|process|system)\b/i
const EXAMPLE_RE = /\b(for example|e\.g\.|for instance|like when|case study|client|result(ed)?|went from)\b/i

const IDEAL_WORDS: Partial<Record<ScriptFormat, [number, number]>> = {
  short_video: [60, 230],
  long_video: [400, 3000],
  facebook_post: [80, 350],
  linkedin_post: [80, 300],
  carousel: [50, 220],
  x_thread: [80, 400],
  threads_post: [15, 120],
  instagram_caption: [40, 220],
  newsletter: [200, 800],
  blog: [500, 3000],
  story_sequence: [20, 120],
}

export interface ContentScoreParts {
  hook: number
  relevance: number
  value: number
  clarity: number
  authenticity: number
  cta: number
  strengths: string[]
  improvements: string[]
}

function hits(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const t of a) if (b.has(t)) n++
  return n
}

export function scoreContentOffline(
  kit: Kit,
  input: { text: string; format: ScriptFormat; platform: PlatformId; hook?: string | null }
): ContentScoreParts {
  const ctx = kit.ctx
  const text = input.text.trim()
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const hook = clean(input.hook?.trim() || lines[0] || splitSentences(text)[0] || "")
  const hookWordCount = hook.split(/\s+/).filter(Boolean).length
  const allWords = text.split(/\s+/).filter(Boolean)
  const wordCount = allWords.length
  const sentences = splitSentences(text)
  const longSentences = sentences.filter((s) => s.split(/\s+/).length > 25)
  const avgSentence = sentences.length ? wordCount / sentences.length : wordCount
  const lower = text.toLowerCase()
  const tokens = tokenSet(text)
  const youCount = (lower.match(/\byou(r|'re|'ll)?\b|\bmo\b|\bka\b/g) ?? []).length
  const firstPerson = (lower.match(/\b(i|i'm|i've|my|we|our|ako|namin|ko)\b/g) ?? []).length
  const numbers = /[0-9₱%]/.test(text)
  const hasCta = CTA_RE.test(lines.slice(-3).join(" ")) || CTA_RE.test(text)
  const banned = ctx.brand.phrases_avoid.filter((p) => p.trim() && lower.includes(p.toLowerCase()))
  const cliches = CLICHES.filter((c) => lower.includes(c))
  const brandPhrase = ctx.brand.phrases_used.find((p) => lower.includes(p.toLowerCase()))
  const personaText = ctx.personas.flatMap((p) => [...p.problems, ...p.questions, ...p.language_used, ...p.frustrations]).join(" ")
  const problemHit = ctx.problems.map((p) => ({ p, h: hits(tokens, tokenSet(p.problem)) })).sort((a, b) => b.h - a.h)[0]
  const pillar = kit.pillarFor(text, { fallback: false })
  const audienceHits = hits(tokens, tokenSet(personaText))
  const strengths: string[] = []
  const improvements: string[] = []

  // Hook /20
  let hookScore = 10
  if (hookWordCount >= 4 && hookWordCount <= 14) hookScore += 4
  else if (hookWordCount > 22) hookScore -= 3
  else if (hookWordCount < 3) hookScore -= 2
  if (/[0-9₱%]/.test(hook)) hookScore += 2
  if (/\byou(r)?\b|\bmo\b/i.test(hook)) hookScore += 1
  if (/\b(stop|mistake|wrong|why|how|nobody|most|instead|isn't|not|never|unpopular|truth|hindi)\b/i.test(hook)) hookScore += 2
  if (FILLER_OPENERS.test(hook)) hookScore -= 5
  if (/[?!]$/.test(hook) || /:$/.test(hook)) hookScore += 1
  hookScore = clamp(hookScore, 0, 20)

  // Relevance /20
  let relevance = 6 + Math.min(8, audienceHits * 1.5) + (problemHit && problemHit.h >= 2 ? 3 : 0) + (pillar ? 2 : 0) + (youCount >= 2 ? 1 : 0)
  relevance = clamp(relevance, 0, 20)

  // Value /20
  let value = 7
  if (LIST_RE.test(text)) value += 4
  if (HOW_RE.test(lower)) value += 3
  if (numbers) value += 2
  if (EXAMPLE_RE.test(lower) || STORY_RE.test(lower)) value += 2
  const ideal = IDEAL_WORDS[input.format]
  if (ideal) {
    if (wordCount >= ideal[0] && wordCount <= ideal[1] * 1.2) value += 2
    else if (wordCount < ideal[0] * 0.5) value -= 4
  }
  value = clamp(value, 0, 20)

  // Clarity /20
  let clarity = 14
  if (avgSentence <= 18) clarity += 3
  else if (avgSentence > 25) clarity -= 4
  if (longSentences.length >= 3) clarity -= 2
  if (lines.some((l) => l.split(/\s+/).length > 80)) clarity -= 3
  if (lines.length >= 3) clarity += 1
  clarity = clamp(clarity, 0, 20)

  // Authenticity /20
  let authenticity = 8
  if (firstPerson >= 2) authenticity += 4
  if (STORY_RE.test(lower)) authenticity += 3
  if (numbers) authenticity += 1
  if (brandPhrase) authenticity += 2
  authenticity -= banned.length * 4 + cliches.length * 2
  const taglishBrand = ctx.brand.language !== "english"
  const hasTagalog = TAGALOG_RE.test(lower)
  if (taglishBrand && hasTagalog) authenticity += 2
  authenticity = clamp(authenticity, 0, 20)

  // CTA /10
  let ctaScore = hasCta ? 6 : 2
  if (hasCta && /["“][A-Z0-9]{3,}["”]|\bdm\b|\bbook\b|\bcomment\b/i.test(text)) ctaScore += 2
  if (/\?\s*$/.test(lines[lines.length - 1] ?? "")) ctaScore += 1
  // Four or more asks compete with each other.
  if ((lower.match(new RegExp(CTA_RE.source, "gi")) ?? []).length >= 4) ctaScore -= 2
  ctaScore = clamp(ctaScore, 0, 10)

  // Strengths — specific to what was found.
  if (hookScore >= 15) strengths.push(`The hook (“${truncateWords(hook, 12)}”) is ${hookWordCount} words and ${/[0-9₱%]/.test(hook) ? "leads with a number" : "creates tension"} — it gives people a reason to keep going.`)
  if (firstPerson >= 2 && STORY_RE.test(lower)) strengths.push("First person with a real moment — it sounds like you, not a brand account.")
  if (LIST_RE.test(text) && HOW_RE.test(lower)) strengths.push("Clear, saveable structure (steps/list) — easy to act on.")
  if (numbers && !/[0-9₱%]/.test(hook)) strengths.push("Uses concrete numbers, which your Brand HQ asks for.")
  if (hasCta && ctaScore >= 8) strengths.push("Ends with one specific next step.")
  if (problemHit && problemHit.h >= 2) strengths.push(`Speaks directly to a Problem Bank entry: “${truncateWords(problemHit.p.problem, 12)}”.`)
  if (brandPhrase) strengths.push(`Uses your signature phrase “${brandPhrase}”.`)
  if (!strengths.length) strengths.push(clarity >= 15 ? "Easy to read — short sentences and one main message." : "The topic fits your pillars — the structure just needs tightening.")

  // Improvements — concrete edits, most valuable first.
  const topic = analyzeTopic(text)
  if (hookScore < 14) {
    const suggestion = writeHook(
      kit.hookCategories()[0] ?? "contrarian",
      hookSlots(topic, kit, { story: kit.storyFor(text, { minHits: 2 }), subject: kit.subjectFor(text), problem: kit.problemFor(text)?.problem ?? null }),
      kit
    ).text
    improvements.push(
      FILLER_OPENERS.test(hook)
        ? `Cut the warm-up and open on the tension. Try: “${suggestion}”`
        : `Tighten the first line to under 12 words with the stakes up front. Try: “${suggestion}”`
    )
  }
  if (banned.length) improvements.push(`Remove ${banned.map((b) => `“${b}”`).join(", ")} — ${banned.length === 1 ? "it's" : "they're"} on your never-say list.`)
  if (cliches.length) improvements.push(`Cut ${cliches.map((c) => `“${c}”`).join(", ")} — it reads as generic, not like you.`)
  if (!hasCta) improvements.push(`End with one clear action. Try: “${kit.cta({ funnel: kit.funnelFor(text, pillar), platform: input.platform, topic: topic.subject })}”`)
  if (!numbers && /number|₱|%/i.test(ctx.brand.always_do)) improvements.push("Add one real number (₱, %, days or a before/after) — your Brand HQ says to use real numbers whenever possible.")
  else if (!numbers) improvements.push("Add one specific number or result so the claim is believable.")
  if (relevance < 12) {
    const problem = kit.problemFor(text) ?? ctx.problems[0]
    improvements.push(
      problem
        ? `Name your audience's problem in their words — e.g. “${truncateWords(problem.problem, 14)}” from your Problem Bank.`
        : `Say who this is for in the first two lines (e.g. “If you're one of the ${kit.audience} who…”).`
    )
  }
  if (firstPerson < 2 || !STORY_RE.test(lower)) {
    const story = kit.storyFor(text, { minHits: 1 })
    improvements.push(story ? `Add one real moment — “${stripEndPunct(story.title)}” from your Story Vault fits this topic.` : "Add one real moment from your own experience (when, where, what was at stake).")
  }
  if (!LIST_RE.test(text) && value < 15) improvements.push("Turn the middle into 3 numbered steps the viewer can screenshot or save.")
  if (longSentences.length) improvements.push(`Split the ${longSentences.length} sentence${longSentences.length === 1 ? "" : "s"} over 25 words — one idea per line reads faster${input.platform === "tiktok" || input.format === "short_video" ? " on screen" : ""}.`)
  if (ideal && wordCount < ideal[0] * 0.5) improvements.push(`It's short for a ${SCRIPT_FORMATS[input.format]?.label ?? input.format} (${wordCount} words) — add the example or the “why” before the CTA.`)
  if (ideal && wordCount > ideal[1] * 1.3) improvements.push(`It's long for ${PLATFORMS[input.platform]?.label ?? input.platform} (${wordCount} words) — cut to the one point that matters most.`)
  if (taglishBrand && !hasTagalog) improvements.push("Your Brand HQ voice is Taglish — switch one or two lines (the hook or the takeaway) to Taglish so it sounds like you.")
  // A strong draft still gets two concrete polish edits — an empty list reads like the check didn't run.
  if (improvements.length < 2) {
    const polish = [
      numbers && !/[0-9₱%]/.test(hook) ? "Move your strongest number into the first line — it's the fastest way to earn the second line." : "",
      hookWordCount > 8 ? "Test a shorter version of the hook (under 8 words) against this one and keep whichever holds attention longer." : "",
      hasCta && !/["“][A-Z0-9]{3,}["”]/.test(text) ? `Make the CTA measurable: ask for one keyword in the comments (e.g. “${kit.commentKeyword(text)}”).` : "",
      "Read it aloud and cut the one line you'd skip if someone else had posted it.",
    ].filter(Boolean)
    for (const p of polish) if (improvements.length < 2 && !improvements.includes(p)) improvements.push(p)
  }

  return {
    hook: hookScore,
    relevance,
    value,
    clarity,
    authenticity,
    cta: ctaScore,
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 5),
  }
}

/* ------------------------------- Idea Score -------------------------------- */

export interface IdeaScoreInput {
  title: string
  description?: string
  core_topic?: string
  hook?: string
  angle?: string
  talking_points?: string[]
  pillar_id?: string | null
  persona_id?: string | null
  problem_id?: string | null
  format?: string
  platforms?: PlatformId[]
  funnel_stage?: FunnelStage | null
}

const TIMELY_RE = /\b(9\.9|10\.10|11\.11|12\.12|christmas|holiday|payday|sale|ber months|new year|ai|chatgpt|claude|algorithm|update|trend|this week|right now|2026|2027|budget season|q4)\b/i

export function scoreIdeaOffline(ctx: BrandContext, kit: Kit, idea: IdeaScoreInput): { scores: IdeaScores; rationale: Record<keyof IdeaScores, string>; summary: string } {
  const text = [idea.title, idea.description, idea.core_topic, idea.hook, idea.angle, ...(idea.talking_points ?? [])].filter(Boolean).join(". ")
  const tokens = tokenSet(text)
  const lower = text.toLowerCase()
  const problem = ctx.problems.find((p) => p.id === idea.problem_id) ?? kit.problemFor(text)
  const question = ctx.questions.map((q) => ({ q, h: hits(tokens, tokenSet(q.question)) })).sort((a, b) => b.h - a.h || b.q.frequency - a.q.frequency)[0]
  const persona = ctx.personas.find((p) => p.id === idea.persona_id) ?? kit.personaFor(text)
  const pillar = ctx.pillars.find((p) => p.id === idea.pillar_id) ?? kit.pillarFor(text, { fallback: false })
  const pillarKey = kit.pillarKey(pillar)
  const expertiseHits = hits(tokens, tokenSet(`${ctx.brand.expertise_areas.join(" ")} ${ctx.brand.known_for}`))
  const story = kit.storyFor(text, { minHits: 2 })
  const recentSim = Math.max(0, ...ctx.recent_titles.map((t) => jaccard(tokenSet(idea.title), tokenSet(t))))
  const format = ctx.formats.find((f) => f.name.toLowerCase() === (idea.format ?? "").toLowerCase())
  const funnel = idea.funnel_stage ?? kit.funnelFor(text, pillar)
  const primary = ctx.goals.find((g) => g.is_primary)
  const goalFit = primary ? kit.goalFor(funnel, pillar) === primary.category : false
  const topic = analyzeTopic(text)

  const questionFit = question && question.h >= 2 ? question.q : null
  const audience = clamp(4 + (problem ? 2 + Math.min(1, problem.severity / 5) : 0) + (questionFit ? Math.min(2, questionFit.frequency / 4) + 0.5 : 0) + (persona ? 1 : 0), 1, 10)
  const authority = clamp(4 + (pillarKey === "authority" || pillarKey === "education" ? 2 : 0) + Math.min(2, expertiseHits * 0.7) + (topic.signals.firstPerson || story ? 1 : 0) + (topic.signals.numbers ? 1 : 0), 1, 10)
  const business = clamp(4 + (funnel === "bofu" ? 3 : funnel === "mofu" ? 2 : 0) + (pillarKey === "business" ? 1 : 0) + (goalFit ? 2 : 0), 1, 10)
  const timely = clamp(5 + ((lower.match(new RegExp(TIMELY_RE.source, "gi")) ?? []).length ? 2 : 0) + (TIMELY_RE.test(idea.title) ? 1 : 0), 1, 10)
  const originality = clamp(4 + (story ? 2 : 0) + (topic.signals.opinion ? 2 : 0) + (topic.signals.firstPerson ? 1 : 0) + (recentSim < 0.25 ? 1 : recentSim >= 0.6 ? -3 : 0), 1, 10)
  const repurposing = clamp(4 + (topic.signals.list || topic.signals.howTo || /framework|checklist|steps?|system/i.test(text) ? 3 : 0) + (story ? 1 : 0) + ((idea.platforms?.length ?? 0) > 1 ? 1 : 0) + ((idea.talking_points?.length ?? 0) >= 3 ? 1 : 0), 1, 10)
  const baseEase: Record<string, number> = { text: 8, visual: 6, video: 6, live: 7, audio: 5, long_form: 4 }
  const ease = clamp((format ? (format.script_format === "long_video" ? 4 : (baseEase[format.category] ?? 6)) : 6) + ((idea.talking_points?.length ?? 0) >= 3 ? 1 : 0) + (story ? 1 : 0), 1, 10)

  const scores: IdeaScores = {
    audience_relevance: audience,
    authority_potential: authority,
    business_alignment: business,
    timeliness: timely,
    originality,
    repurposing_potential: repurposing,
    ease_of_production: ease,
  }
  const rationale: Record<keyof IdeaScores, string> = {
    audience_relevance: problem
      ? `Solves a Problem Bank entry (severity ${problem.severity}/5): “${truncateWords(problem.problem, 12)}”${questionFit ? `, and matches a question asked ${questionFit.frequency}×` : ""}.`
      : questionFit
        ? `Matches a question asked ${questionFit.frequency}× in your Question Bank.`
        : `No direct Problem Bank or Question Bank match — link it to a real ${persona?.name ?? "persona"} problem to raise this.`,
    authority_potential: `${pillar ? `${pillar.name} pillar` : "No pillar yet"}${expertiseHits ? `; overlaps your expertise (${ctx.brand.expertise_areas.slice(0, 2).join(", ")})` : ""}${story ? "; can be backed by a Story Vault experience" : ""}.`,
    business_alignment: `${funnel.toUpperCase()} content${primary ? `; ${goalFit ? "directly supports" : "is one step removed from"} your primary goal “${primary.name}”` : ""}.`,
    timeliness: TIMELY_RE.test(text) ? "Tied to something current (season, sale event, platform or AI shift)." : "Evergreen — useful any week, not tied to a moment.",
    originality: `${story ? `Your own experience (“${stripEndPunct(story.title)}”) makes it hard to copy` : "No personal story attached yet"}${recentSim >= 0.6 ? "; very close to something you published recently" : recentSim < 0.25 ? "; nothing similar published recently" : ""}.`,
    repurposing_potential:
      repurposing >= 7 ? "Has a structure (steps, list or story) that splits cleanly into posts, carousels and threads." : "Single-point idea — add steps or a story to get more assets out of it.",
    ease_of_production: format ? `${format.name}: ${ease >= 7 ? "quick to produce" : ease >= 5 ? "moderate effort" : "heavier production"}.` : "No format chosen yet — pick one to estimate effort.",
  }
  const total = computeIdeaScore(scores)
  const ordered = IDEA_SCORE_DIMENSIONS.map((d) => ({ d, v: scores[d.key] })).sort((a, b) => b.v - a.v)
  // Ties go to the dimension the creator can most easily change — never one its own rationale already praises.
  const low = ordered[ordered.length - 1].v
  const TIP_ORDER: (keyof IdeaScores)[] = ["audience_relevance", "business_alignment", "originality", "authority_potential", "repurposing_potential", "ease_of_production", "timeliness"]
  const weakest = ordered.filter((o) => o.v === low).sort((a, b) => TIP_ORDER.indexOf(a.d.key) - TIP_ORDER.indexOf(b.d.key))[0]
  const tips: Record<keyof IdeaScores, string> = {
    audience_relevance: "tie it to a specific Problem Bank entry or a question your audience keeps asking",
    authority_potential: "back it with a Story Vault experience or a number only you have",
    business_alignment: "connect it to your primary goal with a matching CTA",
    timeliness: scores.timeliness >= 7 ? "publish it while the moment is still current — this week, not next month" : "hook it to something current — a sale event, a platform change or this month's news",
    originality: "add your own story or a contrarian angle",
    repurposing_potential: "give it steps or a framework so it splits into posts, carousels and threads",
    ease_of_production: "pick a format you can produce this week",
  }
  const summary = `Idea Score ${total}/100 (${priorityFromScore(total)} priority). Strongest on ${ordered[0].d.label.toLowerCase()} and ${ordered[1].d.label.toLowerCase()}. ${low >= 8 ? "No weak dimension — schedule it while it's fresh." : `To raise it, work on ${weakest.d.label.toLowerCase()}: ${tips[weakest.d.key]}.`}`
  return { scores, rationale, summary }
}
