/**
 * Offline Niche Discovery: three genuinely different directions from what the creator typed —
 * expertise-led (galing), passion-led (hilig) and audience-led (kanino + their problems) — each with a
 * one-line niche, positioning, niche-specific pillars, sample posts, monetization, fit scores and one
 * honest risk, in English or Taglish. Grounded only in the input: the creator's own words lead, the
 * domain table adds what a strategist knows about the space, and thin input gets honest notes.
 */
import type { NicheAim, NicheDiscoveryInput, NicheDiscoveryOutput, NicheKind, NicheOption } from "../tasks/niche-discovery"
import { NICHE_DOMAINS, type Bi, type NicheDomain } from "./niche-domains"
import { clean, firstSentence, looksLikeVerb, stripEndPunct, tokenSet, upperFirst } from "./text"

type L = 0 | 1
type Post = NicheOption["sample_posts"][number]
type Pillar = NicheOption["pillars"][number]
type FitScore = NicheOption["fit"]["passion"]

/* ------------------------------ Words & casing ------------------------------ */

const CASE: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  chatgpt: "ChatGPT",
  gcash: "GCash",
  "pag-ibig": "Pag-IBIG",
  philhealth: "PhilHealth",
  "k-drama": "K-drama",
  "k-dramas": "K-dramas",
  kdrama: "K-drama",
  "k-pop": "K-pop",
  kpop: "K-pop",
  ai: "AI",
  seo: "SEO",
  ofw: "OFW",
  ofws: "OFWs",
  va: "VA",
  vas: "VAs",
  bpo: "BPO",
  hr: "HR",
  ui: "UI",
  ux: "UX",
  sop: "SOP",
  sops: "SOPs",
  mp2: "MP2",
  esl: "ESL",
  nclex: "NCLEX",
  ielts: "IELTS",
  msme: "MSME",
  msmes: "MSMEs",
  wfh: "WFH",
  diy: "DIY",
  b2b: "B2B",
  ootd: "OOTD",
  bir: "BIR",
  sss: "SSS",
}

const PROPER = new Set(
  "shopee lazada facebook instagram excel canva figma notion google filipino filipinos pinoy pinoys pinay philippines manila cebu davao korean japanese english tagalog canada australia dubai japan netflix zapier upwork".split(" ")
)

const bareWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9-]/g, "")

/** A topic as it reads mid-sentence: "Personal Finance" → "personal finance", "facebook ads" → "Facebook ads", "BIR" stays. */
export function displayTerm(term: string): string {
  return clean(term.replace(/\s*\([^)]*\)/g, " "))
    .replace(/[.!?;:,]+$/, "")
    .split(" ")
    .map((w) => {
      const bare = bareWord(w)
      if (CASE[bare]) return w.toLowerCase().replace(bare, CASE[bare])
      if (PROPER.has(bare)) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      if (/^[A-Z0-9₱]{2,}s?$/.test(w) || /^[A-Z][a-z]+[A-Z]/.test(w)) return w
      return w.toLowerCase()
    })
    .join(" ")
}

/** Cut at a word boundary, no ellipsis (names and titles must read as finished). */
const cut = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, "").replace(/[\s,;:&—–-]+$/, "") || s.slice(0, max))

function terms(values: readonly string[], max = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const t = displayTerm(cut(clean(raw), 48))
    if (t.replace(/[^\p{L}\p{N}]/gu, "").length < 2 || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
    if (out.length >= max) break
  }
  return out
}

/** Lower-case the first letter unless it starts an acronym or a proper word. */
function lowerStart(s: string): string {
  const first = s.split(/\s+/)[0] ?? ""
  const bare = bareWord(first)
  if (!first || /^[A-Z0-9]{2,}/.test(first) || /^[A-Z][a-z]+[A-Z]/.test(first) || PROPER.has(bare) || CASE[bare] || /^I\b/.test(s)) return s
  return s.charAt(0).toLowerCase() + s.slice(1)
}

const say = (l: L, en: string, tl: string) => (l === 0 ? en : tl)
const mga = (aud: string, l: L) => (l === 1 && !/^mga\s/i.test(aud) ? `mga ${aud}` : aud)
const noMga = (aud: string) => aud.replace(/^mga\s+/i, "")

/** "bookkeeping and BIR taxes" for a sentence, "Bookkeeping & BIR taxes" for a name; a term with its own "&" joins with a comma. */
function joinTopics(list: readonly string[], l: L, forName = false): string {
  const items = list.filter(Boolean).slice(0, 2)
  if (items.length < 2) return items[0] ?? ""
  if (items.some((t) => /&|\band\b|\bat\b/.test(t))) return `${items[0]}, ${items[1]}`
  return forName ? `${items[0]} & ${items[1]}` : `${items[0]} ${say(l, "and", "at")} ${items[1]}`
}

const GENERIC_TOKENS = new Set(["life", "tip", "basic", "system", "people", "real", "work", "skill", "guid", "stori"])

/** Two names cover the same ground when they share a meaningful word. */
function sameGround(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true
  const x = tokenSet(a)
  for (const t of tokenSet(b)) if (x.has(t) && !GENERIC_TOKENS.has(t)) return true
  return false
}

/** Whole-number shares of 100 proportional to `weights` (largest remainder, each at least `min`). */
export function toHundred(weights: readonly number[], min = 1): number[] {
  const n = weights.length
  if (!n) return []
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 1))
  const sum = clean.reduce((a, b) => a + b, 0)
  const raw = clean.map((w) => (w / sum) * 100)
  const out = raw.map((r) => Math.max(min, Math.floor(r)))
  let left = 100 - out.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; left > 0; k++) {
    out[order[k % n].i]++
    left--
  }
  while (left < 0) {
    const i = out.indexOf(Math.max(...out))
    out[i]--
    left++
  }
  return out
}

/* ---------------------------------- Domains --------------------------------- */

