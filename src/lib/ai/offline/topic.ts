/**
 * Reads a rough note, idea, title or post and pulls out what the offline engine needs to write about
 * it: the claim, a short subject, the audience, an "A instead of B" contrast, the action and intent signals.
 */
import {
  clean,
  gerundPhrase,
  isAcronym,
  isStopword,
  keywords,
  looksLikeVerb,
  looksTagalog,
  lowerKeepAcronyms,
  splitSentences,
  stripEndPunct,
  tokenSet,
  upperFirst,
  words,
} from "./text"

export interface TopicAnalysis {
  /** Cleaned full input. */
  text: string
  /** First meaningful sentence, lead-in removed, no trailing punctuation. */
  claim: string
  /** Short noun phrase to write about, e.g. "content systems". */
  subject: string
  audience: string | null
  /** What they rely on (from) vs what works (to). */
  contrast: { from: string; to: string } | null
  /** Verb phrase, e.g. "manage content". */
  action: string | null
  /** "managing content". */
  gerundAction: string | null
  object: string | null
  keywords: string[]
  tokens: Set<string>
  signals: {
    howTo: boolean
    story: boolean
    mistake: boolean
    list: boolean
    question: boolean
    opinion: boolean
    offer: boolean
    numbers: boolean
    firstPerson: boolean
    leadership: boolean
  }
}

const LEAD_INS = [
  /^(so|okay|ok|honestly|lately|today|real talk|random thought|note|idea|thought|hot take|unpopular opinion|observation)\s*[:,—-]?\s+/i,
  /^(i|we)\s+(just\s+|finally\s+|recently\s+)?(realized|realised|noticed|learned|learnt|think|believe|feel|found out|figured out|discovered|keep seeing|see|saw|was thinking|have been thinking)\s+(that\s+|about\s+)?/i,
  /^(it\s+)?(turns out|seems like|looks like)\s+(that\s+)?/i,
  /^(na-?realize|napansin|natutunan|naisip)\s+ko\s+(na\s+|kanina\s+)?/i,
]

const AUDIENCE_PLURALS =
  "business owners|small business owners|founders|entrepreneurs|marketers|marketing leads|marketing managers|marketing teams|creators|sellers|online sellers|brands|brand owners|teams|team leads|leaders|managers|freelancers|agencies|agency owners|small businesses|companies|coaches|consultants|clients|beginners|startups|shop owners|store owners|employees"
const AUDIENCE_ANY_NOUN = `${AUDIENCE_PLURALS}|people|business owner|founder|entrepreneur|marketer|creator|seller|brand|team|leader|manager|freelancer|agency|company|coach|consultant|client|beginner|startup`

const AUDIENCE_QUANTIFIED = new RegExp(`\\b(?:most|many|a lot of|so many|all|some|every|too many)\\s+((?:[a-z-]+\\s){0,2}?(?:${AUDIENCE_ANY_NOUN}))\\b`, "i")
/** Only plural nouns count as an audience when not quantified ("home-goods brand" is not an audience). */
const AUDIENCE_PLURAL = new RegExp(`\\b((?:[a-z-]+\\s)?(?:${AUDIENCE_PLURALS}))\\b`, "i")

const TAIL_PREPOSITIONS = /\s(?:based on|on|with|by|through|from|using|via|around|off)\s+(.+)$/i

