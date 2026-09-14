/**
 * Brand kit — brand-aware choices for the offline engine: which pillar, persona, problem, question and
 * story fit a topic (IDF-weighted, so generic words like "client" or "month" don't drive a match);
 * a clean topic phrase from the brand's own vocabulary; which hook styles, platforms and formats work
 * for this brand; CTAs in the brand's style and language; and scrubbing of the words the brand never uses.
 */
import { HOOK_CATEGORY_IDS } from "@/lib/constants"
import type { FunnelStage, GoalCategory, HookCategory, PlatformId, ScriptFormat } from "@/lib/types"
import type { BrandContext, ContextFormat, ContextPersona, ContextPillar, ContextProblem, ContextStory } from "../context"
import { clean, createRng, isAcronym, isStopword, isVerbStem, looksTagalog, stem, tokenSet, words, type Rng } from "./text"
import { analyzeTopic, isWeakSubject, nounChunk, stripAudience, topicPhrase } from "./topic"

export type ContextQuestion = BrandContext["questions"][number]

const PILLAR_INTENT: Record<string, string> = {
  education:
    "how guide step steps tutorial learn teach tip tips framework checklist mistake fundamentals explain beginner basics setup numbers metric test testing budget formula",
  authority: "opinion unpopular contrarian myth truth industry prediction analysis breakdown case study results data proof instead wrong agency roas",
  journey: "building behind scenes diary week month journey failure win experiment decided realized story burned lost quit agency milestone",
  leadership: "team hire hiring fire manage manager lead leader leadership delegate delegation accountability culture meeting feedback kpi kpis sop sops people",
  personal: "life family routine faith burnout rest health belief value personal parents reflection habit sleep weekend",
  business: "offer service audit book call consultation partnership apply launch discount slots enroll",
}
/** Pillar names too loose to count as a match on their own ("business owners", "personal brand"). */
const LOOSE_NAME_TOKENS = new Set(["busines", "personal", "content", "marketing"])
/** Content-type words in pillar descriptions ("hiring posts", "case-study videos") say nothing about the topic. */
const CONTENT_TYPE_TOKENS = new Set(["post", "video", "episod", "seri", "carousel", "caption", "reel", "thread", "newsletter", "content", "piec", "offer"])
/** Words this app's users say about everything — they never carry a match on their own. */
const GENERIC_TOKENS = new Set(["content", "post", "video", "brand", "busines", "marketing", "social", "media", "platform", "audience", "customer", "people", "work", "good", "better", "best", "big", "new", "real"])

const PLATFORM_SCRIPTS: Record<PlatformId, ScriptFormat[]> = {
  tiktok: ["short_video"],
  instagram: ["carousel", "short_video", "instagram_caption"],
  youtube: ["long_video", "short_video"],
  facebook: ["facebook_post", "short_video"],
  linkedin: ["linkedin_post", "carousel"],
  x: ["x_thread"],
  threads: ["threads_post"],
}

const TRAIT_HOOKS: Record<string, HookCategory[]> = {
  "story-driven": ["story"],
  direct: ["contrarian", "warning"],
  educational: ["list", "mistake"],
  practical: ["list", "problem"],
  bold: ["contrarian", "warning"],
  strategic: ["authority", "question"],
  inspirational: ["story", "results"],
  humorous: ["curiosity"],
  authentic: ["story", "curiosity"],
  professional: ["authority", "results"],
}

const AUDIENCE_HINTS: [RegExp, string][] = [
  [/business owners?|entrepreneurs?|founders?|owners?|ceos?/i, "founder owner entrepreneur business brand"],
  [/marketers?|marketing|team leads?|managers?/i, "marketing manager lead team head"],
  [/sellers?|shop|freelancers?|beginners?|vas?\b/i, "seller online freelancer beginner shop"],
  [/creators?|influencers?/i, "creator content"],
]

/** Only explicit offer language makes a piece BOFU — "client" or "hiring" alone does not. */
const BOFU_WORDS = /\b(audits?|book (?:a |an )?(?:call|consult\w*|session|audit|slot)|dm me|consultations?|apply(?: now)?|slots?|enrol+(?:ment)?|enroll|discount|promo|work with (?:us|me)|hire us|our (?:service|program|offer)|free (?:audit|consultation|session|workshop|strategy call))\b/i
const MOFU_WORDS = /\b(how to|how i|how we|steps?|framework|case study|breakdown|tutorial|process|system|systems|template|checklist|guide|walkthrough|lessons?|kpis?|sops?|numbers?|formula|playbook|method|metrics?)\b/i

const REPLACEMENTS: Record<string, string> = {
  guru: "expert",
  gurus: "experts",
  hack: "fix",
  hacks: "fixes",
  "passive income": "steady income",
  "10x overnight": "grow fast",
  "secret formula": "system",
  "crush it": "do well",
  "hustle harder": "work smarter",
  "game-changer": "big shift",
  "game changer": "big shift",
}