/** The domain whose match is most specific (longest): "real estate investing" is real estate, not finance. */
function domainOf(text: string): NicheDomain | null {
  const t = text.toLowerCase()
  if (!t.trim()) return null
  let best: { d: NicheDomain; len: number } | null = null
  for (const d of NICHE_DOMAINS) {
    const m = d.match.exec(t)
    if (m && (!best || m[0].length > best.len)) best = { d, len: m[0].length }
  }
  return best?.d ?? null
}

/** Domains ranked by how much of the given material points at them (earlier items weigh more). */
function rankDomains(groups: { list: readonly string[]; weight: number }[]): NicheDomain[] {
  const score = new Map<string, { d: NicheDomain; s: number; first: number }>()
  let order = 0
  for (const { list, weight } of groups) {
    list.forEach((term, i) => {
      const d = domainOf(term)
      if (!d) return
      const entry = score.get(d.id) ?? { d, s: 0, first: order++ }
      entry.s += weight * (i === 0 ? 1.5 : 1)
      score.set(d.id, entry)
    })
  }
  return [...score.values()].sort((a, b) => b.s - a.s || a.first - b.first).map((e) => e.d)
}

const termsIn = (list: readonly string[], d: NicheDomain) => list.filter((t) => domainOf(t)?.id === d.id)

/** Hobby-type domains: great personal flavour, but only a topic seed when the niche is about them. */
const LIFESTYLE = new Set(["entertainment", "gaming", "travel", "pets", "plants", "beauty", "food", "fitness"])

/**
 * The interests that belong to the niche's world, for idea seeds: "Personal finance" fits a tax niche for
 * freelancers, "K-drama" doesn't (unless the niche is about it). Without a niche every interest counts.
 */
export function nicheInterests(niche: string, interests: readonly string[], anchors: readonly string[] = []): string[] {
  if (!niche.trim()) return [...interests]
  const context = `${niche} ${anchors.join(" ")}`
  const domains = new Set(NICHE_DOMAINS.filter((d) => d.match.test(context.toLowerCase())).map((d) => d.id))
  const words = tokenSet(context)
  return interests.filter((interest) => {
    const d = domainOf(interest)
    if (d) return domains.has(d.id) || !LIFESTYLE.has(d.id)
    return [...tokenSet(interest)].some((t) => words.has(t) && !GENERIC_TOKENS.has(t))
  })
}

/** A domain made from the creator's own word when the table has nothing for it ("birdwatching"). */
function customDomain(term: string): NicheDomain {
  const t = term || "your topic"
  const short = cut(t, 22)
  const T = upperFirst(short)
  return {
    id: `custom:${t.toLowerCase()}`,
    match: /$^/,
    topic: [t, t],
    theme: [short, short],
    industry: upperFirst(t),
    audience: ["beginners", "beginners"],
    result: [`get good at ${t} without the guesswork`, `gumaling sa ${t} nang walang hula-hula`],
    method: [`practical, experience-based ${t} lessons`, `practical na ${t} lessons mula sa totoong experience`],
    pillars: [
      [[`${T} basics`, `${T} basics`], [`The fundamentals of ${t}, explained simply`, `Ang basics ng ${t}, explained nang simple`]],
      [[`${T} mistakes`, `${T} mistakes`], [`What people get wrong about ${t} — and the fix`, `Mga mali sa ${t} — at paano ayusin`]],
      [[`${T} deep dives`, `${T} deep dives`], [`Longer breakdowns for people who want to go further`, `Mas malalim na breakdowns para sa gustong lumalim pa`]],
      [[`${T} tools`, `${T} tools`], [`The tools and resources worth using`, `Mga tools at resources na sulit gamitin`]],
      [[`My ${short} journey`, `My ${short} journey`], [`What I'm learning, testing and building`, `Ano ang natututunan, tine-test at binubuo ko`]],
    ],
    monetization: [
      [`${T} coaching or services`, `${T} coaching o services`],
      [`${T} guides and templates`, `${T} guides at templates`],
      ["Workshops", "Workshops"],
      ["Brand partnerships", "Brand partnerships"],
    ],
    demand: [
      `People already look for ${t} help — the gap is someone who explains it for one specific audience.`,
      `May naghahanap na ng tulong sa ${t} — ang kulang, taong nag-e-explain nito para sa isang specific na audience.`,
    ],
    demandScore: 6,
  }
}

/* --------------------------------- Analysis --------------------------------- */

interface Analysis {
  l: L
  interests: string[]
  skills: string[]
  audiences: string[]
  problems: string[]
  aims: NicheAim[]
  years: number | null
  proof: string
  help: string
  story: string
  level: "beginner" | "intermediate" | "advanced" | ""
  goal: string
}

function levelOf(text: string): Analysis["level"] {
  const t = text.toLowerCase()
  if (/\b(beginners?|new|bago|bagong|nagsisimula|starting|first[- ]time|first year|fresh)\b/.test(t)) return "beginner"
  if (/\b(advanced|experienced|senior|established|expert)\b/.test(t)) return "advanced"
  if (/\b(intermediate|growing|mid-level)\b/.test(t)) return "intermediate"
  return ""
}

function analyze(input: NicheDiscoveryInput): Analysis {
  const skills = terms(input.skills)
  return {
    l: input.language === "english" ? 0 : 1,
    interests: terms(input.interests),
    skills: skills.length ? skills : terms([input.industry]),
    audiences: terms(input.audiences, 6),
    problems: input.audience_problems.map((p) => stripEndPunct(clean(p))).filter((p) => p.length > 3).slice(0, 10),
    aims: [...new Set(input.aims)],
    years: input.years_experience && input.years_experience > 0 ? input.years_experience : null,
    proof: stripEndPunct(clean(input.proof)),
    help: stripEndPunct(clean(input.help_requests)),
    story: clean(input.story),
    level: levelOf(`${input.audience_level} ${input.audience_stage}`),
    goal: stripEndPunct(clean(input.audience_goal)),
  }
}

