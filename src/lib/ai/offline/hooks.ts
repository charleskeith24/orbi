/**
 * Offline hook writer: topic-parameterised templates per hook style, in English and natural Taglish.
 * Templates only fire when their slots read well (a clean subject, a real Problem Bank entry, a Story
 * Vault moment) and never assert results the brand hasn't recorded — story and results hooks only use
 * Story Vault facts. Within one generation no template is reused until the style's others are used.
 */
import { HOOK_CATEGORIES } from "@/lib/constants"
import type { HookCategory } from "@/lib/types"
import type { ContextStory } from "../context"
import type { Kit } from "./brand"
import { clean, firstSentence, lowerFirst, stripEndPunct, upperFirst, type Rng } from "./text"
import { agreeVerb, clauseReads, isWeakSubject, problemClause, type TopicAnalysis } from "./topic"

export interface HookSlots {
  /** Clean topic phrase, used after "about" / "with" ("content systems", "hiring your first media buyer"). */
  subject: string
  /** Compact noun phrase for "the ___ mistake" slots, or null. */
  short: string | null
  audience: string
  /** The input's own claim when it's short enough to quote. */
  claim: string | null
  from: string | null
  to: string | null
  action: string | null
  /** "managing content based on inspiration" — only when the action has an object. */
  gerundAction: string | null
  years: number | null
  industry: string
  story: ContextStory | null
  /** An audience problem as a second-person clause ("you still approve every ad"). */
  problem: string | null
  /** A real audience question from the Question Bank. */
  question: string | null
  number: number
}

type Template = (s: HookSlots) => string | null