/** How brand and platform names are written. */
const KNOWN_CASE: Record<string, string> = {
  tiktok: "TikTok",
  facebook: "Facebook",
  meta: "Meta",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  shopee: "Shopee",
  lazada: "Lazada",
  shopify: "Shopify",
  google: "Google",
  ai: "AI",
  roas: "ROAS",
  aov: "AOV",
  cpa: "CPA",
  cpm: "CPM",
  ctr: "CTR",
  kpi: "KPI",
  kpis: "KPIs",
  sop: "SOP",
  sops: "SOPs",
  ga4: "GA4",
  cod: "COD",
  ugc: "UGC",
  seo: "SEO",
  ceo: "CEO",
  sea: "SEA",
  ph: "PH",
}

/** Everyday topics any creator might talk about — used when the brand's own vocabulary has no match. */
const COMMON_TOPICS = [
  "ad budget",
  "ad spend",
  "creative testing",
  "content system",
  "content calendar",
  "posting schedule",
  "personal brand",
  "brand awareness",
  "lead generation",
  "email list",
  "sales calls",
  "customer retention",
  "product launch",
  "cash flow",
  "pricing",
  "hiring",
  "delegation",
  "feedback",
  "offer",
  "funnel",
  "retargeting",
  "time management",
  "client onboarding",
  "sale events",
  "checkout",
  "abandoned carts",
  "product pages",
  "conversion rate",
  "landing page",
  "shipping",
  "reviews",
  "reporting",
  "team meetings",
  "content ideas",
  "hooks",
  "captions",
  "engagement",
  "community",
  "CEO reporting",
  "agency or in-house",
]

/** Pillar examples that name a content type rather than a topic. */
const GENERIC_EXAMPLES = new Set(
  [
    "how-to",
    "tutorials",
    "frameworks",
    "mistakes",
    "tips",
    "tools",
    "case studies",
    "analysis",
    "predictions",
    "strategic breakdowns",
    "lessons from experience",
    "what i'm currently building",
    "behind the scenes",
    "lessons learned",
    "failures",
    "wins",
    "experiments",
    "personal stories",
    "reflections",
    "offers",
    "projects",
    "services",
    "companies",
    "opportunities",
    "cta content",
    "industry opinions",
    "leadership lessons",
    "life lessons",
  ].map((s) => s.toLowerCase())
)
const SERIES_LIKE = /\b(episodes?|reflections?|diary|series|announcements?|invitations?|posts?|offers?|breakdown)\b/i

export interface LexiconEntry {
  display: string
  tokens: Set<string>
}

export interface Kit {
  ctx: BrandContext
  rng: Rng
  name: string
  firstName: string
  /** Short plural audience, e.g. "e-commerce founders". */
  audience: string
  industry: string
  years: number | null
  lang: BrandContext["brand"]["language"]
  /** English copy for English brands, Taglish/Tagalog copy otherwise. */
  say(en: string, tl: string): string
  /** IDF weight of a stemmed token across the brand's workspace (rare words weigh more). */
  weight(token: string): number
  /** Weighted overlap of two token sets. */
  score(query: Set<string>, target: Set<string>): number
  pillarFor(text: string, options?: { exclude?: string[]; fallback?: boolean }): ContextPillar | null
  personaFor(text: string): ContextPersona | null
  problemFor(text: string, options?: { personaId?: string | null; pillarId?: string | null }): ContextProblem | null
  /** Problem Bank entries related to the text, best first. */
  problemsFor(text: string, limit?: number, options?: { personaId?: string | null; pillarId?: string | null; exclude?: Set<string> }): ContextProblem[]
  questionFor(text: string): ContextQuestion | null
  storyFor(text: string, options?: { pillarId?: string | null; exclude?: Set<string>; minHits?: number }): ContextStory | null
  /** A clean topic phrase for the text — the brand's own vocabulary first, then extraction, then `fallback`. */
  subjectFor(text: string, options?: { context?: string; fallback?: (string | null | undefined)[] }): string
  /** A compact noun phrase for "the ___ mistake" slots, or null when the subject doesn't fit one. */
  shortSubject(subject: string): string | null
  /** Write a topic phrase with the brand's capitalisation (ROAS, TikTok, SOPs). */
  display(phrase: string): string
  /** Brand vocabulary phrases that appear in the text, strongest first (for hashtags and keywords). */
  lexiconTerms(text: string, limit?: number): string[]
  hookCategories(): HookCategory[]
  hookRatio(category: HookCategory): { ratio: number | null; posts: number; label: string } | null
  platformsFor(options?: { pillarId?: string | null; personaId?: string | null; prefer?: PlatformId | null }): PlatformId[]
  formatFor(platform: PlatformId, hint?: "video" | "text" | "visual" | null): ContextFormat | null
  funnelFor(text: string, pillar?: ContextPillar | null): FunnelStage
  goalFor(funnel: FunnelStage, pillar?: ContextPillar | null): GoalCategory
  commentKeyword(text: string): string
  cta(options: { funnel: FunnelStage; platform: PlatformId; topic: string }): string
  /** A signature phrase that fits the text; with `chance` > 0, sometimes any phrase. */
  phrase(text: string, chance?: number): string | null
  /** Pick from `options` without repeating within this kit until every option was used. */
  rotate<T>(key: string, options: readonly T[]): T
  scrub(text: string): string
  scrubDeep<T>(value: T): T
  pillarKey(pillar: ContextPillar | null | undefined): string
}