const EN_VERBS = new Set(
  "get be become save earn land build grow pass stop learn find have make start reach feel turn keep raise buy sell cook travel lose gain close lead run file stay live afford retire move quit pay finish win look raise protect".split(" ")
)

/** A goal as a verb phrase for "I help [audience] ___": "Financial freedom" → "reach financial freedom". */
function asResult(goal: string, l: L): string {
  const g = lowerStart(goal.replace(/^to\s+/i, ""))
  if (!g) return ""
  const first = g.split(/\s+/)[0].toLowerCase()
  const verb = EN_VERBS.has(first) || looksLikeVerb(first) || (l === 1 && /^(ma|mag|maka|makapag|maging|mapa|um|i-|gumaling|kumita|matuto)/.test(first))
  return verb ? g : say(l, `reach ${g}`, `maabot ang ${g}`)
}

/** "freelancers" → "new freelancers" (from the audience's stage) or "Filipino freelancers". */
function qualify(aud: string, a: Analysis): string {
  const base = noMga(aud)
  if (/\b(new|bago|bagong|first-time|aspiring|beginners?|experienced|filipinos?|pinoys?|pinay)\b/i.test(base)) return base
  const young = /\b(young|fresh|students?|grads?|kids?)\b/i.test(base)
  const q =
    a.level === "beginner" && !young
      ? say(a.l, "new", "bagong")
      : a.level === "advanced"
        ? say(a.l, "experienced", "experienced na")
        : a.level === "intermediate" && !young
          ? say(a.l, "growing", "growing na")
          : say(a.l, "Filipino", "Pinoy")
  return `${q} ${base}`
}

/* ---------------------------------- Cores ---------------------------------- */

interface Core {
  kind: NicheKind
  /** The creator's own topic words for this direction. */
  terms: string[]
  domain: NicheDomain
  /** Audience-led directions mix in a second domain. */
  second: NicheDomain | null
  audience: string
  result: string
  method: string
  /** No material of this kind was given (e.g. no interests for the passion-led direction). */
  borrowed: boolean
  /** A hilig outside the main topic, used as personal flavour. */
  flavor: string | null
}

const DEFAULT_IDS: Record<NicheKind, string> = { expertise: "freelancing", passion: "finance", audience: "career" }
const defaultDomain = (kind: NicheKind) => NICHE_DOMAINS.find((d) => d.id === DEFAULT_IDS[kind]) ?? NICHE_DOMAINS[0]

function expertiseCore(a: Analysis): Core {
  const l = a.l
  const ranked = rankDomains([
    { list: a.skills, weight: 3 },
    { list: a.help ? [a.help] : [], weight: 2 },
  ])
  let domain = ranked[0] ?? null
  let chosen = domain ? termsIn(a.skills, domain).slice(0, 2) : []
  if (!chosen.length) chosen = a.skills.slice(0, 1)
  const borrowed = !a.skills.length
  if (!chosen.length) {
    // No skills: what people ask them for help with, then the first hilig, then a safe default.
    domain = domain ?? rankDomains([{ list: a.interests, weight: 1 }])[0] ?? (a.interests[0] ? null : defaultDomain("expertise"))
    chosen = domain ? [domain.topic[l]] : a.interests.slice(0, 1)
  }
  const d = domain ?? domainOf(chosen[0] ?? "") ?? customDomain(chosen[0] ?? "")
  const flavor = a.interests.find((i) => domainOf(i)?.id !== d.id && !chosen.some((c) => sameGround(c, i))) ?? null
  return {
    kind: "expertise",
    terms: chosen,
    domain: d,
    second: null,
    audience: a.audiences[0] ?? d.audience[l],
    result: d.result[l],
    method: d.method[l],
    borrowed,
    flavor,
  }
}

function passionCore(a: Analysis, avoid: Core): Core {
  const l = a.l
  const fresh = a.interests.filter((i) => !avoid.terms.some((t) => sameGround(t, i)))
  const pool = fresh.length ? fresh : a.interests
  const lead = [...pool].sort((x, y) => Number(domainOf(x)?.id === avoid.domain.id) - Number(domainOf(y)?.id === avoid.domain.id))[0]
  let chosen: string[] = []
  let domain: NicheDomain | null = null
  if (lead) {
    domain = domainOf(lead)
    const sameDomain = domain ? pool.filter((i) => i !== lead && domainOf(i)?.id === domain?.id) : []
    const next = sameDomain[0] ?? pool.find((i) => i !== lead && !sameGround(i, lead))
    chosen = [lead, ...(next ? [next] : [])]
  }
  const borrowed = !a.interests.length
  if (!chosen.length) {
    // No hilig given: the second skill, else the same topic told as a real-life journey.
    const other = a.skills.find((s) => !avoid.terms.includes(s))
    chosen = other ? [other] : avoid.terms.slice(0, 1)
    domain = other ? domainOf(other) : avoid.domain
    if (!chosen.length) {
      domain = defaultDomain("passion")
      chosen = [domain.topic[l]]
    }
  }
  const d = domain ?? customDomain(chosen[0])
  return {
    kind: "passion",
    terms: chosen,
    domain: d,
    second: null,
    audience: a.audiences[1] ?? a.audiences[0] ?? d.audience[l],
    result: d.result[l],
    method: d.method[l],
    borrowed,
    flavor: null,
  }
}

