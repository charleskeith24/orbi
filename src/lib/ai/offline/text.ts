/**
 * Text utilities for the offline engine: seeded randomness, tokenising (English + Filipino
 * stopwords), light stemming, sentence handling and small grammar helpers.
 */

/* --------------------------------- Random ---------------------------------- */

export interface Rng {
  /** [0, 1) */
  next(): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
  chance(p: number): boolean
}

/** FNV-1a 32-bit. */
export function hashString(value: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 — small, fast, deterministic. */
export function createRng(seed: number | string): Rng {
  let a = typeof seed === "string" ? hashString(seed) : seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)] as T,
    shuffle: <T,>(items: readonly T[]) => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    chance: (p) => next() < p,
  }
}

/* -------------------------------- Tokenising ------------------------------- */

const STOPWORDS = new Set(
  (
    "a an the and or but if then so of to in on at by for with from into onto about as is are was were be been being am " +
    "do does did done have has had having i me my mine we us our ours you your yours he him his she her they them their " +
    "it its this that these those there here what which who whom whose when where why how not no yes all any some more most " +
    "very just also too than can could should would will shall may might must get got gets make makes made really " +
    "one two three thing things stuff way ways lot lots much many every each other another such only own same still even ever " +
    "like want wants need needs know think realized realize noticed notice learned learn today yesterday week weeks " +
    "people someone something anyone everyone because while after before over under again always never often " +
    "down out up off away back here's there's let's what's gonna without within instead based using actually already " +
    "maybe per via across along toward towards whether else ok okay yeah " +
    // Filipino / Taglish function words
    "ang ng sa na mga ko mo ka ako siya kami tayo natin namin nila niya kayo kanila yung 'yung lang din rin pa po ba kasi " +
    "pero at o para hindi wala walang may meron kung pag dahil nga naman talaga ito iyan yan dito doon diyan sila akin atin amin " +
    "si ni kay mas eh ha oo opo ay nang tapos kapag sabi sasabihin gumagana karamihan marami maraming dapat kong mong niyang " +
    "nating naming kanilang ninyo niyo sayo yun iyon ganito ganyan ngayon bukas kahapon kanina noon pala sana daw raw lahat " +
    "bawat ganun ganon ano anong bakit paano saan kailan sino alin mismo muna agad lagi palagi siguro baka " +
    "napansin natutunan naisip nakita alam gusto ayaw kailangan ulit pa rin"
  ).split(/\s+/)
)

/** Tagalog verb affixes glued to English roots ("nagbo-boost", "mag-scale", "i-post") — the English root is the topic word. */
const TAGALOG_AFFIX = /\b(?:nagpa|magpa|napa|ipa|pina|nag|mag|pag|na|ma|i|ika)(?:[a-z]{1,3})?-(?=[a-z]{2,})/gi