function hits(query: Set<string>, target: Set<string>): number {
  let n = 0
  for (const t of query) if (target.has(t)) n++
  return n
}

function pluralize(word: string): string {
  if (/s$/i.test(word)) return word
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`
  return `${word}s`
}

function displayPhrase(phrase: string): string {
  return clean(phrase)
    .split(" ")
    .map((w) => {
      const bare = w.toLowerCase().replace(/[^a-z0-9.-]/g, "")
      const known = KNOWN_CASE[bare]
      if (known) return w.toLowerCase().replace(bare, known)
      return isAcronym(w.replace(/[^A-Za-z0-9₱]/g, "")) ? w : w.toLowerCase()
    })
    .join(" ")
}

/** "Creative testing frameworks" → "creative testing"; "Contrarian takes on ROAS, agencies and growth" → "ROAS, agencies and growth". */
export function exampleTopic(example: string): string {
  let s = clean(example)
    .replace(/["“”]/g, "")
    .replace(/\([^)]*\)/g, " ")
  s = s
    .replace(/^(?:\w+\s+)?takes on\s+/i, "")
    .replace(/^predictions on\s+/i, "")
    .replace(/^behind the scenes of\s+/i, "")
    .replace(/,?\s*debunked with data$/i, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\b(?:frameworks?|walkthroughs?|case studies|templates?|checklists?|breakdowns?|episodes?|reflections?|tips|tutorials?|announcements?|invitations?|lessons)\b/gi, " ")
  return clean(s).replace(/^[\s,;:—–-]+|[\s,;:—–-]+$/g, "").replace(/\s+(?:and|&)$/i, "")
}

/** "Scaling E-commerce Founder" → "e-commerce founders"; "small café owners in the Philippines" → "café owners". */
export function audienceFromPersona(name: string): string {
  const base = name.split(/\/|,|\s+(?:in|for|who|at|from|with|across)\s+/i)[0].trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (!parts.length) return ""
  const noun = pluralize(parts[parts.length - 1].toLowerCase())
  const qualifier = parts
    .slice(0, -1)
    .filter((w) => !/^(aspiring|scaling|new|busy|growing|small|the|a|an|my|our|most|all)$/i.test(w))
    .slice(-1)
    .map((w) => (isAcronym(w) ? w : w.toLowerCase()))
  return [...qualifier, noun].join(" ")
}

/**
 * The niche's topic without its audience: "Bookkeeping systems for Filipino online sellers" → "Bookkeeping systems";
 * "Taxes at bookkeeping para sa mga freelancers" → "Taxes at bookkeeping". Empty when no compact topic remains.
 */
export function nicheTopic(niche: string): string {
  const head = (clean(niche).split(/\s+(?:for|para sa|to help|—|–)\s+/i)[0] ?? "")
    .split(/,\s+|\s+na\s+|\s+made simple\b|\s+explained\b/i)[0]
    .replace(/[.!?;:]+$/, "")
    .trim()
  return head && head.split(" ").length <= 5 && !isWeakSubject(head) ? head : ""
}

function shortIndustry(industry: string, areas: string[]): string {
  const first = industry.split(/\s*(?:&|,|\/|\(|\band\b)\s*/i)[0]?.trim()
  if (first) return first.charAt(0).toLowerCase() + first.slice(1)
  return areas[0]?.toLowerCase() ?? "this industry"
}

const RESOURCE_WORDS = ["template", "checklist", "framework", "script", "tracker", "guide", "sop", "kpi", "calculator", "playbook"]
const KEYWORD_WORDS = [...RESOURCE_WORDS, "system", "scale", "offer", "budget", "plan", "audit", "margin", "roas", "pricing", "hiring", "forecast", "cart", "hooks", "feedback", "delegate", "retention", "bundle", "boost", "testing", "cash"]
const KEYWORD_STOP = new Set(["guy", "guys", "thing", "things", "way", "part", "real", "time", "people", "someone", "yesterday", "today", "month", "week", "year", "day", "days"])

export function createKit(ctx: BrandContext, seed: string): Kit {
  const rng = createRng(seed)
  const b = ctx.brand
  const cleanedName = b.name.replace(/["“”][^"“”]*["“”]\s*/g, "").trim()
  const nickname = /["“]([^"”]+)["”]/.exec(b.name)?.[1]
  const firstName = nickname ?? (cleanedName.split(/\s+/)[0] || "")
  const primary = ctx.personas.find((p) => p.is_primary) ?? ctx.personas[0]
  const audience =
    (primary ? audienceFromPersona(primary.name) : "") ||
    audienceFromPersona(b.positioning_audience.split(/\s+(?:in|who|across)\s+/i)[0].trim()) ||
    "people"
  const say = (en: string, tl: string) => (b.language === "english" ? en : tl)

  /* ------------------------------ IDF over the workspace ------------------------------ */
  const docs: Set<string>[] = [
    ...ctx.problems.map((p) => tokenSet(p.problem)),
    ...ctx.questions.map((q) => tokenSet(q.question)),
    ...ctx.stories.map((s) => tokenSet(`${s.title} ${s.lesson} ${s.keywords.join(" ")} ${s.situation} ${s.problem}`)),
    ...ctx.pillars.map((p) => tokenSet(`${p.name} ${p.description} ${p.examples.join(" ")}`)),
    ...ctx.winners.map((w) => tokenSet(`${w.title} ${w.hook}`)),
    ...ctx.personas.map((p) => tokenSet([...p.problems, ...p.goals, ...p.questions, ...p.frustrations, ...p.language_used].join(" "))),
    ...b.expertise_areas.map((a) => tokenSet(a)),
    ...b.interests.map((a) => tokenSet(a)),
    tokenSet(`${b.niche} ${b.known_for} ${b.point_of_view} ${b.problems_solved}`),
  ].filter((d) => d.size)
  const df = new Map<string, number>()
  for (const d of docs) for (const t of d) df.set(t, (df.get(t) ?? 0) + 1)
  const N = docs.length
  const weight = (t: string) => (GENERIC_TOKENS.has(t) ? 0.5 : Math.max(0.25, Math.log((N + 1) / ((df.get(t) ?? 0) + 0.5))))
  const score = (q: Set<string>, target: Set<string>) => {
    let s = 0
    for (const t of q) if (target.has(t)) s += weight(t)
    return s
  }

  /* ---------------------------------- Lexicon ---------------------------------- */
  const lexicon: LexiconEntry[] = []
  const addLex = (phrase: string | null | undefined) => {
    const p = clean(phrase ?? "")
      .replace(/[?.!]+$/, "")
      .replace(/^(?:no|not|lack of|zero)\s+/i, "")
    if (!p || p.split(" ").length > 5 || isWeakSubject(p) || looksTagalog(p) || GENERIC_EXAMPLES.has(p.toLowerCase())) return
    const tokens = tokenSet(p)
    if (!tokens.size || lexicon.some((e) => e.display.toLowerCase() === p.toLowerCase())) return
    lexicon.push({ display: displayPhrase(p), tokens })
  }
  b.expertise_areas.forEach(addLex)
  // Niche Discovery: the niche's topic and the creator's interests are the brand's own vocabulary too.
  addLex(nicheTopic(b.niche))
  b.interests.forEach(addLex)
  ctx.stories.forEach((s) => s.keywords.forEach(addLex))
  ctx.pillars.forEach((p) => p.examples.filter((ex) => !SERIES_LIKE.test(ex)).forEach((ex) => addLex(exampleTopic(ex))))
  ctx.questions.forEach((q) => addLex(topicPhrase(q.question)))
  ctx.problems.forEach((p) => {
    const chunk = nounChunk(p.problem, 3)
    // "cash tied (up in inventory…)" is half a clause — only real noun phrases become lexicon topics.
    if (chunk && !/(?:[^e]ed|ied|\sup|\sdown|\sout|\soff)$/i.test(chunk)) addLex(chunk)
  })
  ctx.personas.forEach((p) => p.language_used.forEach((l) => addLex(l.replace(/["“”]/g, ""))))
  COMMON_TOPICS.forEach(addLex)

  const topical = (set: Set<string>) => new Set([...set].filter((t) => !CONTENT_TYPE_TOKENS.has(t)))
  const pillarSets = ctx.pillars.map((p) => ({
    pillar: p,
    name: new Set([...tokenSet(p.name)].filter((t) => !LOOSE_NAME_TOKENS.has(t))),
    desc: topical(tokenSet(p.description)),
    examples: topical(tokenSet(p.examples.join(" "))),
    intent: tokenSet(PILLAR_INTENT[p.name.trim().toLowerCase()] ?? ""),
  }))

  const personaSets = ctx.personas.map((p) => ({
    persona: p,
    tokens: tokenSet(
      [p.name, p.profession, p.experience_level, ...p.problems, ...p.goals, ...p.questions, ...p.frustrations, ...p.language_used].join(" ")
    ),
    hints: tokenSet(AUDIENCE_HINTS.filter(([re]) => re.test(`${p.name} ${p.profession}`)).map(([, w]) => w).join(" ")),
  }))
  const problemSets = ctx.problems.map((p) => ({ problem: p, tokens: tokenSet(p.problem) }))
  // A story is matched on what it's about (title, keywords, lesson); its situation counts for less.
  const storySets = ctx.stories.map((s) => ({
    story: s,
    core: tokenSet(`${s.title} ${s.lesson} ${s.keywords.join(" ")}`),
    keywords: tokenSet(s.keywords.join(" ")),
    body: tokenSet(`${s.situation} ${s.problem}`),
  }))
  const rotation = new Map<string, Set<number>>()

  const sequence = (text: string) => words(text).map(stem)
  /** A multi-word phrase only counts when its words appear close together ("at first … client" is not "first client"). */
  const inWindow = (seq: string[], tokens: Set<string>) => {
    if (tokens.size === 1) return seq.includes([...tokens][0])
    const span = tokens.size + 2
    for (let i = 0; i < seq.length; i++) {
      if (!tokens.has(seq[i])) continue
      const window = new Set(seq.slice(i, i + span))
      if ([...tokens].every((t) => window.has(t))) return true
    }
    return false
  }
  const lexiconMatch = (text: string, minTokens = 1) => {
    const seq = sequence(text)
    let best: { entry: LexiconEntry; score: number } | null = null
    for (const entry of lexicon) {
      if (entry.tokens.size < minTokens || !inWindow(seq, entry.tokens)) continue
      const s = score(entry.tokens, entry.tokens) + 0.8 * (entry.tokens.size - 1)
      if (!best || s > best.score || (s === best.score && entry.display.length > best.entry.display.length)) best = { entry, score: s }
    }
    return best
  }

  const kit: Kit = {
    ctx,
    rng,
    name: cleanedName || b.brand_name || "",
    firstName,
    audience,
    industry: shortIndustry(b.industry, b.expertise_areas),
    years: b.years_experience,
    lang: b.language,
    say,
    weight,
    score,

    pillarFor(text, options = {}) {
      const q = tokenSet(stripAudience(text))
      const exclude = new Set(options.exclude ?? [])
      let best: { pillar: ContextPillar; score: number } | null = null
      for (const s of pillarSets) {
        if (exclude.has(s.pillar.id)) continue
        const gap = s.pillar.recent_share !== null ? Math.max(0, s.pillar.target_percentage - s.pillar.recent_share) / 100 : 0
        const value = 2 * score(q, s.name) + 0.8 * score(q, s.desc) + score(q, s.examples) + 1.5 * hits(q, s.intent) + gap
        if (!best || value > best.score) best = { pillar: s.pillar, score: value }
      }
      if (best && best.score >= 1.5) return best.pillar
      if (options.fallback === false) return null
      // Nothing matched: the pillar furthest under its target, else the first.
      const under = [...ctx.pillars]
        .filter((p) => !exclude.has(p.id))
        .sort((a, c) => c.target_percentage - (c.recent_share ?? c.target_percentage) - (a.target_percentage - (a.recent_share ?? a.target_percentage)))
      return under[0] ?? null
    },

    personaFor(text) {
      const q = tokenSet(text)
      const hinted = tokenSet(AUDIENCE_HINTS.filter(([re]) => re.test(text)).map(([, w]) => w).join(" "))
      let best: { persona: ContextPersona; score: number } | null = null
      for (const s of personaSets) {
        const value = score(q, s.tokens) + 2 * hits(hinted, s.hints) + (s.persona.is_primary ? 0.5 : 0)
        if (!best || value > best.score) best = { persona: s.persona, score: value }
      }
      return best?.persona ?? null
    },

    problemsFor(text, limit = 3, options = {}) {
      const q = tokenSet(stripAudience(text))
      return problemSets
        .filter((s) => !options.exclude?.has(s.problem.id))
        .map((s) => {
          const base = score(q, s.tokens)
          const shared = [...q].filter((t) => s.tokens.has(t) && !GENERIC_TOKENS.has(t))
          const bonus = (options.personaId && s.problem.persona_id === options.personaId ? 0.4 : 0) + (options.pillarId && s.problem.pillar_id === options.pillarId ? 0.4 : 0)
          return { problem: s.problem, base, shared, value: base + bonus + s.problem.severity / 10 }
        })
        // Two shared words, or one rare noun ("contribution") — a lone verb ("decide") is not a match.
        .filter((r) => r.base >= 2.6 && (r.shared.length >= 2 || r.shared.some((t) => weight(t) >= 3 && !isVerbStem(t))))
        .sort((a, c) => c.value - a.value)
        .slice(0, limit)
        .map((r) => r.problem)
    },

    problemFor(text, options = {}) {
      return kit.problemsFor(text, 1, options)[0] ?? null
    },

    questionFor(text) {
      const q = tokenSet(stripAudience(text))
      let best: { question: ContextQuestion; score: number } | null = null
      for (const question of ctx.questions) {
        const value = score(q, tokenSet(question.question))
        if (value >= 3 && (!best || value + question.frequency / 20 > best.score)) best = { question, score: value + question.frequency / 20 }
      }
      return best?.question ?? null
    },

    storyFor(text, options = {}) {
      const q = tokenSet(text)
      const min = (options.minHits ?? 1) >= 2 ? 3.6 : 2.4
      let best: { story: ContextStory; score: number } | null = null
      for (const s of storySets) {
        if (options.exclude?.has(s.story.id)) continue
        const core = score(q, s.core)
        const coreShared = [...q].filter((t) => s.core.has(t) && !GENERIC_TOKENS.has(t))
        // One shared word is only enough when it's one of the story's own keywords and a rare one.
        if (coreShared.length < 2 && !coreShared.some((t) => s.keywords.has(t) && weight(t) >= 3)) continue
        const body = [...q].filter((t) => s.body.has(t) && !s.core.has(t)).reduce((sum, t) => sum + weight(t), 0)
        const base = core + 0.4 * body
        if (base < min || core < min / 2) continue
        const value = base + (options.pillarId && s.story.pillar_id === options.pillarId ? 0.6 : 0) + (s.story.is_favorite ? 0.3 : 0) + (s.story.situation ? 0.4 : 0)
        if (!best || value > best.score) best = { story: s.story, score: value }
      }
      return best?.story ?? null
    },

    subjectFor(text, options = {}) {
      const topic = analyzeTopic(text)
      const extracted = isWeakSubject(topic.subject) ? null : topic.subject
      if (topic.contrast && extracted) return kit.display(extracted)
      const extractedTokens = extracted ? tokenSet(extracted) : new Set<string>()
      const sameTokens = (a: Set<string>, c: Set<string>) => a.size === c.size && [...a].every((t) => c.has(t))
      // The extraction is exactly a known topic of this brand ("SOPs") — keep it.
      if (extracted && extractedTokens.size && lexicon.some((e) => sameTokens(e.tokens, extractedTokens))) {
        return kit.display(extracted.split(" ").slice(0, 4).join(" "))
      }
      const best = lexiconMatch(text, 1)
      const strong = best && (best.entry.tokens.size >= 2 || best.score >= 2.5) ? best : null
      // A fuller brand phrase that contains the extraction ("TikTok ads" ⊇ "ads") wins.
      if (best && extracted && extractedTokens.size && [...extractedTokens].every((t) => best.entry.tokens.has(t))) return best.entry.display
      if (strong) {
        // "agency report" beats the lone brand word "agency" it contains.
        if (extracted && strong.entry.tokens.size === 1 && [...strong.entry.tokens].every((t) => extractedTokens.has(t)) && extracted.split(" ").length <= 4) {
          return kit.display(extracted)
        }
        return strong.entry.display
      }
      if (extracted) {
        const words3 = extracted.split(" ").slice(0, 4).join(" ")
        const context = options.context ? tokenSet(options.context) : null
        if (context && words3.split(" ").length === 1) {
          const refined = lexiconMatch(`${text} ${options.context}`, 2)
          if (refined && [...tokenSet(words3)].every((t) => refined.entry.tokens.has(t))) return refined.entry.display
        }
        return kit.display(words3)
      }
      const any = lexiconMatch(text, 1)
      if (any) return any.entry.display
      if (options.context) {
        const fromContext = lexiconMatch(options.context, 1)
        if (fromContext && fromContext.score >= 2.5) return fromContext.entry.display
      }
      for (const f of options.fallback ?? []) if (f && !isWeakSubject(f)) return kit.display(f)
      const area = b.expertise_areas[0]
      return area ? kit.display(area) : kit.industry || "this"
    },

    shortSubject(subject) {
      const s = clean(subject)
      // A list of topics ("ROAS, agencies and growth") has no compact form.
      if (/,/.test(s) || s.split(/\s+(?:and|&)\s+/).length > 2) return null
      const parts = s.split(" ")
      if (parts.length <= 3 && !/\b(of|for|to|with|in|on|about|before|after|and|or|vs)\b/i.test(s) && !/^[a-z]+ing\b/i.test(s)) return s
      const inner = lexiconMatch(s, 1)
      // A lexicon chunk that ends in a participle ("cash tied") is half a clause, never a topic.
      if (inner && inner.entry.display.split(" ").length <= 3 && !/(?:[^e]ed|ied)$/i.test(inner.entry.display)) return inner.entry.display
      const chunk = nounChunk(s, 2)
      // "cash tied (up in inventory)" — a chunk ending in a participle is half a clause; the object noun is the topic.
      if (chunk && /(?:[^e]ed|ied)$/i.test(chunk.split(" ").pop() ?? "")) {
        const tail = /\b(?:in|on|of|for|with|into|from)\s+([a-z]+(?:\s[a-z]+)?)$/i.exec(s)?.[1]
        return tail && !isWeakSubject(tail) ? kit.display(tail) : null
      }
      return chunk && !isWeakSubject(chunk) && !/\b(of|for|to|with|and|or)\b/i.test(chunk) ? kit.display(chunk) : null
    },

    display: displayPhrase,

    lexiconTerms(text, limit = 4) {
      const seq = sequence(text)
      return lexicon
        .filter((e) => inWindow(seq, e.tokens))
        .map((e) => ({ e, s: score(e.tokens, e.tokens) + 0.8 * (e.tokens.size - 1) }))
        .sort((a, c) => c.s - a.s)
        .slice(0, limit)
        .map((x) => x.e.display)
    },

    hookCategories() {
      const measured = ctx.hook_performance.filter((h) => h.posts >= 2 && h.ratio !== null).map((h) => h.category)
      const traits = b.personality.flatMap((t) => TRAIT_HOOKS[t.toLowerCase()] ?? [])
      const order = [...measured, ...traits, "story", "list", "contrarian", "mistake", "question", "curiosity", "problem", "authority", "warning", "results"] as HookCategory[]
      return [...new Set(order)].filter((c) => c !== "custom" && HOOK_CATEGORY_IDS.includes(c))
    },

    hookRatio(category) {
      const h = ctx.hook_performance.find((x) => x.category === category)
      return h ? { ratio: h.ratio, posts: h.posts, label: h.label } : null
    },

    platformsFor(options = {}) {
      const persona = options.personaId ? ctx.personas.find((p) => p.id === options.personaId) : undefined
      const maxViews = Math.max(1, ...ctx.platforms.map((p) => p.avg_views ?? 0))
      const scored = ctx.platforms.map((p) => ({
        id: p.platform,
        score:
          (p.avg_views ?? 0) / maxViews +
          (p.engagement_rate ?? 0) / 20 +
          (options.pillarId && p.preferred_pillar_ids.includes(options.pillarId) ? 0.6 : 0) +
          (persona?.platforms.includes(p.platform) ? 0.3 : 0) +
          (options.prefer === p.platform ? 10 : 0),
      }))
      const ids = scored.sort((a, c) => c.score - a.score).map((s) => s.id)
      if (options.prefer && !ids.includes(options.prefer)) ids.unshift(options.prefer)
      return ids.length ? ids : [options.prefer ?? "facebook"]
    },

    formatFor(platform, hint = null) {
      const strategy = ctx.platforms.find((p) => p.platform === platform)
      const preferred = (strategy?.preferred_format_ids ?? [])
        .map((id) => ctx.formats.find((f) => f.id === id))
        .filter((f): f is ContextFormat => Boolean(f))
      const fits = (f: ContextFormat) => !hint || f.category === hint || (hint === "text" && f.category === "long_form")
      return (
        preferred.find(fits) ??
        ctx.formats.find((f) => PLATFORM_SCRIPTS[platform].includes(f.script_format) && fits(f)) ??
        preferred[0] ??
        ctx.formats.find((f) => PLATFORM_SCRIPTS[platform].includes(f.script_format)) ??
        null
      )
    },

    funnelFor(text, pillar) {
      const key = kit.pillarKey(pillar)
      if (key === "business" || BOFU_WORDS.test(text)) return "bofu"
      if (MOFU_WORDS.test(text) || key === "education" || key === "leadership") return "mofu"
      return "tofu"
    },

    goalFor(funnel, pillar) {
      const has = (c: GoalCategory) => ctx.goals.some((g) => g.category === c)
      const key = kit.pillarKey(pillar)
      if (funnel === "bofu") return has("leads") || !has("business") ? "leads" : "business"
      if (key === "authority" || key === "education") return "authority"
      if (key === "journey" || key === "personal") return has("community") ? "community" : "awareness"
      if (funnel === "tofu") return "awareness"
      return ctx.goals.find((g) => g.is_primary)?.category ?? "authority"
    },

    commentKeyword(text) {
      const tokens = words(text)
      const hit = KEYWORD_WORDS.find((k) => tokens.some((t) => stem(t) === stem(k)))
      let word = hit
      if (!word) {
        const subjectWords = kit
          .subjectFor(text)
          .split(/\s+/)
          .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
          .filter((w) => w.length >= 3 && w.length <= 10 && !KEYWORD_STOP.has(w) && !isStopword(w) && !/ing$/.test(w))
        word = subjectWords[subjectWords.length - 1]
      }
      if (!word) return "GUIDE"
      const singular = word.endsWith("s") && RESOURCE_WORDS.includes(word.slice(0, -1)) ? word.slice(0, -1) : word
      return singular.toUpperCase()
    },

    cta({ funnel, platform, topic }) {
      const platformStyle = (ctx.platforms.find((p) => p.platform === platform)?.cta_style ?? "").toLowerCase()
      const brandStyle = b.cta_style.toLowerCase()
      const keyword = kit.commentKeyword(topic)
      const t = topic.toLowerCase()
      const resource = /checklist|steps?|signs|mistakes/.test(t) ? "checklist" : /script/.test(t) ? "script" : /tracker|numbers|budget|margin|roas/.test(t) ? "tracker" : "template"
      const offer = /book (?:a |an )?([^,.;]+)/i.exec(b.cta_style)?.[1]?.trim().replace(/^(a|an)\s+/i, "")
      const pickOne = (key: string, en: string[], tl: string[]) => kit.rotate(`cta:${key}`, b.language === "english" ? en : tl)
      const topicShort = kit.shortSubject(kit.subjectFor(topic)) ?? "this"

      if (funnel === "bofu") {
        if (offer) {
          const limited = /limited/i.test(b.cta_style)
          return pickOne(
            "offer",
            [`Book a ${offer} — DM me “${keyword}” and I'll send the details.`, `Want us to look at your numbers? DM me “${keyword}” to book a ${offer}${limited ? " (limited slots)" : ""}.`],
            [`Gusto mo i-check namin ang numbers mo? I-DM mo lang ako ng “${keyword}” para sa ${offer}${limited ? " — limited slots lang" : ""}.`, `Book a ${offer} — i-DM mo lang ako ng “${keyword}”.`]
          )
        }
        return pickOne("dm", [`DM me “${keyword}” if you want help setting this up.`, `If you want a second pair of eyes on this, DM me “${keyword}”.`], [`I-DM mo ako ng “${keyword}” kung gusto mo ng tulong dito.`, `Kung gusto mo ng second opinion, i-DM mo lang ako ng “${keyword}”.`])
      }
      const wantsKeyword = /keyword|comment .*resource|comment a/.test(`${platformStyle} ${brandStyle}`) || /template|resource/.test(brandStyle)
      if (funnel === "mofu" && wantsKeyword) {
        return pickOne(
          "keyword",
          [`Comment “${keyword}” and I'll send you the ${resource}.`, `Comment “${keyword}” — I'll DM you the ${resource} we use.`],
          [`Comment “${keyword}” at ise-send ko sa'yo 'yung ${resource}.`, `I-comment mo ang “${keyword}” — ipapadala ko sa'yo 'yung ${resource} na gamit namin.`]
        )
      }
      if (/subscribe/.test(platformStyle)) return say("Subscribe for the next breakdown — the free template is linked in the description.", "Mag-subscribe ka para sa next breakdown — nasa description 'yung free template.")
      if (/save/.test(platformStyle) || funnel === "mofu") {
        return pickOne("save", ["Save this so you can run it this week.", "Save this and send it to someone who needs it."], ["I-save mo 'to para ma-try mo this week.", "I-save mo 'to at i-send sa kakilala mong kailangan 'to."])
      }
      if (/part 2|follow/.test(platformStyle)) {
        return pickOne("follow", [`Follow for part 2${wantsKeyword ? `, or comment “${keyword}” for the ${resource}` : ""}.`], [`I-follow mo ako para sa part 2${wantsKeyword ? `, o i-comment ang “${keyword}” para sa ${resource}` : ""}.`])
      }
      return pickOne(
        "question",
        [`How are you handling ${topicShort} right now? Tell me in the comments.`, `What's your experience with ${topicShort}? I read every comment.`],
        [`Ikaw, paano mo hina-handle ang ${topicShort} ngayon? Share mo sa comments.`, `Anong experience mo sa ${topicShort}? Binabasa ko lahat ng comments.`]
      )
    },

    phrase(text, chance = 0) {
      if (!b.phrases_used.length) return null
      // Ordinals and time words ("first", "second", "30 days") never make a signature phrase relevant.
      const content = (value: string) => new Set(Array.from(tokenSet(value)).filter((t) => !/^(?:first|second|third|last|next|one|two|three|day|days|week|weeks|month|months|year|years|time|times|today)$/.test(t) && !/^\d/.test(t)))
      const q = content(text)
      const ranked = b.phrases_used
        .map((p) => {
          const t = content(p)
          let shared = 0
          for (const token of t) if (q.has(token)) shared++
          return { p, h: score(q, t), shared }
        })
        .sort((a, c) => c.h - a.h)
      // Two shared content words at least — "ads" alone doesn't make "Offer first, ads second" about this post.
      if (ranked[0].shared >= 2 && ranked[0].h >= 1.5) return ranked[0].p
      return chance > 0 && rng.chance(chance) ? kit.rotate("phrase", b.phrases_used) : null
    },

    rotate<T>(key: string, options: readonly T[]): T {
      if (options.length <= 1) return options[0] as T
      let used = rotation.get(key)
      if (!used || used.size >= options.length) used = new Set()
      const free = options.map((_, i) => i).filter((i) => !used.has(i))
      const i = rng.pick(free)
      used.add(i)
      rotation.set(key, used)
      return options[i] as T
    },

    scrub(text) {
      let out = text
      for (const phrase of b.phrases_avoid) {
        const p = phrase.trim()
        if (!p) continue
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]")
        const re = new RegExp(`\\b${escaped}\\b`, "gi")
        out = out.replace(re, (m) => {
          const replacement = REPLACEMENTS[p.toLowerCase()] ?? ""
          return m[0] === m[0].toUpperCase() && replacement ? replacement[0].toUpperCase() + replacement.slice(1) : replacement
        })
      }
      return out.replace(/ {2,}/g, " ").replace(/\s+([.,!?])/g, "$1")
    },

    scrubDeep<T>(value: T): T {
      const skip = /(^id$|_id$|_ids$|^platform$|^funnel_stage$|^hook_category$|^category$|^type$|^key$|^rating$|^date$|^tier$)/
      const walk = (v: unknown, key: string): unknown => {
        if (typeof v === "string") return skip.test(key) ? v : kit.scrub(v)
        if (Array.isArray(v)) return v.map((x) => walk(x, key))
        if (v && typeof v === "object") {
          return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, k)]))
        }
        return v
      }
      return walk(value, "") as T
    },

    pillarKey(pillar) {
      return pillar ? pillar.name.trim().toLowerCase() : ""
    },
  }
  return kit
}