function audienceCore(a: Analysis, expertise: Core, passion: Core): Core {
  const l = a.l
  const ranked = rankDomains([
    { list: a.problems, weight: 2 },
    { list: a.goal ? [a.goal] : [], weight: 2 },
    // Only the audience this direction targets — a second audience belongs to the passion-led direction.
    { list: a.audiences.slice(0, 1), weight: 1 },
  ])
  const domain = ranked[0] ?? expertise.domain
  // Only a hilig that belongs to this audience's world joins the mix — "pastry and travel" helps nobody.
  const belongs = (d: NicheDomain | null) => Boolean(d && (d.id === domain.id || d.id === expertise.domain.id || ranked.some((r) => r.id === d.id)))
  const interest = a.interests.find((i) => !expertise.terms.some((t) => sameGround(t, i)) && belongs(domainOf(i))) ?? null
  const mix = [expertise.borrowed ? null : (expertise.terms[0] ?? null), interest].filter((t, i, all): t is string => Boolean(t) && all.findIndex((x) => x && t && sameGround(x, t)) === i)
  const candidates = [ranked.find((d) => d.id !== domain.id), expertise.domain, interest ? domainOf(interest) : null, passion.terms.length ? null : passion.domain]
  const second = candidates.find((d): d is NicheDomain => Boolean(d) && d?.id !== domain.id) ?? null
  const audience = qualify(a.audiences[0] ?? expertise.audience ?? domain.audience[l], a)
  return {
    kind: "audience",
    terms: mix.length ? mix : [domain.topic[l]],
    domain,
    second,
    audience,
    result: asResult(a.goal, l) || domain.result[l],
    method: mix.length >= 2 ? say(l, `simple systems that combine ${joinTopics(mix, 0)}`, `simple na systems na pinagsasama ang ${joinTopics(mix, 1)}`) : domain.method[l],
    borrowed: !a.audiences.length && !a.problems.length,
    flavor: null,
  }
}

/* ------------------------------- Statements -------------------------------- */

function nameOf(core: Core, l: L): string {
  const aud = core.audience
  if (core.kind === "audience") {
    const themes = [core.domain.theme[l], core.second?.theme[l]].filter((t, i, all): t is string => Boolean(t) && all.indexOf(t) === i)
    return cut(`${upperFirst(joinTopics(themes, l, true))} ${say(l, "for", "para sa")} ${mga(aud, l)}`, 64)
  }
  if (core.kind === "passion" && core.borrowed) return cut(`${upperFirst(core.terms[0])} in real life`, 64)
  const full = `${upperFirst(joinTopics(core.terms, l, true))} ${say(l, "for", "para sa")} ${mga(aud, l)}`
  return full.length <= 64 ? full : cut(`${upperFirst(core.terms[0])} ${say(l, "for", "para sa")} ${mga(aud, l)}`, 64)
}

function statementOf(core: Core, a: Analysis): string {
  const l = a.l
  const topic = joinTopics(core.terms, l)
  const aud = core.audience
  if (core.kind === "expertise") {
    const base = say(l, `${upperFirst(topic)} for ${aud}, made simple`, `${upperFirst(topic)} para sa ${mga(aud, l)}, pinasimple`)
    const tail = a.years
      ? say(l, ` — from ${a.years} years of doing the work`, ` — galing sa ${a.years} years na hands-on experience`)
      : say(l, " and practical", " at practical")
    return `${base}${tail}.`
  }
  if (core.kind === "passion") {
    if (core.borrowed) {
      return say(
        l,
        `Documenting ${topic} in real life for ${aud} — the wins, the fails and what actually works.`,
        `Dino-document ang ${topic} in real life para sa ${mga(aud, l)} — ang wins, fails at kung ano talaga ang gumagana.`
      )
    }
    return say(l, `${upperFirst(topic)} for ${aud} who want to ${core.result}.`, `${upperFirst(topic)} para sa ${mga(aud, l)} na gustong ${core.result}.`)
  }
  const long = say(l, `Helping ${aud} ${core.result} — with ${topic}.`, `Tinutulungan ang ${mga(aud, l)} na ${core.result} — gamit ang ${topic}.`)
  return core.terms.length >= 2 && long.length <= 150 ? long : say(l, `Helping ${aud} ${core.result}.`, `Tinutulungan ang ${mga(aud, l)} na ${core.result}.`)
}

/* --------------------------------- Pillars --------------------------------- */

const CONVERSION: Record<NicheAim, readonly [Bi, Bi]> = {
  clients: [["Work with me", "Work with me"], ["Offers, client results and how to start working together", "Offers, client results at paano magsimulang mag-work together"]],
  products: [["Tools & templates", "Tools & templates"], ["The templates and tools I make — and how to use them", "Mga templates at tools na gawa ko — at paano gamitin"]],
  career: [["Proof of work", "Proof of work"], ["Projects and results that show what I can do", "Projects at results na nagpapakita ng kaya kong gawin"]],
  speaking: [["Talks & big ideas", "Talks & big ideas"], ["The talks and ideas I want to be known for", "Mga talks at ideas na gusto kong makilala ako"]],
  community: [["Community Q&A", "Community Q&A"], ["Answering members' questions and featuring their wins", "Sinasagot ang tanong ng members at fina-feature ang wins nila"]],
  audience: [["Collabs & trends", "Collabs & trends"], ["Collaborations and timely takes that bring new people in", "Collabs at napapanahong takes na nagdadala ng bagong audience"]],
}

const WEIGHTS: Record<number, number[]> = { 4: [35, 30, 20, 15], 5: [30, 25, 20, 15, 10], 6: [25, 20, 20, 15, 10, 10] }

/** Last-resort pillars when the creator's material is too thin to fill four. */
const STRUCTURAL: readonly (readonly [Bi, Bi])[] = [
  [["Beginner questions", "Beginner questions"], ["Answering what newcomers ask most", "Sinasagot ang pinakamadalas itanong ng mga nagsisimula"]],
  [["Myths & mistakes", "Myths & mistakes"], ["What people get wrong — and what to do instead", "Ano ang mali sa akala ng marami — at ano ang dapat gawin"]],
  [["Behind the scenes", "Behind the scenes"], ["How the work really happens, unpolished", "Paano talaga ginagawa — walang filter"]],
  [["Tools & resources", "Tools & resources"], ["What's actually worth using", "Ano talaga ang sulit gamitin"]],
]