/** Lowercase word tokens (letters, digits, Filipino letters), stopwords and contractions removed. */
export function words(text: string): string[] {
  return (text.toLowerCase().replace(TAGALOG_AFFIX, "").match(/[a-z0-9ñ₱%.']+/g) ?? [])
    .map((w) => w.replace(/^[.']+|[.']+$/g, ""))
    .filter((w) => w.length > 1 && !w.includes("'") && !STOPWORDS.has(w))
}

const TAGALOG_MARKERS = new Set(
  "ang ng mga sa hindi kasi pero natin namin mo ko lang talaga naman yung ito kaya ikaw tayo kami sila siya ako walang wala meron kung dahil nga po ba din rin karamihan sabi gumagana kanina bakit paano ano alin saan dapat muna huwag sana ngayon".split(" ")
)

/** True when the text is written (at least partly) in Tagalog — two or more common Tagalog function words. */
export function looksTagalog(text: string): boolean {
  let n = 0
  for (const w of text.toLowerCase().match(/[a-zñ']+/g) ?? []) {
    if (TAGALOG_MARKERS.has(w.replace(/^'+|'+$/g, "")) && ++n >= 2) return true
  }
  return false
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase())
}

/** Very light stemmer so "systems"/"system", "managing"/"manage" meet. */
export function stem(word: string): string {
  let w = word
  if (w.length > 5 && w.endsWith("ies")) return `${w.slice(0, -3)}y`
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2)
  else if (w.length > 4 && w.endsWith("es") && /(ss|sh|ch|x|z)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1)
  // "hire"/"hiring"/"hired" and "scale"/"scaling" all meet at the same stem.
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1)
  return w
}

export function tokenSet(text: string): Set<string> {
  return new Set(words(text).map(stem))
}

/** Share of `query` tokens found in `target` (0–1). */
export function overlap(query: Set<string>, target: Set<string>): number {
  if (!query.size || !target.size) return 0
  let hits = 0
  for (const t of query) if (target.has(t)) hits++
  return hits / query.size
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  return shared / (a.size + b.size - shared)
}

/** Most frequent content words (original spelling), longest first on ties. */
export function keywords(text: string, limit = 6): string[] {
  const counts = new Map<string, { word: string; count: number; first: number }>()
  words(text).forEach((w, i) => {
    if (/^[\d₱%.,]+$/.test(w)) return
    const key = stem(w)
    const entry = counts.get(key)
    if (entry) entry.count++
    else counts.set(key, { word: w, count: 1, first: i })
  })
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || b.word.length - a.word.length || a.first - b.first)
    .slice(0, limit)
    .map((e) => e.word)
}

/* -------------------------------- Sentences -------------------------------- */

export function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/** Splits on terminal punctuation followed by a new sentence — never inside "0.8%" or "₱4.2M". */
export function splitSentences(text: string): string[] {
  const t = clean(text)
  if (!t) return []
  return t
    .split(/(?<=[.!?…]["”’')]?)\s+(?=["“‘'(]?[A-Z0-9₱#])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
}

export function firstSentence(text: string): string {
  return splitSentences(text)[0] ?? clean(text)
}

export function stripEndPunct(text: string): string {
  return text.trim().replace(/[\s.!?,;:…]+$/, "")
}

export function upperFirst(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text
}

export function isAcronym(word: string): boolean {
  return /^[A-Z0-9₱]{2,}s?$/.test(word) || /^[A-Z][a-z]+[A-Z]/.test(word)
}

export function lowerFirst(text: string): string {
  if (!text) return text
  const first = text.split(/\s+/)[0] ?? ""
  if (isAcronym(first) || /^I\b/.test(text)) return text
  return text[0].toLowerCase() + text.slice(1)
}

/** Lowercase everything except acronyms and mixed-case names (ROAS, KPIs, TikTok). */
export function lowerKeepAcronyms(text: string): string {
  return clean(text)
    .split(" ")
    .map((w) => (isAcronym(w.replace(/[^A-Za-z0-9₱]/g, "")) ? w : w.toLowerCase()))
    .join(" ")
}

/** Ensure one terminal punctuation mark ("(flat or falling)" still gets its period). */
/** "Should founders hire an agency…" is a question even when it arrives without its question mark. */
const AUX_QUESTION =
  /^(?:should|can|could|would|will|is|are|was|were|does|did|have|has)\s+(?:i|you|we|they|he|she|it|this|that|there|founders?|sellers?|brands?|people|everyone|your|my|our|the|a|an)\b|^do\s+(?:i|you|we|they|your|my|our)\b/i

export function sentence(text: string): string {
  const t = clean(text)
  if (!t) return t
  if (/[.!?…:]["”'’)]*$/.test(t)) return upperFirst(t)
  return `${upperFirst(t)}${AUX_QUESTION.test(t) ? "?" : "."}`
}

/** A short line (on-screen text, slide, list item): up to the first natural break, never cut mid-phrase with an ellipsis. */
export function headline(text: string, maxWords = 7): string {
  // First sentence, then the first clause — a comma inside a number ("₱380,000") is not a break.
  const t = stripEndPunct(splitSentences(clean(text))[0] ?? clean(text))
  const first = t.split(/,\s|:\s|;\s|\s?[—–]\s?|\s-\s|\(/)[0]?.trim() ?? t
  const base = first.split(" ").length <= maxWords ? first : t
  const out = base.split(" ").slice(0, maxWords)
  while (out.length > 2 && /^(the|a|an|to|of|for|with|and|or|in|on|at|your|my|our|is|are|=|−|-|by|before|after|when|if)$/i.test(out[out.length - 1])) out.pop()
  return out.join(" ")
}

export function clip(text: string, max: number): string {
  const t = clean(text)
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, "")}…`
}

export function truncateWords(text: string, count: number): string {
  const parts = clean(text).split(" ")
  return parts.length <= count ? parts.join(" ") : `${parts.slice(0, count).join(" ")}…`
}

/** "they struggle with their ads" → "you struggle with your ads". */
export function toSecondPerson(text: string): string {
  return text
    .replace(/\bthey're\b/gi, "you're")
    .replace(/\bthey've\b/gi, "you've")
    .replace(/\bthey'll\b/gi, "you'll")
    .replace(/\bthemselves\b/gi, "yourself")
    .replace(/\bthey\b/gi, "you")
    .replace(/\btheir\b/gi, "your")
    .replace(/\bthem\b/gi, "you")
    .replace(/\byou is\b/gi, "you are")
    .replace(/\byou was\b/gi, "you were")
    .replace(/\byou has\b/gi, "you have")
    .replace(/\byou doesn't\b/gi, "you don't")
}

const IRREGULAR_GERUNDS: Record<string, string> = { be: "being", see: "seeing", die: "dying", lie: "lying", run: "running", get: "getting", set: "setting", put: "putting", cut: "cutting", sit: "sitting", stop: "stopping", plan: "planning", win: "winning", begin: "beginning", ship: "shipping", hit: "hitting", swim: "swimming", shop: "shopping", scale: "scaling" }

/** manage → managing, run → running, post → posting. */
export function gerund(verb: string): string {
  let v = verb.toLowerCase()
  // Third person → base form first ("needs" → "need", "fixes" → "fix").
  if (/[^s]s$/.test(v) && !IRREGULAR_GERUNDS[v]) {
    const base = [v.replace(/ies$/, "y"), v.replace(/es$/, ""), v.slice(0, -1)].find((b) => b !== v && COMMON_VERBS.has(b))
    if (base) v = base
  }
  if (IRREGULAR_GERUNDS[v]) return IRREGULAR_GERUNDS[v]
  if (v.endsWith("ing")) return v
  if (v.endsWith("ie")) return `${v.slice(0, -2)}ying`
  if (v.endsWith("ee") || v.endsWith("ye") || v.endsWith("oe")) return `${v}ing`
  if (v.endsWith("e") && v.length > 2) return `${v.slice(0, -1)}ing`
  return `${v}ing`
}

/** Turn "manage content based on inspiration" into "managing content based on inspiration". */
export function gerundPhrase(phrase: string): string {
  const [first, ...rest] = clean(phrase).split(" ")
  if (!first) return phrase
  return [gerund(first), ...rest].join(" ")
}

const COMMON_VERBS = new Set(
  "manage run build create post plan hire fire lead grow scale sell market track test launch write record edit spend budget price rely depend use make start stop keep choose chase focus measure delegate outsource automate copy ignore skip treat approach handle pay promote advertise optimize optimise buy invest save burn wait guess repeat train coach touch increase check say said tell told present need bring show share ask asked quit reply answer fix care cares decide kill read explain give set lose lost win won ship call called".split(
    " "
  )
)

export function looksLikeVerb(word: string): boolean {
  const w = word.toLowerCase()
  return COMMON_VERBS.has(w) || COMMON_VERBS.has(stem(w))
}

let verbStems: Set<string> | null = null
/** True when a stemmed token (from `tokenSet`) is the stem of a common verb ("decid", "hir"). */
export function isVerbStem(token: string): boolean {
  verbStems ??= new Set([...COMMON_VERBS].map(stem))
  return verbStems.has(token)
}

/** Join a list naturally: "a, b and c". */
export function listJoin(items: string[], conjunction = "and"): string {
  const list = items.filter(Boolean)
  if (list.length <= 1) return list[0] ?? ""
  return `${list.slice(0, -1).join(", ")} ${conjunction} ${list[list.length - 1]}`
}

export function titleCase(text: string): string {
  const small = new Set(["a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "vs", "with", "by"])
  return clean(text)
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : /^[a-z]/.test(w) ? upperFirst(w) : w))
    .join(" ")
}

export function hashtag(word: string): string {
  const tag = word
    .replace(/[^a-zA-Z0-9ñÑ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.toLowerCase() : upperFirst(w.toLowerCase())))
    .join("")
  return tag ? `#${tag}` : ""
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = key(item).toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Deterministic seed for an offline call. */
export function seedFor(task: string, input: unknown): string {
  let json = ""
  try {
    json = JSON.stringify(input) ?? ""
  } catch {
    json = String(input)
  }
  return `${task}|${json}`
}