const words = (text: string | null | undefined) => clean(text ?? "").split(" ").filter(Boolean).length
/** First sentence of a Story Vault field, only when it's short enough to open a video. */
const moment = (text: string | null | undefined, max = 26) => {
  const first = firstSentence(text ?? "")
  return first && words(first) <= max ? first : null
}
const storyTitle = (story: ContextStory | null) => (story ? stripEndPunct(story.title.replace(/^["“]|["”]$/g, "")) : null)
/** A claim says something ("most founders scale too early"), a label ("beliefs about work") doesn't. */
const CLAIM_VERB = /\b(is|are|was|were|isn't|aren't|don't|doesn't|won't|can't|should|will|beats?|kills?|wins?|works?|matters?|needs?|makes?|costs?|drives?|scale|manage|report|rely|relies|spend|chase|ignore|blame|think|believe|want|care|cares)\b|\w+ed\b/i
const CLAIM_SUBJECT = /^(most|nobody|everyone|every|all|you|i|we|your|my|our|no one)\b/i
/** "I burned ₱380,000…", "We fired…" — a first-person moment is a story, not an opinion to argue with. */
const STORY_LINE = /^(?:i|we|my|our)\b(?!\s+(?:think|believe|still think|don't think|never)\b)/i
/** Labels ("beliefs", "lessons") can't be "your real problem" — only things people blame (ads, offers, budgets) can. */
const ABSTRACT_SHORT = /^(?:beliefs?|values?|lessons?|stories|story|mindset|life|work|success|family|faith|habits?|routines?|thoughts?|reflections?|journey|personal|lifestyle|community|culture|leadership|growth)$/i
const blameable = (short: string | null): short is string => Boolean(short) && !ABSTRACT_SHORT.test((short ?? "").trim())

const EN: Record<Exclude<HookCategory, "custom">, Template[]> = {
  curiosity: [
    (s) => `Nobody talks about this part of ${s.subject}.`,
    (s) => `What I wish someone had told me about ${s.subject} earlier.`,
    (s) => (s.claim ? `I keep seeing the same pattern: ${lowerFirst(s.claim)}.` : null),
    (s) => `The part of ${s.subject} nobody puts in the tutorial.`,
    (s) => (s.problem ? `If ${s.problem}, the fix probably isn't what you think.` : null),
    (s) => `There's one question I ask before touching ${s.subject}. Most people skip it.`,
  ],
  contrarian: [
    (s) => (s.from && s.to ? `${upperFirst(s.from)} isn't the problem. The lack of ${s.to} is.` : null),
    (s) => (s.from && s.to ? `Unpopular opinion: ${s.to} ${agreeVerb(s.to, "beat", "beats")} ${s.from}. Every time.` : null),
    (s) => `Most advice about ${s.subject} is backwards.`,
    (s) => (s.claim && /^most\b/i.test(s.claim) ? `${upperFirst(s.claim)}. And it's costing them more than they think.` : null),
    (s) => (s.claim && !/\?$/.test(s.claim) && !/^most\b/i.test(s.claim) ? `Unpopular opinion: ${lowerFirst(s.claim)}.` : null),
    (s) => (blameable(s.short) ? `Hot take: ${s.short} isn't your real problem.` : null),
  ],
  mistake: [
    (s) => (s.short ? `The most expensive ${s.short} mistake I see ${s.audience} make.` : `The most expensive mistake I see ${s.audience} make with ${s.subject}.`),
    (s) => (s.from && s.to ? `Relying on ${s.from} instead of ${s.to} is the mistake that keeps ${s.audience} stuck.` : null),
    (s) => (s.gerundAction ? `Still ${s.gerundAction}? That's the mistake.` : null),
    (s) => (s.short ? `${s.number} ${s.short} mistakes I see every single week.` : null),
    (s) => (s.problem ? `If ${s.problem}, this is the mistake behind it.` : null),
    (s) => (s.short ? `The ${s.short} mistake that looks like progress.` : null),
  ],
  authority: [
    (s) => (s.years ? `After ${s.years} years in ${s.industry}, here's what I know about ${s.subject}:` : null),
    (s) => `I've seen ${s.subject} make or break ${s.audience}. Here's the difference.`,
    (s) => (s.years && s.short ? `${s.years} years in, this is the ${s.short} lesson I'd teach first.` : null),
    (s) => `What ${s.audience} who get ${s.subject} right do differently.`,
    (s) => (s.years ? `${s.years} years in ${s.industry} taught me one thing about ${s.subject}.` : null),
  ],
  story: [
    (s) => (storyTitle(s.story) ? `${storyTitle(s.story)}. Here's what it taught me about ${s.subject}.` : null),
    (s) => (moment(s.story?.situation) ? `${moment(s.story?.situation)} Here's what happened next.` : null),
    (s) => (moment(s.story?.situation) ? `${moment(s.story?.situation)} Here's what that taught me about ${s.subject}.` : null),
    (s) => (moment(s.story?.problem, 22) ? `${moment(s.story?.problem, 22)} This is the part most people don't share.` : null),
  ],
  problem: [
    (s) => (s.problem ? `If ${s.problem}, this is for you.` : null),
    (s) => (s.short ? `If ${s.short} ${agreeVerb(s.short, "feel", "feels")} random, this is probably why.` : null),
    (s) => `Struggling with ${s.subject}? Start here.`,
    (s) => (s.question ? `I get asked this a lot: “${s.question}” Here's my honest answer.` : null),
  ],
  results: [
    (s) => (moment(s.story?.result, 22) ? `${moment(s.story?.result, 22)} Here's what we changed.` : null),
    (s) => (s.from && s.to ? `What changes when you move from ${s.from} to ${s.to}.` : null),
    (s) => `The difference between ${s.audience} who get ${s.subject} right and everyone else.`,
  ],
  list: [
    (s) => (s.gerundAction ? `${s.number} signs you're still ${s.gerundAction}.` : null),
    (s) => `${s.number} things I wish I knew about ${s.subject} sooner.`,
    (s) => `The ${s.number}-step system I'd use for ${s.subject} if I started today.`,
    (s) => `${s.number} questions to ask yourself about ${s.subject} this week.`,
    (s) => (s.short ? `${s.number} ${s.short} rules I'd never break.` : null),
  ],
  warning: [
    (s) => (s.gerundAction ? `Stop ${s.gerundAction}. Seriously.` : null),
    (s) => (s.action ? `Before you ${s.action} again, read this.` : null),
    (s) => (s.short ? `Stop treating ${s.short} like an afterthought.` : null),
    (s) => (s.problem ? `If ${s.problem}, stop and read this first.` : null),
  ],
  question: [
    (s) => (s.from && s.to ? `Why do some ${s.audience} rely on ${s.from} while others build ${s.to}?` : null),
    (s) => `Why ${agreeVerb(s.subject, "do", "does")} ${s.subject} work for some ${s.audience} and not for others?`,
    (s) => `What would change if you fixed ${s.subject} this month?`,
    (s) => (s.question && /\?$/.test(s.question) ? s.question : null),
  ],
}

/** "scale ads" → "mag-scale ng ads". */
function tagalogAction(action: string | null): string | null {
  if (!action) return null
  const [verb, ...rest] = action.split(" ")
  if (!verb || !/^[a-z]+$/i.test(verb)) return null
  return rest.length ? `mag-${verb} ng ${rest.join(" ")}` : `mag-${verb}`
}

const TL: Partial<Record<HookCategory, Template[]>> = {
  curiosity: [
    (s) => `Walang nagsasabi nito about ${s.subject}, pero dapat alam mo.`,
    (s) => `May isang bagay tungkol sa ${s.subject} na late ko na na-realize.`,
    (s) => (s.claim ? `Napapansin ko 'to lagi: ${lowerFirst(s.claim)}.` : null),
  ],
  contrarian: [
    (s) => (s.from && s.to ? `Hindi ${s.from} ang problema. Kulang ka sa ${s.to}.` : null),
    (s) => `Real talk: baliktad ang karamihan ng advice about ${s.subject}.`,
    (s) => (blameable(s.short) ? `Unpopular opinion: hindi ${s.short} ang totoong problema mo.` : null),
  ],
  mistake: [
    (s) => (s.short ? `Ito ang pinakamahal na ${s.short} mistake na nakikita ko every week.` : null),
    (s) => (s.gerundAction ? `Still ${s.gerundAction}? 'Yan mismo ang mistake.` : null),
    (s) => (s.problem ? `Kung ${s.problem}, may mali sa sistema — hindi sa'yo.` : null),
  ],
  authority: [
    (s) => (s.years ? `${s.years} years na ako sa ${s.industry}. Ito ang totoo about ${s.subject}:` : null),
    (s) => (s.years && s.short ? `After ${s.years} years, ito ang ${s.short} lesson na ituturo ko first.` : null),
  ],
  story: [
    (s) => (moment(s.story?.situation) ? `${moment(s.story?.situation)} Dito ko natutunan ang totoo about ${s.subject}.` : null),
    (s) => (storyTitle(s.story) ? `${storyTitle(s.story)}. Ito ang natutunan ko.` : null),
  ],
  problem: [
    (s) => (s.problem ? `Kung ${s.problem}, para sa'yo 'to.` : null),
    (s) => (s.short ? `Kung ${s.short} ang struggle mo, baka ito ang dahilan.` : null),
    (s) => (s.question ? `Madalas itanong sa'kin: “${s.question}” Ito ang sagot ko.` : null),
  ],
  results: [(s) => (moment(s.story?.result, 22) ? `${moment(s.story?.result, 22)} Ito ang binago namin.` : null)],
  list: [
    (s) => `${s.number} bagay na sana alam ko na about ${s.subject} noon pa.`,
    (s) => `${s.number} tanong na dapat mong sagutin bago ka gumalaw sa ${s.subject}.`,
  ],
  warning: [
    (s) => (s.gerundAction ? `Stop ${s.gerundAction}. Seryoso.` : null),
    (s) => (tagalogAction(s.action) ? `Bago ka ${tagalogAction(s.action)} ulit, pakinggan mo muna 'to.` : null),
  ],
  question: [
    (s) => `Bakit gumagana ang ${s.subject} sa iba, pero hindi sa'yo?`,
    (s) => (s.question && /\?$/.test(s.question) ? s.question : null),
  ],
}

export function hookSlots(
  topic: TopicAnalysis,
  kit: Kit,
  extra: { story?: ContextStory | null; problem?: string | null; audience?: string | null; subject?: string | null; question?: string | null } = {}
): HookSlots {
  const subject = extra.subject?.trim() || kit.subjectFor(topic.text)
  const problem = extra.problem ? stripEndPunct(/^you\b/i.test(extra.problem) ? extra.problem : problemClause(extra.problem)) : null
  const claimWords = words(topic.claim)
  // Both halves of a contrast must read as topics — "is 4 but i'm" is a fragment, not the other side of an argument.
  const contrast = topic.contrast && !isWeakSubject(topic.contrast.from) && !isWeakSubject(topic.contrast.to) ? topic.contrast : null
  // "manage content (based on inspiration instead of systems)": cut from its qualifier, the action flips the advice ("Stop managing content").
  const keepsPoint = !contrast || [topic.action, topic.gerundAction].some((a) => (a ?? "").toLowerCase().includes(contrast.from.toLowerCase()))
  return {
    subject,
    short: kit.shortSubject(subject),
    audience: extra.audience ?? topic.audience ?? kit.audience,
    claim: topic.claim && claimWords >= 4 && claimWords <= 18 && !STORY_LINE.test(topic.claim) && (CLAIM_VERB.test(topic.claim) || CLAIM_SUBJECT.test(topic.claim)) ? stripEndPunct(topic.claim) : null,
    from: contrast ? contrast.from : null,
    to: contrast ? contrast.to : null,
    action: keepsPoint && topic.action && words(topic.action) >= 2 ? topic.action : null,
    gerundAction: keepsPoint && topic.gerundAction && words(topic.gerundAction) >= 2 ? topic.gerundAction : null,
    years: kit.years,
    industry: kit.industry,
    story: extra.story ?? null,
    problem: problem && words(problem) <= 18 && clauseReads(problem) ? problem : null,
    question: extra.question ? clean(extra.question) : null,
    number: kit.rotate("hook-number", [3, 5, 7]),
  }
}

const usedTemplates = new WeakMap<Kit, Set<string>>()

function ok(text: string | null): text is string {
  return Boolean(text) && !/\b(undefined|null|NaN)\b/.test(text!) && text!.length <= 200
}

function options(category: HookCategory, slots: HookSlots, bank: Partial<Record<HookCategory, Template[]>>, prefix: string) {
  const list = (category === "custom" ? bank.curiosity : bank[category]) ?? []
  return list
    .map((t, i) => ({ id: `${prefix}:${category}:${i}`, text: t(slots) }))
    .filter((o): o is { id: string; text: string } => ok(o.text))
}

/** One hook in `category`; falls back through the brand's best styles when a style has no usable template. */
export function writeHook(category: HookCategory, slots: HookSlots, kit: Kit, rng: Rng = kit.rng, avoid: Set<string> = new Set()): { text: string; category: HookCategory } {
  const used = usedTemplates.get(kit) ?? new Set<string>()
  usedTemplates.set(kit, used)
  const order = [category, ...kit.hookCategories().filter((c) => c !== category)]
  for (const c of order) {
    const en = options(c, slots, EN, "en").filter((o) => !avoid.has(o.text.toLowerCase()))
    const tl = kit.lang === "english" ? [] : options(c, slots, TL, "tl").filter((o) => !avoid.has(o.text.toLowerCase()))
    if (!en.length && !tl.length) continue
    // Taglish brands: roughly half the hooks in Taglish when the style has a natural Taglish line.
    const useTl = tl.length > 0 && (!en.length || rng.chance(kit.lang === "tagalog" ? 0.75 : 0.45))
    const pool = useTl ? tl : en
    const fresh = pool.filter((o) => !used.has(o.id))
    const choice = rng.pick(fresh.length ? fresh : pool)
    if (!fresh.length) for (const o of pool) used.delete(o.id)
    used.add(choice.id)
    return { text: kit.scrub(upperFirst(choice.text)), category: c }
  }
  return { text: kit.scrub(`Here's what most people miss about ${slots.subject}.`), category: "curiosity" }
}

/** `count` distinct hooks, rotating through `categories` (best-performing first). */
export function writeHooks(slots: HookSlots, categories: HookCategory[], count: number, kit: Kit, rng: Rng = kit.rng): { text: string; category: HookCategory }[] {
  const out: { text: string; category: HookCategory }[] = []
  const seen = new Set<string>()
  const cats = categories.length ? categories : kit.hookCategories()
  for (let i = 0; out.length < count && i < count * 4; i++) {
    const category = cats[i % cats.length]
    const hook = writeHook(category, { ...slots, number: kit.rotate("hooks-number", [3, 5, 7]) }, kit, rng, seen)
    if (seen.has(hook.text.toLowerCase())) continue
    // Keep the requested style when the caller asked for specific ones.
    if (categories.length && hook.category !== category && out.filter((h) => h.category === hook.category).length >= Math.ceil(count / cats.length)) continue
    seen.add(hook.text.toLowerCase())
    out.push(hook)
  }
  return out
}

/** Why this style works, plus how it has performed for this brand. */
export function hookWhy(category: HookCategory, kit: Kit): string {
  const spec = HOOK_CATEGORIES[category]
  const base = `${spec?.description ?? "Custom pattern"}.`
  const perf = kit.hookRatio(category)
  if (!perf || perf.ratio === null) return `${base} You haven't measured this style yet — worth testing.`
  if (perf.ratio >= 1.1) return `${base} Your ${perf.label.toLowerCase()} hooks average ${perf.ratio.toFixed(1)}× your overall views across ${perf.posts} posts.`
  if (perf.ratio < 0.9) return `${base} So far your ${perf.label.toLowerCase()} hooks average ${perf.ratio.toFixed(1)}× your views — test it against a stronger style.`
  return `${base} Performs around your average (${perf.ratio.toFixed(1)}× across ${perf.posts} posts).`
}