function pillarsOf(core: Core, a: Analysis): Pillar[] {
  const l = a.l
  const d = core.domain
  const aud = core.audience
  // Pillars from the creator's words must not overlap anything; a domain's own pillars only must not repeat.
  const list: [string, string, "user" | "domain"][] = []
  const taken = (name: string, source: "user" | "domain") =>
    list.some(([x, , from]) => x.toLowerCase() === name.toLowerCase() || ((source === "user" || from === "user") && sameGround(x, name)))
  const add = (name: string, description: string, source: "user" | "domain" = "user") => {
    const n = cut(name.trim(), 40)
    if (!n || taken(n, source)) return
    list.push([n, description, source])
  }
  const fromDomain = (i: number, dom: NicheDomain = d) => {
    const p = dom.pillars[i]
    if (p) add(p[0][l], p[1][l], "domain")
  }
  const interest = (term: string, lens?: string) =>
    add(
      upperFirst(term),
      lens
        ? say(l, `Your personal side: ${term}, tied back to ${lens}`, `Ang personal side mo: ${term}, konektado sa ${lens}`)
        : say(l, `Your take on ${term} — practical, personal and made for ${aud}`, `Ang take mo sa ${term} — practical, personal at para sa ${mga(aud, l)}`)
    )

  if (core.kind === "expertise") {
    fromDomain(0)
    fromDomain(1)
    fromDomain(3)
    if (core.flavor) interest(core.flavor, joinTopics(core.terms, l))
    fromDomain(4)
  } else if (core.kind === "passion") {
    // A custom topic's own pillars already carry the lead word ("Birdwatching basics") — don't add it bare too.
    if (!core.borrowed) core.terms.forEach((t, i) => (d.id.startsWith("custom:") && i === 0 ? undefined : interest(t)))
    fromDomain(0)
    fromDomain(2)
    fromDomain(4)
  } else {
    const p = a.problems[0]
    add(
      say(l, "Real problems, solved", "Real problems, solved"),
      p
        ? say(l, `Straight answers to what ${aud} struggle with, starting with “${cut(p, 60)}”`, `Diretsong sagot sa mga problema ng ${mga(aud, l)}, simula sa “${cut(p, 60)}”`)
        : say(l, `Straight answers to what ${aud} ask most`, `Diretsong sagot sa pinakamadalas itanong ng ${mga(aud, l)}`)
    )
    fromDomain(0)
    if (core.second) fromDomain(0, core.second)
    fromDomain(2)
    fromDomain(4)
  }
  const aim = a.aims[0]
  const conversion = aim ? CONVERSION[aim] : null
  list.splice(conversion ? 5 : 6)
  for (let i = 0; list.length < 4 && i < d.pillars.length; i++) fromDomain(i)
  for (let i = 0; list.length < 4 && i < STRUCTURAL.length; i++) add(STRUCTURAL[i][0][l], STRUCTURAL[i][1][l], "domain")
  if (conversion) add(conversion[0][l], conversion[1][l], "domain")
  const rows = list.slice(0, 6)
  const targets = toHundred(WEIGHTS[rows.length] ?? rows.map(() => 1))
  return rows.map(([name, description], i) => ({ name, description, target_percentage: targets[i] }))
}

/* ---------------------------------- Posts ---------------------------------- */

function problemPost(problem: string, aud: string, l: L, variant: 0 | 1): Post {
  const p = cut(problem, 72)
  const q = lowerStart(p)
  if (variant === 0) {
    return {
      title: say(l, `The real fix for “${q}”`, `Paano ayusin ang “${q}”`),
      hook: say(l, `${upperFirst(aud)} say it all the time: “${p}.” Here's what actually helps.`, `Ito ang laging sinasabi ng ${mga(aud, l)}: “${p}.” Eto ang talagang nakakatulong.`),
    }
  }
  return {
    title: say(l, `If “${q}” sounds like you, start here`, `Kung relate ka sa “${q}”, dito ka magsimula`),
    hook: say(l, `This one's for ${aud} who keep saying: “${p}.” Here's where I'd start.`, `Para 'to sa ${mga(aud, l)} na laging nagsasabing: “${p}.” Dito ako magsisimula.`),
  }
}

const mistakesPost = (topic: string, aud: string, n: number, l: L): Post => ({
  title: say(l, `${n} ${topic} mistakes ${aud} make (and what to do instead)`, `${n} ${topic} mistakes ng ${mga(aud, l)} (at ano ang dapat gawin)`),
  hook: say(l, `These ${n} ${topic} mistakes are more common than you think — the last one costs the most.`, `Mas common 'tong ${n} ${topic} mistakes kaysa sa inaakala mo — pinakamahal 'yung huli.`),
})

const mythPost = (topic: string, aud: string, l: L): Post => ({
  title: say(l, `The ${topic} advice ${aud} should stop following`, `Ang ${topic} advice na dapat nang itigil ng ${mga(aud, l)}`),
  hook: say(l, `This ${topic} advice sounds right. It's also why so many ${aud} stay stuck.`, `Mukhang tama 'tong ${topic} advice. Pero ito rin ang dahilan kung bakit stuck pa rin ang maraming ${noMga(aud)}.`),
})

const stepsPost = (topic: string, l: L): Post => ({
  title: say(l, `${upperFirst(topic)} for beginners: your first 3 steps`, `${upperFirst(topic)} para sa beginners: ang unang 3 steps`),
  hook: say(l, `Starting ${topic} from zero? Do these three things before anything else.`, `Magsisimula ka pa lang sa ${topic}? Gawin mo muna 'tong tatlo bago ang lahat.`),
})

const checklistPost = (topic: string, aud: string, l: L): Post => ({
  title: say(l, `The ${topic} checklist for ${aud}`, `${upperFirst(topic)} checklist para sa ${mga(aud, l)}`),
  hook: say(l, `Save this ${topic} checklist — run it once a month and you'll catch problems early.`, `I-save mo 'tong ${topic} checklist — gawin mo once a month para maagapan ang problema.`),
})