const PRONOUN = /^(i|me|my|mine|we|us|our|ours|you|your|yours|he|him|his|she|her|hers|they|them|their|theirs|it|its|this|that|these|those|someone|everyone|nobody|anyone|something|everything|nothing)$/i
const AUX = /^(is|are|was|were|be|been|am|will|would|should|could|can|may|might|must|do|does|did|has|have|had|shall)$/i
/** Words a topic phrase must never start or end with. */
const EDGE_WORDS = new Set(
  "the a an to of for with and or but in on at by from as that which who whom than so if then into onto over under about between among across without within versus vs via per toward towards upon again too now anymore yet already ang ng sa na mga ko mo kung hindi yung ay para".split(" ")
)
const TAGALOG_PIECE =
  /^(?:'?yung|kanina|kahapon|ngayon|(?:nag|mag|na|ma|i|pag)-\S+|ang|ng|mga|ko|mo|siya|kami|namin|natin|nila|niya|ako|ikaw|tayo|sila|kasi|pero|hindi|wala|walang|lang|talaga|naman|po|ba|din|rin|daw|pala|sana|kung|para|dahil|tapos)$/i
const LONE_WEAK = new Set("inside outside during through before after while why how what when where who which whether should could would will can may might must there here today now".split(" "))

/**
 * A subject that would read badly inside a template ("Most advice about ___ is backwards"):
 * pronouns ("i", "me"), auxiliaries and negations ("aren't"), Tagalog function words, dangling
 * prepositions ("by more"), lone question words ("how") or nothing with real content.
 */
export function isWeakSubject(subject: string | null | undefined): boolean {
  const parts = clean(subject ?? "")
    .toLowerCase()
    .replace(/[“”"?!,;:()]/g, " ")
    .replace(/\.(?=\s|$)/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length || parts.length > 6) return true
  if (parts.some((p) => PRONOUN.test(p) || AUX.test(p) || /n[’']t$/.test(p) || /^(?:i|you|we|they|he|she|it|that|there)[’'](?:m|re|ve|d|ll|s)$/.test(p))) return true
  // Greetings ("hi guys", "hello everyone") open a video; they are never its topic.
  if (/^(?:hi|hello|hey|yo|hiya|kumusta|musta|guys|folks)$/.test(parts[0]) || parts.includes("guys")) return true
  // Tagalog fragments ("kanina nag-resign 'yung best") never make a topic phrase.
  if (looksTagalog(subject ?? "") || parts.some((p) => TAGALOG_PIECE.test(p))) return true
  if (EDGE_WORDS.has(parts[0]) || EDGE_WORDS.has(parts[parts.length - 1])) return true
  if (parts.length === 1 && (LONE_WEAK.has(parts[0]) || isStopword(parts[0]))) return true
  if (parts.filter((p) => !isStopword(p)).length < Math.ceil(parts.length / 2)) return true
  // "agency or build", "hire and fire" joined to a verb read as fragments.
  if (parts.some((p, i) => (p === "or" || p === "and") && parts[i + 1] && isVerbish(parts[i + 1]) && !/ing$/.test(parts[i + 1]))) return true
  return !parts.some((p) => p.replace(/[^a-z0-9ñ₱]/g, "").length >= 3 && !isStopword(p))
}

/** "should founders" → "founders", "ng sellers" → "sellers" — drop function words in front of an audience noun. */
function cleanAudience(value: string | null): string | null {
  if (!value) return null
  const parts = value.trim().split(/\s+/)
  while (parts.length > 1 && (isStopword(parts[0]) || PRONOUN.test(parts[0]) || AUX.test(parts[0]))) parts.shift()
  const out = parts.join(" ")
  return out && out !== "people" ? out : null
}

function stripLeadIns(sentence: string): string {
  let s = clean(sentence)
  for (let i = 0; i < 3; i++) {
    const before = s
    for (const re of LEAD_INS) s = s.replace(re, "")
    if (s === before) break
  }
  return s
}

function lastWords(text: string, count: number): string {
  const parts = clean(text).split(" ")
  return parts.slice(-count).join(" ")
}

function detectContrast(claim: string): { from: string; to: string; left: string } | null {
  let m = /^(.+?)\s+(?:instead of|rather than)\s+(.+)$/i.exec(claim)
  if (m) {
    const left = m[1]
    const tail = TAIL_PREPOSITIONS.exec(left)?.[1] ?? lastWords(left, 2)
    return { from: stripEndPunct(tail), to: stripEndPunct(lastWords(m[2], 4)), left }
  }
  m = /^(.+?),?\s+not\s+(.+)$/i.exec(claim)
  if (m && m[1].split(" ").length <= 6 && m[2].split(" ").length <= 6) {
    return { from: stripEndPunct(m[2]), to: stripEndPunct(lastWords(m[1], 4)), left: m[1] }
  }
  m = /^(?:it'?s\s+)?not\s+(?:about\s+)?(.+?),?\s+(?:but|it'?s)\s+(?:about\s+)?(.+)$/i.exec(claim)
  if (m) return { from: stripEndPunct(m[1]), to: stripEndPunct(m[2]), left: m[1] }
  m = /^(.{3,40}?)\s+(?:over|beats?|>)\s+(.{3,40})$/i.exec(claim)
  if (m) return { from: stripEndPunct(m[2]), to: stripEndPunct(m[1]), left: m[1] }
  m = /^(.{3,40}?)\s+(?:vs\.?|versus)\s+(.{3,40})$/i.exec(claim)
  if (m) return { from: stripEndPunct(m[1]), to: stripEndPunct(m[2]), left: m[1] }
  return null
}

/** The verb phrase after the audience, e.g. "most business owners manage content based on …" → "manage content". */
function detectAction(claim: string, audience: string | null): { action: string; object: string | null } | null {
  let rest = claim
  if (audience) {
    const idx = claim.toLowerCase().indexOf(audience.toLowerCase())
    if (idx >= 0) rest = claim.slice(idx + audience.length)
  }
  rest = rest.replace(/^\s*(?:still|always|just|usually|often|keep|tend to|try to|don't|do not|never)\s+/i, "").trim()
  const parts = rest.split(/\s+/)
  const verb = parts[0]?.replace(/[^a-zA-Z-]/g, "") ?? ""
  if (!verb || !looksLikeVerb(verb)) return null
  const beforeTail = rest
    .replace(TAIL_PREPOSITIONS, "")
    .replace(/\s+(?:instead of|rather than|because|when|so|and|but|before|after|until|while|if|unless|without)\b.*$/i, "")
  const actionWords = beforeTail.split(/\s+/).slice(0, 5)
  const action = stripEndPunct(actionWords.join(" ")).toLowerCase()
  const object = actionWords.slice(1).join(" ").replace(/^(?:the|their|your|a|an|my|our)\s+/i, "").toLowerCase() || null
  return { action, object: object ? stripEndPunct(object) : null }
}

function isPlural(word: string): boolean {
  return /s$/i.test(word) && !/ss$/i.test(word)
}

/* ------------------------------ Noun phrases ------------------------------- */

const EXTRA_VERBS = new Set(
  "collapse drop leak miss depend know feel blame rely approve undercharge overcharge burn land tie end lose stall plateau rise fall cost kill break work change struggle fail underprice overpay wait copy boost chase ignore skip forget panic doubt waste hit read explain present give set pay post want need think compare expand sell spend worry fear hate love optimize optimise sell report".split(
    " "
  )
)
const CHUNK_SKIP = new Set(["the", "a", "an", "their", "his", "her", "its", "your", "my", "our", "for", "on", "to", "with", "about", "of", "in", "up", "out"])
const CHUNK_STOP = new Set(["when", "because", "but", "so", "while", "until", "before", "after", "if", "then", "without", "every", "that", "which", "who", "whoever", "than", "right", "is", "are", "was", "were", "be", "—", "-", "–"])
const TAGALOG_FUNCTION = /\b(walang|wala|ang|ng|mga|sa|na|kung|hindi)\b/i
const NOT_GERUNDS = /^(during|nothing|something|everything|anything|morning|evening|thing|bring|king|spring|string|ring|ceiling|wedding|building)$/i

function baseVerb(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z']/g, "")
  if (w === "doesn't" || w === "does") return "do"
  if (w === "has") return "have"
  if (w === "is") return "be"
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`
  if (/(ss|sh|ch|x|z)es$/.test(w)) return w.slice(0, -2)
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1)
  return w
}

export function isVerbish(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z']/g, "")
  if (!w) return false
  if (/^(still|keeps?)$/.test(w) || /n't$/.test(w) || AUX.test(w)) return true
  if (/(ed|ly)$/.test(w) && w.length > 4) return true
  const base = baseVerb(w)
  return looksLikeVerb(w) || looksLikeVerb(base) || EXTRA_VERBS.has(w) || EXTRA_VERBS.has(base)
}

const isNumberish = (t: string) => /^[₱$]?[\d.,]+[%kKmM]?$|^₱/.test(t)

/**
 * First noun phrase of a problem, question or title — what it is *about*.
 * "Doesn't know contribution margin per product" → "contribution margin per product";
 * "ROAS collapses every time budget is increased" → "ROAS".
 */
export function nounChunk(text: string, maxWords = 4): string {
  const tokens = clean(text)
    .replace(/[“”"?!.,;:()]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  let i = 0
  // Leading pronoun and verb ("I burned …", or a Problem Bank entry with the subject omitted): skip them.
  while (i < tokens.length && i < 4 && (PRONOUN.test(tokens[i]) || isVerbish(tokens[i]))) i++
  const out: string[] = []
  let usedAnd = false
  for (; i < tokens.length && out.length < maxWords; i++) {
    const raw = tokens[i]
    const t = raw.toLowerCase()
    if (!out.length && (CHUNK_SKIP.has(t) || isNumberish(raw))) continue
    if (CHUNK_STOP.has(t)) break
    if (t === "and" || t === "or") {
      if (usedAnd || !out.length) break
      usedAnd = true
      out.push(t)
      continue
    }
    if (out.length && isVerbish(raw) && !isAcronym(raw)) break
    if (out.length && CHUNK_SKIP.has(t) && t !== "of" && t !== "per") break
    if (PRONOUN.test(t)) {
      if (out.length) break
      continue
    }
    out.push(isAcronym(raw) ? raw : t)
  }
  while (out.length && ["and", "or", "of", "per"].includes(out[out.length - 1])) out.pop()
  return out.join(" ")
}

/** The object after a verb: skips determiners, numbers and a leading preposition; keeps a short "for …" tail. */
function objectAfter(tokens: string[], start: number): string {
  let i = start
  while (i < tokens.length && (CHUNK_SKIP.has(tokens[i].toLowerCase()) || isNumberish(tokens[i]))) i++
  const out: string[] = []
  for (; i < tokens.length && out.length < 3; i++) {
    const raw = tokens[i]
    const t = raw.toLowerCase()
    if (CHUNK_STOP.has(t) || CHUNK_SKIP.has(t) || (out.length && isVerbish(raw) && !isAcronym(raw))) break
    out.push(isAcronym(raw) ? raw : t)
  }
  if (out.length === 1 && /^(for|of)$/i.test(tokens[i] ?? "")) {
    const tail = tokens.slice(i + 1, i + 3).filter((t) => !CHUNK_STOP.has(t.toLowerCase()))
    if (tail.length) out.push(tokens[i].toLowerCase(), ...tail.map((t) => (isAcronym(t) ? t : t.toLowerCase())))
  }
  return out.join(" ")
}

const QUESTION_START = /^(when|how|what|why|which|where|who|should|is|are|do|does|can|could|would|will|paano|bakit|ano)\b/i
const QUESTION_LEAD = /^(?:when|how|what|why|which|where|who|should|is|are|do|does|can|could|would|will)\b(?:\s+(?:much|long|many|often|to|should|do|does|can|could|would|will|i|you|we|need to|have to|is|are)\b)*\s*/i

/**
 * What a title, question or hook is about, as a short noun phrase:
 * "3 numbers before you touch ad budget" → "ad budget"; "Is boosting posts a waste of money?" → "boosting posts";
 * "Your ads aren't the problem" → "ads"; "Walang sistema, walang scale: the 5 SOPs…" → "SOPs".
 */
export function topicPhrase(text: string): string {
  const base = clean(text).replace(/\([^)]*\)/g, " ").replace(/["“”]/g, "")
  const segments = base
    .split(/\s[—–]\s|:\s|\?\s|(?<=[a-z])\.\s/)
    .map((s) => stripEndPunct(s))
    .filter(Boolean)
  if (!segments.length) return ""
  let seg = segments[0]
  const firstWeight = words(seg).length - (TAGALOG_FUNCTION.test(seg) ? 3 : 0)
  for (const s of segments.slice(1)) if (words(s).length - (TAGALOG_FUNCTION.test(s) ? 3 : 0) >= firstWeight + 3) seg = s
  if (TAGALOG_FUNCTION.test(seg) && segments.length > 1) seg = segments.find((s) => !TAGALOG_FUNCTION.test(s)) ?? seg

  let m = /^(?:your|the|my|our)?\s*(.{2,40}?)\s+(?:is|are|isn't|aren't|was|were)\s+(?:not\s+)?(?:the|a|an)?\s*(?:real\s+)?problem\b/i.exec(seg)
  if (m) return lowerKeepAcronyms(m[1])
  // "Your agency report should fit on one page" → "agency report"; "ROAS is a vanity metric" → "ROAS".
  m = /^(?:your|the|my|our|their)?\s*([a-z0-9₱][\w\s'-]{1,40}?)\s+(?:should|must|can't|cannot|can|will|won't|is|are|isn't|aren't|doesn't|don't|needs?|has to|have to)\b/i.exec(seg)
  if (m) {
    const np = nounChunk(m[1], 4)
    if (np && !isWeakSubject(np) && !QUESTION_START.test(m[1])) return lowerKeepAcronyms(np)
  }
  m = /^(?:stop|start|quit|keep)\s+([a-z]+ing\b(?:\s+[A-Za-z0-9-]+){0,2})/i.exec(seg)
  if (m) return lowerKeepAcronyms(nounChunk(m[1], 3) ? `${m[1].split(" ")[0]} ${nounChunk(m[1].split(" ").slice(1).join(" "), 2)}`.trim() : m[1])

  let s = seg
  if (QUESTION_START.test(s)) s = s.replace(QUESTION_LEAD, "")
  const tokens = s.replace(/[,;!?.]/g, " ").split(/\s+/).filter(Boolean)
  if (!tokens.length) return ""
  if (/^[A-Za-z]+ing$/.test(tokens[0]) && !NOT_GERUNDS.test(tokens[0])) {
    const out = [tokens[0].toLowerCase()]
    for (let i = 1; i < tokens.length && out.length < 3; i++) {
      const t = tokens[i].toLowerCase()
      // The word right after a gerund is its object ("boosting posts"), even when it could be a verb.
      if (CHUNK_STOP.has(t) || CHUNK_SKIP.has(t) || (i > 1 && isVerbish(tokens[i]) && !isAcronym(tokens[i]))) break
      out.push(isAcronym(tokens[i]) ? tokens[i] : t)
    }
    return out.join(" ")
  }
  let lastVerb = -1
  tokens.forEach((t, i) => {
    if (isVerbish(t) && !/ly$/i.test(t) && !isAcronym(t) && i < tokens.length - 1) lastVerb = i
  })
  if (lastVerb >= 0) {
    const obj = objectAfter(tokens, lastVerb + 1)
    if (obj) return obj
  }
  return nounChunk(s, 4) || lowerKeepAcronyms(keywords(s, 2).join(" "))
}

/** Remove audience phrases ("business owners", "founders") so they don't drive pillar or topic matching. */
export function stripAudience(text: string): string {
  return text.replace(new RegExp(`\\b(?:most|many|some|all|every)?\\s*(?:${AUDIENCE_ANY_NOUN})\\b`, "gi"), " ")
}

/* -------------------------------- Analysis --------------------------------- */

export function analyzeTopic(input: string): TopicAnalysis {
  const text = clean(input)
  const sentences = splitSentences(text)
  const firstUseful = sentences.find((s) => words(s).length >= 2) ?? text
  const claim = stripEndPunct(stripLeadIns(firstUseful))
  const claimLower = claim.toLowerCase()

  const audienceMatch = AUDIENCE_QUANTIFIED.exec(claimLower) ?? AUDIENCE_PLURAL.exec(claimLower)
  const audience = cleanAudience(audienceMatch ? audienceMatch[1].trim() : null)

  const contrast = detectContrast(claimLower)
  const actionInfo = detectAction(contrast?.left ?? claimLower, audience)
  const action = actionInfo?.action ?? null
  const object = actionInfo?.object ?? null
  const kws = keywords(text, 8)

  let subject: string
  if (contrast && object && contrast.to.split(" ").length === 1) subject = `${object.split(" ").slice(-1)[0]} ${contrast.to}`
  else if (contrast) subject = `${contrast.to}${object ? ` for ${object}` : ""}`
  else if (object) subject = object
  else if (clean(text).split(" ").length <= 5 && !/[.!?]/.test(text.slice(0, -1))) subject = lowerKeepAcronyms(stripEndPunct(text))
  else subject = topicPhrase(claim) || kws.slice(0, 2).join(" ") || "this"
  subject = subject.replace(/^(?:the|their|your|my|our)\s+/i, "")
  if (isWeakSubject(subject)) {
    const kw = kws.slice(0, 2)
    // "scale ads" (two keywords, verb first) reads better as "scaling ads".
    const kwPhrase = kw.length === 2 && isVerbish(kw[0]) ? gerundPhrase(kw.join(" ")) : kw.join(" ")
    subject = [nounChunk(claim, 3), topicPhrase(claim), kwPhrase].find((s) => !isWeakSubject(s)) ?? subject
  }

  const lower = text.toLowerCase()
  return {
    text,
    claim: upperFirst(claim),
    subject,
    audience,
    contrast: contrast ? { from: contrast.from, to: contrast.to } : null,
    action,
    gerundAction: action ? gerundPhrase(action) : null,
    object,
    keywords: kws,
    tokens: tokenSet(text),
    signals: {
      howTo: /\b(how to|how do|step|steps|guide|tutorial|process|framework|template|checklist|paano)\b/.test(lower),
      story: /\b(i|we|my|our)\b.*\b(was|were|had|did|decided|realized|learned|lost|built|started|quit|fired|hired|called)\b|\b(years? ago|last (week|month|year)|yesterday|kanina|nung)\b/.test(lower),
      mistake: /\b(mistake|wrong|fail|failed|failure|error|burned|lost|regret|mali)\b/.test(lower),
      list: /\b\d+\s+(ways|things|tips|steps|signs|mistakes|lessons|reasons|rules|questions)\b/.test(lower),
      question: /\?\s*$/.test(text) || QUESTION_START.test(text),
      opinion: Boolean(contrast) || /\b(most|nobody|everyone|overrated|underrated|myth|truth|unpopular|stop|never|always)\b/.test(lower),
      offer: /\b(offer|audit|book|dm me|service|consultation|apply|hiring|slots|workshop|discount|promo|launch)\b/.test(lower),
      numbers: /[0-9₱%]/.test(text),
      firstPerson: /\b(i|i'm|i've|my|we|our|ako|namin|ko)\b/.test(lower),
      leadership: /\b(team|hire|hiring|manage|manager|lead|leader|delegate|kpi|kpis|meeting|culture|feedback)\b/.test(lower),
    },
  }
}

/**
 * A Problem Bank entry as a second-person clause:
 * "Relies on one hero product" → "you rely on one hero product"; "Doesn't know X" → "you don't know X".
 */
export function problemClause(problem: string): string {
  // "… and ends up approving" → "… and end up approving" once the subject becomes "you".
  const p = stripEndPunct(clean(problem)).replace(/\b(and|then|but)\s+([a-z]+?)(e?s)\b/gi, (m, joiner: string, stemPart: string, suffix: string) => {
    const base = [stemPart, `${stemPart}e`].find((b) => isVerbish(b) && b.length > 2)
    return base && suffix ? `${joiner} ${base}` : m
  }).replace(/\b(and|but|then)\s+doesn't\b/gi, "$1 don't")
  if (/^(afraid|worried|scared|unsure|stuck|overwhelmed|confused|tired|burned|burnt|behind)\b/i.test(p)) return `you're ${p.charAt(0).toLowerCase()}${p.slice(1)}`
  const m = /^(still\s+)?([A-Za-z']+)(.*)$/.exec(p)
  if (m) {
    const [, still = "", verb, rest] = m
    const v = verb.toLowerCase()
    const restYou = rest.replace(/\btheir\b/gi, "your").replace(/\bthem\b/gi, "you").replace(/\bthey\b/gi, "you")
    if (/^(doesn't|does not)$/.test(v)) return `you ${still}don't${restYou}`
    if (/^(can't|cannot)$/.test(v)) return `you ${still}can't${restYou}`
    if (/^(isn't)$/.test(v)) return `you ${still}aren't${restYou}`
    if (/^(has)$/.test(v)) return `you ${still}have${restYou}`
    if (/^[a-z']+s$/i.test(verb) && isVerbish(verb) && verb[0] === verb[0].toUpperCase()) return `you ${still}${baseVerb(verb)}${restYou}`
  }
  const lowered = isAcronym(p.split(" ")[0] ?? "") ? p : p.charAt(0).toLowerCase() + p.slice(1)
  return lowered.replace(/\btheir\b/gi, "your").replace(/\bthey\b/gi, "you").replace(/\bthem\b/gi, "you")
}

/** A problem clause that reads as a sentence: "you …", or a noun followed by its verb ("ROAS collapses …"). */
export function clauseReads(clause: string | null | undefined): boolean {
  const c = clean(clause ?? "")
  if (!c) return false
  if (/^you('re)?\b/i.test(c)) return true
  const tokens = c.split(" ")
  return tokens.slice(1, 5).some((t) => /^(is|are|was|were|has|have)$/i.test(t) || (/[^s]s$/i.test(t) && isVerbish(t) && !/ly$/i.test(t)))
}

/** "When should I increase my ad budget?" → "When to increase your ad budget". */
export function answerTitle(question: string): string {
  const q = stripEndPunct(clean(question)).replace(/\bmy\b/gi, "your").replace(/\bI'm\b/g, "you're")
  const rules: [RegExp, (m: RegExpExecArray) => string][] = [
    // "My ROAS is 4 but I'm not making money. Why?" → "Why your ROAS is 4 but you're not making money"
    [/^(.+?)[.!]\s*why$/i, (m) => `Why ${m[1]}`],
    [/^when should i (.+)$/i, (m) => `When to ${m[1]}`],
    [/^how do i (.+)$/i, (m) => `How to ${m[1]}`],
    [/^how can i (.+)$/i, (m) => `How to ${m[1]}`],
    [/^how (much|long|many|often) (.+?) (?:should|do) i (.+)$/i, (m) => `How ${m[1]} ${m[2]} you should ${m[3]}`],
    [/^how (much|long|many|often) (.+)$/i, (m) => `How ${m[1]} ${m[2].replace(/\bi\b/gi, "you")}`],
    [/^should i (.+?) or (.+)$/i, (m) => `${upperFirst(m[1])} or ${m[2]}? How to decide`],
    [/^what (.+?) should i (.+)$/i, (m) => `What ${m[1]} to ${m[2]}`],
    [/^which (.+?) (?:should i|do you) (.+)$/i, (m) => `Which ${m[1]} to ${m[2]}`],
    [/^is (.+)$/i, (m) => `Is ${m[1].replace(/\bi\b/gi, "you")}? The honest answer`],
    [/^why (.+)$/i, (m) => `Why ${m[1].replace(/\bi\b/g, "you").replace(/\bI\b/g, "you")}`],
  ]
  for (const [re, fn] of rules) {
    const m = re.exec(q)
    if (m) return fn(m)
  }
  return `${upperFirst(q)}? My honest answer`
}

/** "systems" → "beat", "a system" → "beats". */
export function agreeVerb(subject: string, plural: string, singular: string): string {
  return isPlural(subject.split(" ").slice(-1)[0] ?? "") ? plural : singular
}