const lovePost = (topic: string, l: L): Post => ({
  title: say(l, `Why I can't stop talking about ${topic}`, `Bakit hindi ako mapigilang magkwento tungkol sa ${topic}`),
  hook: say(
    l,
    `Fair warning: this account is going to be a lot of ${topic}. Here's why it matters to me — and why it should matter to you.`,
    `Fair warning: puro ${topic} ang laman ng account na 'to. Eto kung bakit mahalaga 'to sa akin — at kung bakit dapat sa'yo rin.`
  ),
})

const bridgePost = (main: string, other: string, l: L): Post => ({
  title: say(l, `What ${other} can teach you about ${main}`, `Ang matututunan mo sa ${other} tungkol sa ${main}`),
  hook: say(l, `${upperFirst(other)} and ${main} have more in common than you think.`, `Mas magkapareho ang ${other} at ${main} kaysa sa inaakala mo.`),
})

/** Built on the creator's own proof: years, a result, their story — or an honest build-in-public start. */
function proofPost(topic: string, skill: string, a: Analysis): Post {
  const l = a.l
  if (a.years && skill) {
    const same = sameGround(skill, topic)
    return {
      title: say(l, same ? `What ${a.years} years of ${skill} taught me` : `What ${a.years} years of ${skill} taught me about ${topic}`, `Ang natutunan ko sa ${a.years} years ng ${skill}`),
      hook: say(l, `${a.years} years in, here's the one lesson I wish someone told me on day one.`, `${a.years} years na ako dito — ito 'yung isang lesson na sana sinabi sa akin noong day one.`),
    }
  }
  if (a.proof) {
    return {
      title: `Behind the result: ${lowerStart(cut(a.proof, 70))}`,
      hook: say(l, "People ask how this happened. Here's the honest, unglamorous version.", "Maraming nagtatanong kung paano 'to nangyari. Eto ang honest na version."),
    }
  }
  if (a.story) {
    return {
      title: say(l, `The story behind my ${topic} journey`, `Ang kwento sa likod ng ${topic} journey ko`),
      hook: cut(stripEndPunct(firstSentence(a.story)), 110) + (a.story.length > 110 ? "…" : "."),
    }
  }
  return {
    title: say(l, `Day 1 of documenting my ${topic} journey`, `Day 1 ng pag-document ng ${topic} journey ko`),
    hook: say(l, `I'm starting from zero with ${topic} — follow along and learn from my mistakes.`, `Magsisimula ako from zero sa ${topic} — sumama ka at matuto sa mga mali ko.`),
  }
}

function postsOf(core: Core, a: Analysis, expertise: Core): Post[] {
  const l = a.l
  const aud = core.audience
  const t0 = core.terms[0] ?? core.domain.topic[l]
  const skill = expertise.borrowed ? "" : (expertise.terms[0] ?? "")
  const [p0, p1] = a.problems
  let posts: Post[]
  if (core.kind === "expertise") {
    posts = [p0 ? problemPost(p0, aud, l, 0) : stepsPost(t0, l), mistakesPost(t0, aud, 3, l), p0 ? stepsPost(t0, l) : checklistPost(t0, aud, l), proofPost(t0, skill, a), mythPost(t0, aud, l)]
  } else if (core.kind === "passion") {
    const t1 = core.terms[1]
    // Only problems from this direction's world — a baking problem doesn't belong in a travel niche.
    const own = a.problems.find((p) => domainOf(p)?.id === core.domain.id || core.terms.some((t) => sameGround(t, p)))
    posts = [
      t1 ? bridgePost(t0, t1, l) : stepsPost(t0, l),
      mistakesPost(t0, aud, 5, l),
      own ? problemPost(own, aud, l, 1) : checklistPost(t0, aud, l),
      mythPost(t0, aud, l),
      core.borrowed ? proofPost(t0, "", { ...a, years: null, proof: "" }) : lovePost(t0, l),
    ]
  } else {
    posts = [
      p0 ? problemPost(p0, aud, l, 1) : stepsPost(t0, l),
      p1 ? problemPost(p1, aud, l, 0) : mistakesPost(t0, aud, 7, l),
      checklistPost(core.domain.topic[l], aud, l),
      proofPost(t0, skill, a),
      a.problems[2] ? problemPost(a.problems[2], aud, l, 0) : mythPost(t0, aud, l),
    ]
  }
  const seen = new Set<string>()
  return posts.filter((p) => !seen.has(p.title.toLowerCase()) && seen.add(p.title.toLowerCase())).slice(0, 5)
}

/* ------------------------------ Fit & reasons ------------------------------ */

const clampScore = (n: number) => Math.max(1, Math.min(10, Math.round(n)))

function fitOf(core: Core, a: Analysis): NicheOption["fit"] {
  const l = a.l
  const topic = joinTopics(core.terms, l)
  const covers = (term: string) => domainOf(term)?.id === core.domain.id || core.terms.some((t) => sameGround(t, term))
  const hilig = a.interests.find(covers)
  const galing = a.skills.find(covers)
  const helpHit = Boolean(a.help && (domainOf(a.help)?.id === core.domain.id || core.terms.some((t) => sameGround(t, a.help))))

  let passion: FitScore
  if (!a.interests.length) {
    passion = { score: 5, reason: say(l, "You haven't listed interests yet, so this score is a guess.", "Wala ka pang nilistang hilig, kaya hula pa lang ang score na 'to.") }
  } else if (core.kind === "passion" && !core.borrowed) {
    passion = {
      score: core.terms.length >= 2 ? 9 : 8,
      reason: say(l, `Built on ${topic} — topics you'd talk about for hours.`, `Galing sa ${topic} — mga topic na kaya mong pag-usapan nang ilang oras.`),
    }
  } else if (hilig) {
    passion = {
      score: core.kind === "expertise" ? 8 : 7,
      reason: say(l, `You also love ${hilig}, so this won't feel like homework.`, `Hilig mo rin ang ${hilig}, kaya hindi 'to magiging parang homework.`),
    }
  } else {
    passion = {
      score: core.kind === "audience" ? 6 : 5,
      reason: say(
        l,
        `${upperFirst(topic)} isn't on your hilig list — make sure you'd still enjoy it a year from now.`,
        `Wala ang ${topic} sa hilig list mo — siguraduhing mag-e-enjoy ka pa rin dito after one year.`
      ),
    }
  }

  let expertise: FitScore
  if (galing || (helpHit && core.kind !== "passion")) {
    const score = 6 + Math.min(2, Math.floor((a.years ?? 0) / 3)) + (a.proof ? 1 : 0) + (helpHit ? 1 : 0) - (core.kind === "audience" ? 1 : 0)
    const term = galing ?? topic
    const reason = a.years
      ? say(l, `${a.years} years of ${term}${a.proof ? `, plus proof: “${cut(a.proof, 80)}”` : ""}.`, `${a.years} years ka na sa ${term}${a.proof ? `, may proof pa: “${cut(a.proof, 80)}”` : ""}.`)
      : a.proof
        ? say(l, `You can show proof: “${cut(a.proof, 90)}”.`, `May maipapakita kang proof: “${cut(a.proof, 90)}”.`)
        : helpHit
          ? say(l, `People already ask you for help with “${cut(a.help, 80)}”.`, `Humihingi na sa'yo ng tulong ang mga tao sa “${cut(a.help, 80)}”.`)
          : say(l, `You listed ${term} as a skill — add a result or two to make it undeniable.`, `Nilista mo ang ${term} bilang skill — magdagdag ng isa o dalawang resulta para mas kapani-paniwala.`)
    expertise = { score: clampScore(score), reason }
  } else {
    expertise = {
      score: a.skills.length ? 4 : 3,
      reason: say(l, "You'd be learning in public here — fine, as long as you document your progress as proof.", "Matututo ka in public dito — okay lang, basta i-document mo ang progress mo bilang proof."),
    }
  }

  const n = a.problems.length
  const demandScore = core.domain.demandScore + (n >= 3 ? 1 : 0) + (core.kind === "audience" && n ? 1 : 0) - (a.audiences.length ? 0 : 1)
  const demand: FitScore =
    core.kind === "audience" && n
      ? {
          score: clampScore(demandScore),
          reason: say(
            l,
            `You already know ${n === 1 ? "one real problem" : `${n} real problems`} ${noMga(core.audience)} have — that's demand you can see today.`,
            `Alam mo na ang ${n === 1 ? "isang totoong problema" : `${n} totoong problema`} ng ${mga(core.audience, l)} — demand na 'yan na nakikita mo ngayon pa lang.`
          ),
        }
      : { score: clampScore(demandScore), reason: core.domain.demand[l] }
  return { passion, expertise, demand }
}

const AIM_PAYOFF: Record<NicheAim, Bi> = {
  clients: ["paying clients", "paying clients"],
  products: ["product sales", "product sales"],
  career: ["career opportunities", "career opportunities"],
  speaking: ["speaking invites", "speaking invites"],
  community: ["a real community", "totoong community"],
  audience: ["a loyal audience", "loyal na audience"],
}

function whyOf(core: Core, a: Analysis): string {
  const l = a.l
  const topic = joinTopics(core.terms, l)
  const aud = core.audience
  if (core.kind === "expertise") {
    return say(
      l,
      `It turns what you're already good at (${topic}) into content ${aud} need${core.flavor ? `, with ${core.flavor} as your personal flavour` : ""}.`,
      `Ginagawang content ang galing mo (${topic}) para sa ${mga(aud, l)}${core.flavor ? `, at ang ${core.flavor} ang personal flavor mo` : ""}.`
    )
  }
  if (core.kind === "passion") {
    return core.borrowed
      ? say(l, `Documenting ${topic} honestly builds trust even before you're an expert — and it's easy to keep up.`, `Ang honest na pag-document ng ${topic} ay nakakabuo ng trust kahit hindi ka pa expert — at madaling ituloy.`)
      : say(
          l,
          `It starts from what you'd talk about anyway (${topic}), so staying consistent is easier — and ${aud} already look for it.`,
          `Nagsisimula sa mga pag-uusapan mo kahit walang bayad (${topic}), kaya mas madali ang consistency — at hinahanap na 'to ng ${mga(aud, l)}.`
        )
  }
  const payoff = AIM_PAYOFF[a.aims[0] ?? "clients"][l]
  return say(
    l,
    `It's built around ${aud} and the problems they already have — the shortest path to trust and ${payoff}.`,
    `Nakasentro sa ${mga(aud, l)} at sa mga problemang meron na sila — pinakamabilis na daan papunta sa trust at ${payoff}.`
  )
}

const KIND_RISK: Record<NicheKind, Bi> = {
  expertise: [
    "Expertise-only content can feel dry — mix in your own stories so it doesn't read like a manual.",
    "Pwedeng maging dry ang puro expertise na content — haluan ng sarili mong kwento para hindi parang manual.",
  ],
  passion: [
    "Passion without proof is a crowded lane — document your own results early so people trust you.",
    "Siksikan ang passion na walang proof — i-document agad ang sarili mong results para pagkatiwalaan ka.",
  ],
  audience: [
    "A specific audience grows slower at first — but every follower is closer to becoming a client.",
    "Mas mabagal ang growth sa simula dahil specific ang audience — pero bawat follower, mas malapit maging client.",
  ],
}

const AIM_MONEY: Record<NicheAim, (skill: string, topic: string, aud: string, l: L) => string> = {
  clients: (skill, topic, aud, l) => say(l, `${upperFirst(skill || topic)} services for ${aud}`, `${upperFirst(skill || topic)} services para sa ${mga(aud, l)}`),
  products: (_skill, topic, _aud, l) => say(l, `${upperFirst(topic)} templates or a starter guide`, `${upperFirst(topic)} templates o starter guide`),
  career: (_s, _t, _a, l) => say(l, "A portfolio that gets you hired or promoted", "Portfolio na magpapa-hire o magpapa-promote sa'yo"),
  speaking: (_s, _t, _a, l) => say(l, "Paid talks and workshops", "Paid na talks at workshops"),
  community: (_s, _t, _a, l) => say(l, "A paid community or group coaching", "Paid na community o group coaching"),
  audience: (_s, _t, _a, l) => say(l, "Brand deals once your audience is engaged", "Brand deals kapag engaged na ang audience mo"),
}

/** Which of a domain's monetization paths serves each aim. */
const AIM_MATCH: Record<NicheAim, RegExp | null> = {
  clients: /service|coaching|consult|retainer|done-for-you|audit|brokerage|tutoring|orders|projects/i,
  products: /template|e-?book|guide|course|preset|reviewer|kit|planner|journal|product|pack/i,
  community: /community|group|mastermind/i,
  speaking: /workshop|talk|training|speaking|class/i,
  audience: /partnership|sponsor|affiliate|brand deal|donation/i,
  career: null,
}

function moneyOf(core: Core, a: Analysis): string[] {
  const l = a.l
  const t0 = core.terms[0] ?? core.domain.topic[l]
  const options = core.domain.monetization.map((m) => m[l])
  const lines: string[] = []
  const push = (line: string | undefined) => {
    if (line && lines.length < 4 && !lines.some((x) => x.toLowerCase() === line.toLowerCase())) lines.push(line)
  }
  // Each aim gets the domain's most fitting path first, then a path built from the creator's own topic.
  for (const aim of a.aims.slice(0, 2)) {
    const re = AIM_MATCH[aim]
    const fitting = re ? options.find((m) => re.test(m) && !lines.includes(m)) : undefined
    const own =
      aim === "clients" && core.kind === "passion"
        ? say(l, `1:1 ${t0} coaching for ${core.audience}`, `1:1 ${t0} coaching para sa ${mga(core.audience, l)}`)
        : AIM_MONEY[aim](core.kind === "passion" ? "" : t0, t0, core.audience, l)
    push(fitting ?? own)
  }
  for (const m of options) push(m)
  return lines
}

/* ---------------------------------- Notes ---------------------------------- */

function notesOf(a: Analysis): string[] {
  const l = a.l
  const out: string[] = []
  if (a.interests.length < 2) {
    out.push(say(l, "Add at least one more hilig — with two interests the passion-led direction gets much sharper.", "Magdagdag pa ng kahit isang hilig — mas tatalas ang passion-led na direction kapag dalawa o higit pa."))
  }
  if (!a.skills.length && !a.help) {
    out.push(
      say(
        l,
        "You haven't listed skills yet, so the expertise-led direction is a guess. Add one thing people ask you for help with.",
        "Wala ka pang nilistang skills, kaya hula pa lang ang expertise-led na direction. Magdagdag ng kahit isang bagay na hinihingan ka ng tulong."
      )
    )
  }
  if (!a.audiences.length) {
    out.push(
      say(
        l,
        "No audience yet — these use a typical audience for the topic. Say who you want to help to make them yours.",
        "Wala pang audience — typical na audience muna ang gamit dito. Sabihin kung sino ang gusto mong tulungan para maging sa'yo talaga."
      )
    )
  }
  if (a.problems.length < 3) {
    const n = 3 - a.problems.length
    out.push(
      say(
        l,
        `Add ${n === 1 ? "one more audience problem" : `${n} more audience problems`} to sharpen this — real problems are what make a niche specific.`,
        `Magdagdag ng ${n === 1 ? "isa pang problema" : `${n} pang problema`} ng audience mo para mas tumalas 'to — ang totoong problema ang nagpapa-specific sa niche.`
      )
    )
  }
  if (!a.aims.length) {
    out.push(say(l, "Pick what the brand should do for you so the monetization paths match your goal.", "Piliin kung para saan ang brand mo para tumugma ang monetization paths sa goal mo."))
  }
  return out.slice(0, 4)
}

/* ---------------------------------- Engine --------------------------------- */

function optionOf(core: Core, a: Analysis, expertise: Core, usedRisks: Set<string>): NicheOption {
  const l = a.l
  const risk = core.domain.risk && !usedRisks.has(core.domain.id) ? core.domain.risk[l] : KIND_RISK[core.kind][l]
  if (core.domain.risk && !usedRisks.has(core.domain.id)) usedRisks.add(core.domain.id)
  const audience = noMga(core.audience)
  return {
    kind: core.kind,
    name: nameOf(core, l),
    niche_statement: statementOf(core, a),
    audience: core.audience,
    industry: core.domain.industry,
    positioning_statement: `I help ${audience} ${core.result} through ${core.method}.`,
    positioning_audience: audience,
    positioning_result: core.result,
    positioning_method: core.method,
    pillars: pillarsOf(core, a),
    sample_posts: postsOf(core, a, expertise),
    monetization: moneyOf(core, a),
    fit: fitOf(core, a),
    why_it_fits: whyOf(core, a),
    risk,
  }
}

const KIND_LABEL: Record<NicheKind, Bi> = { expertise: ["expertise-led", "galing-first"], passion: ["passion-led", "hilig-first"], audience: ["audience-led", "audience-first"] }

export function discoverNiches(input: NicheDiscoveryInput): NicheDiscoveryOutput {
  const a = analyze(input)
  const expertise = expertiseCore(a)
  const passion = passionCore(a, expertise)
  const audience = audienceCore(a, expertise, passion)
  const usedRisks = new Set<string>()
  const options = [expertise, passion, audience].map((core) => optionOf(core, a, expertise, usedRisks))
  // Three directions must never read as one: a repeated name gets its direction label.
  options.forEach((o, i) => {
    if (options.slice(0, i).some((x) => x.name.toLowerCase() === o.name.toLowerCase())) o.name = `${o.name} (${KIND_LABEL[o.kind][a.l]})`
  })
  return { options, notes: notesOf(a) }
}
