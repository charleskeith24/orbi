/**
 * Offline script writer: fills every section of any SCRIPT_FORMATS structure with concrete copy built
 * from the brief, the current draft, the brand's point of view, phrases, CTA style, Problem Bank and
 * Story Vault. Material is consumed in order so no sentence is repeated across sections, and nothing is
 * left as a bracketed placeholder — the output is shown to the creator verbatim.
 */
import { SCRIPT_FORMATS } from "@/lib/constants"
import type { FunnelStage, PlatformId, ScriptFormat, ScriptSection } from "@/lib/types"
import type { ContextStory } from "../context"
import type { Kit } from "./brand"
import { hookSlots, writeHook } from "./hooks"
import { clean, clip, firstSentence, hashtag, headline, keywords, lowerFirst, sentence, splitSentences, stripEndPunct, tokenSet, uniqueBy, upperFirst } from "./text"
import { agreeVerb, analyzeTopic, problemClause } from "./topic"

export interface ScriptMaterial {
  title: string
  hook: string
  /** The one message, audience-facing. */
  message: string
  /** 3–5 concrete, distinct points (no trailing punctuation). */
  points: string[]
  /** Extra supporting lines (from the current draft or the brief) used for context and insight. */
  notes: string[]
  /** A real Story Vault paragraph, or null. */
  proof: string | null
  takeaway: string
  cta: string
  audience: string
  subject: string
  short: string | null
  story: ContextStory | null
  platform: PlatformId
  /** The audience's problem as a second-person clause ("you don't know your margin per product"). */
  problem: string | null
  contrast: { from: string; to: string } | null
  keywords: string[]
}

const CTA_LINE = /\b(comment|dm|save this|share|follow|book|link in|subscribe|reply|i-save|i-dm|i-follow)\b/i
/** Descriptions written for the team, not the audience ("The saveable version of the TikTok winner"). */
const PRODUCER_NOTE = /\b(version|repurpos\w*|cut-?down|b-roll|voice-?over|batch|record(?:ing)?|film(?:ing)?|shoot|editor|thumbnail|series|episode|the (?:tiktok|facebook|linkedin|youtube|instagram) winner)\b/i

const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9₱%ñ]+/g, " ").trim()

/** Whole sentences up to `max` characters; the first sentence is clipped only when it alone is too long. */
function clipSentences(text: string, max: number): string {
  const out: string[] = []
  for (const s of splitSentences(text)) {
    if (out.join(" ").length + s.length + 1 > max) break
    out.push(s)
  }
  return out.length ? out.join(" ") : clip(text, max)
}

/** Closing lines for a section whose natural content was already said earlier. */
const CLOSERS_EN = ["Simple, not easy — but it works.", "That's the system. The rest is consistency.", "Fix the system and the results follow."]
const CLOSERS_TL = ["Simple lang, pero hindi madali.", "'Yan ang sistema. The rest is consistency.", "Ayusin ang sistema, susunod ang results."]

/** Lines that tell the viewer what to do ("Pick one number…", "I-document mo…") — the only ones that may follow "Try this". */
const ACTIONABLE =
  /^(?:pick|choose|write|set|start|stop|track|test|cut|add|use|ask|build|list|map|block|book|run|review|check|measure|document|post|film|record|batch|schedule|send|call|try|move|drop|price|raise|decide|define|create|plan|share|keep|turn|make|find|give|limit|put|replace|swap|name|open|end|kill|pause|audit|fix|compare|count|label|delegate|hire|say|tell|show|focus|save|look|learn|reply|answer|change|protect|charge|bundle|automate|simplify|separate|split|don't|never|always|pumili|piliin|isulat|ilista|gawin|subukan|simulan|itigil|tanungin|isang bagay lang|i-[a-z]+|mag-[a-z]+)\b/i

/** True when most of `line`'s words were already said in `said` ("Afraid to spend on ads again…" right after "If you're afraid to spend on ads again…"). */
function repeats(said: string, line: string): boolean {
  const heard = tokenSet(said)
  const tokens = Array.from(tokenSet(line))
  return tokens.length > 0 && tokens.filter((t) => heard.has(t)).length / tokens.length >= 0.7
}

/** A slide-sized line that never stops mid-phrase: the first clause when it's short, else the sentence, else a clipped sentence. */
function slideLine(text: string): string {
  const first = stripEndPunct(firstSentence(text) || text)
  const clause = (first.split(/,\s|:\s|;\s|\s[—–]\s/)[0] ?? first).trim()
  const count = (value: string) => value.split(/\s+/).filter(Boolean).length
  if (count(clause) >= 3 && count(clause) <= 12) return clause
  return count(first) <= 14 ? first : clip(first, 80)
}

/** A point-of-view line from Brand HQ that clearly matches the topic, e.g. "Systems beat inspiration." */
/** Ordinals and time words ("first", "30 days") say nothing about what a line is about. */
const TIME_WORDS = new Set("first second third last next one two three four five day days week weeks month months year years time times today".split(" "))
const contentTokens = (text: string) => new Set(Array.from(tokenSet(text)).filter((t) => !TIME_WORDS.has(t) && !/^\d/.test(t)))

export function povLine(kit: Kit, text: string): string | null {
  const q = contentTokens(text)
  const lines = splitSentences(kit.ctx.brand.point_of_view)
  const ranked = lines
    .map((l) => {
      const t = contentTokens(l)
      let shared = 0
      for (const x of q) if (t.has(x)) shared++
      return { l, shared, score: kit.score(q, t) }
    })
    .sort((a, b) => b.score - a.score)
  // Two shared words at least — one common word ("work") is not a match.
  return ranked[0] && ranked[0].shared >= 2 && ranked[0].score >= 2.5 ? ranked[0].l : null
}

/** A few frequent problem clauses in Tagalog ("you don't know X" → "hindi mo alam ang X"); null when there's no natural form. */
function tagalogClause(clause: string): string | null {
  let m = /^you don't know (.+)$/i.exec(clause)
  if (m) return `hindi mo alam ang ${m[1]}`
  m = /^you (?:still )?don't have (.+)$/i.exec(clause)
  if (m) return `wala ka pang ${m[1]}`
  return null
}

/** "If you don't know X, this is for you." / "Kung hindi mo alam ang X, para sa'yo 'to." — English condition when there's no natural Tagalog form. */
function ifLine(kit: Kit, clause: string, enTail: string, tlTail: string): string {
  if (kit.lang === "english") return `If ${clause}, ${enTail}`
  const tl = tagalogClause(clause)
  return tl ? `Kung ${tl}, ${tlTail}` : `If ${clause}, ${tlTail}`
}

export function storyParagraph(story: ContextStory, max = 420): string {
  const parts = [story.situation, story.problem, story.action, story.result].map((p) => clean(p)).filter(Boolean)
  if (!parts.length) return clip(`${stripEndPunct(story.title)}. ${story.lesson}`, max)
  return clip(parts.join(" "), max)
}

/** "you don't know your margin per product, so a 'good' ROAS can still lose money" → "you don't know your margin per product". */
function problemHead(clause: string): string {
  return stripEndPunct(clause.split(/,\s*(?:so|then|and then|because|which)\b|\s[—–]\s|:\s/)[0] ?? clause)
}

function numbered(points: string[], style: "dot" | "slash" = "dot"): string {
  return points.map((p, i) => (style === "slash" ? `${i + 1}/ ${sentence(p)}` : `${i + 1}. ${sentence(p)}`)).join(style === "slash" ? "\n\n" : "\n")
}

/** Points and supporting lines pulled out of an existing script body. */
function fromScript(body: string, hook: string): { points: string[]; notes: string[] } {
  const lines = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
  const listPattern = /^\s*(\d+[.)/]|[-•*])\s+/
  const points = lines.filter((l) => listPattern.test(l)).map((l) => stripEndPunct(l.replace(listPattern, "")))
  const hookKey = norm(hook)
  const notes = lines
    .filter((l) => !listPattern.test(l))
    .flatMap((l) => splitSentences(l))
    .map((s) => stripEndPunct(s))
    .filter((s) => s.split(" ").length >= 4 && !CTA_LINE.test(s) && norm(s) !== hookKey && !hookKey.includes(norm(s)))
  return points.length >= 2 ? { points, notes } : { points: notes.slice(1, 5), notes: notes.slice(0, 1) }
}

function fallbackPoints(subject: string, kit: Kit): string[] {
  return [
    kit.say(
      `Pick the one number that tells you whether ${subject} is working — and check it every week`,
      `Pumili ng isang number na magsasabi kung gumagana ang ${subject} — at i-check 'yan every week`
    ),
    kit.say(`Change one thing at a time so you know what actually moved the result`, `Isang bagay lang ang babaguhin mo each time para alam mo kung ano talaga ang gumana`),
    kit.say(
      `Write down what worked, so next month starts from a system instead of from scratch`,
      `I-document mo ang gumana para next month, may sistema ka na — hindi ka nagsisimula ulit sa zero`
    ),
  ]
}

/** Concrete points from the workspace when the brief has none: the contrast, related problems, the story. */
function derivedPoints(subject: string, m: { contrast: ScriptMaterial["contrast"]; story: ContextStory | null; text: string; problem: string | null }, kit: Kit): string[] {
  const out: string[] = []
  if (m.contrast) {
    out.push(
      `Why ${m.contrast.from} feels like it works — and exactly where it breaks`,
      `What ${m.contrast.to} ${agreeVerb(m.contrast.to, "look", "looks")} like in practice: one owner, one routine, one number to watch`
    )
  }
  const problems = kit.problemsFor(m.text, 3).filter((p) => !m.problem || norm(problemClause(p.problem)) !== norm(m.problem))
  for (const p of problems.slice(0, 2)) {
    out.push(ifLine(kit, problemHead(problemClause(p.problem)), "fix that first", "'yan muna ang ayusin mo"))
  }
  if (m.story?.action) out.push(`What we did: ${lowerFirst(stripEndPunct(firstSentence(m.story.action)))}`)
  for (const p of fallbackPoints(subject, kit)) if (out.length < 3) out.push(p)
  return out.slice(0, 5)
}

/** Normalise brief/idea/draft fields into writing material. */
export function materialFrom(
  input: {
    title: string
    hook?: string
    message?: string
    points?: string[]
    cta?: string
    takeaway?: string
    platform: PlatformId
    story?: ContextStory | null
    problem?: string | null
    text?: string
    funnel?: FunnelStage
    /** The current draft (script body), when rewriting an existing piece. */
    script?: string
    /** The topic phrase, when the caller already knows it better than the title does. */
    subject?: string
  },
  kit: Kit
): ScriptMaterial {
  const draft = input.script?.trim() ? fromScript(input.script, input.hook ?? "") : { points: [], notes: [] }
  const all = [input.title, input.message, ...(input.points ?? []), ...draft.points, input.text].filter(Boolean).join(". ")
  const topic = analyzeTopic(`${input.message || input.title}. ${input.text ?? ""}`)
  const subject = input.subject?.trim() || kit.subjectFor(input.title, { context: all })
  // Stories are matched on what the piece is about (title, message, main points) — never on a long draft body.
  const story = input.story === undefined ? kit.storyFor(`${input.title}. ${input.message ?? ""} ${(input.points ?? []).slice(0, 3).join(". ")}`, { minHits: 2 }) : input.story
  const audience = topic.audience ?? kit.audience
  const problem = input.problem ? stripEndPunct(/^you\b/i.test(input.problem) ? input.problem : problemClause(input.problem)) : null
  const given = [...(input.points ?? []), ...draft.points].map((p) => stripEndPunct(clean(p))).filter(Boolean)
  // Related problems are looked up on what the piece is about, not on every word of the brief.
  const focus = `${input.title}. ${input.message ?? ""} ${subject}`
  const points = uniqueBy(given.length ? given : derivedPoints(subject, { contrast: topic.contrast, story, text: focus, problem }, kit), norm).slice(0, 5)
  const hook =
    input.hook?.trim() ||
    writeHook(kit.hookCategories()[0] ?? "curiosity", hookSlots(topic, kit, { story, problem: input.problem ?? null, subject }), kit).text
  const message = input.message?.trim() && !PRODUCER_NOTE.test(input.message) ? sentence(input.message) : draft.notes[0] ? sentence(draft.notes[0]) : sentence(topic.claim || input.title)
  const takeaway =
    input.takeaway?.trim() ||
    (story?.lesson ? sentence(story.lesson) : null) ||
    povLine(kit, all) ||
    (topic.contrast ? sentence(`${upperFirst(topic.contrast.to)} ${agreeVerb(topic.contrast.to, "beat", "beats")} ${topic.contrast.from}`) : null) ||
    kit.rotate("takeaway", [
      kit.say("The system matters more than the tactic.", "Mas mahalaga ang sistema kaysa sa tactic."),
      kit.say(`Get ${subject} right once and it keeps paying you back.`, `Ayusin mo ang ${subject} once, at babalik 'yan sa'yo nang paulit-ulit.`),
      kit.say("Measure it every week, or you're guessing.", "I-measure mo every week — kung hindi, nanghuhula ka lang."),
    ])
  return {
    title: input.title,
    hook: sentence(hook),
    message,
    points,
    notes: draft.notes.filter((n) => norm(sentence(n)) !== norm(message)).slice(0, 3),
    proof: story ? storyParagraph(story) : null,
    takeaway,
    cta: input.cta?.trim() || kit.cta({ funnel: input.funnel ?? kit.funnelFor(all), platform: input.platform, topic: subject }),
    audience,
    subject,
    short: kit.shortSubject(subject),
    story: story ?? null,
    platform: input.platform,
    problem,
    contrast: topic.contrast,
    keywords: keywords(`${input.title} ${input.hook ?? ""}`, 6),
  }
}

export function hashtagsFor(m: ScriptMaterial, kit: Kit, count = 5): string[] {
  const pool = [m.short ?? m.subject, ...kit.lexiconTerms(`${m.title} ${m.hook}`, 3), ...kit.ctx.brand.expertise_areas.slice(0, 3), kit.industry]
  return uniqueBy(
    pool.map(hashtag).filter((h) => h.length > 3 && h.length <= 24),
    (h) => h
  ).slice(0, count)
}

function visualDirection(platform: PlatformId): string {
  switch (platform) {
    case "tiktok":
    case "instagram":
      return "Vertical 9:16, talking head at eye level in natural light. Punch in on the hook line, cut every 2–3 seconds, captions burned in."
    case "youtube":
      return "16:9, seated talking head with a clean background; screen shares for anything with numbers; chapter cards between segments."
    case "linkedin":
      return "Square 1:1 or 4:5, calm setting, captions on; keep it text-first if posting a document."
    default:
      return "Vertical or square, natural light, captions on; show the real work (screens, notebooks, whiteboard) instead of stock footage."
  }
}

const ORDINALS_EN = ["First", "Second", "Third", "Fourth", "Fifth"]
const ORDINALS_TL = ["Una", "Pangalawa", "Pangatlo", "Pang-apat", "Panlima"]

/** Writes sections in order, never repeating a sentence another section already used. */
function makeWriter(m: ScriptMaterial, kit: Kit) {
  const used = new Set<string>()
  const pool = [...m.points]
  const nextPoint = () => pool.shift() ?? null
  const mark = (text: string) => {
    for (const s of splitSentences(text)) used.add(norm(s))
    return text
  }
  const fresh = (text: string) =>
    text
      .split("\n")
      .map((line) =>
        splitSentences(line)
          .filter((s) => !used.has(norm(s)))
          .join(" ")
      )
      .filter((line, i, all) => line.trim() || (i > 0 && all[i - 1].trim()))
      .join("\n")
      .trim()
  const isUsed = (text: string) => splitSentences(text).every((s) => used.has(norm(s)))
  const closer = () => kit.rotate("closer", kit.lang === "english" ? CLOSERS_EN : CLOSERS_TL)
  const say = kit.say
  const example = () => {
    // The takeaway has its own section — an example that ends on it would leave that section a generic closer.
    const proof = m.proof ? splitSentences(m.proof).filter((line) => !repeats(m.takeaway, line)).join(" ") : ""
    if (proof && !(m.story && stripEndPunct(proof) === stripEndPunct(m.story.title))) return proof
    // A story's example is its moment and its (numbered) result.
    const s = m.story
    if (s?.situation && s.result) return `${firstSentence(s.situation)} ${splitSentences(s.result).find((line) => /[0-9₱%]/.test(line)) ?? firstSentence(s.result)}`.trim()
    return say(
      `Quick example: ${m.problem ? `if ${problemHead(m.problem)}, ` : ""}start with the first step this week and see what changes after seven days.`,
      `Example: ${m.problem ? `if ${problemHead(m.problem)}, ` : ""}simulan mo sa unang step this week, tapos tingnan mo kung ano ang nagbago after seven days.`
    )
  }
  const problemLine = () => (m.problem ? ifLine(kit, problemHead(m.problem), "this is for you.", "para sa'yo 'to.") : "")

  function content(key: string, format: ScriptFormat): string {
    const s = m.story
    const firstName = kit.firstName || "I"
    const phrase = kit.phrase(`${m.subject} ${m.takeaway}`)
    switch (key) {
      case "hook":
        return m.hook
      case "slide_1":
        return clip(stripEndPunct(m.hook), 90)
      case "frame_1":
        return clip(stripEndPunct(m.hook), 80)
      case "subject":
        return clip(stripEndPunct(m.title.replace(/\s[—–-]\s(?:the )?(?:carousel|thread|reel|short|video|newsletter)$/i, "")), 60)
      case "title":
        return m.title
      case "cold_open":
        return `“${stripEndPunct(m.takeaway)}.” ${say("That's the line I want you to remember from this episode.", "'Yan ang gusto kong tandaan mo from this episode.")}`
      case "context":
        if (format === "short_video") {
          // Never restate the problem line as a fragment right after it.
          const line = problemLine()
          return line && repeats(line, m.message) ? line : `${line} ${m.message}`.trim()
        }
        return s?.situation ? `${firstSentence(s.situation)} ${s.problem ? firstSentence(s.problem) : ""}`.trim() : m.notes[0] ? sentence(m.notes[0]) : m.message
      case "intro": {
        const role = kit.ctx.brand.role ? `, ${kit.ctx.brand.role}` : ""
        const why = kit.ctx.brand.why_listen ? ` ${clip(firstSentence(kit.ctx.brand.why_listen), 160)}` : ""
        if (format === "blog") return `${problemLine() || m.message} ${say("In this post:", "Sa post na 'to:")} ${m.points.map((p) => lowerFirst(p)).join("; ")}.`
        if (format === "podcast_outline") return `${m.message}${problemLine() ? ` ${say("Why now:", "Bakit ngayon:")} ${lowerFirst(problemLine())}` : ""}`
        return `I'm ${firstName}${role}.${why} ${say("In this video:", "Sa video na 'to:")} ${lowerFirst(m.message)}`
      }
      case "opening":
        return s?.situation ? clip(s.situation, 280) : `${say("Quick one this week.", "Quick one lang this week.")} ${m.notes[0] ? sentence(m.notes[0]) : m.message}`
      case "story":
        return s ? storyParagraph(s) : `${m.message} ${m.problem ? `${say("Sound familiar?", "Relate ka ba?")} ${upperFirst(problemHead(m.problem))}.` : m.notes[0] ? sentence(m.notes[0]) : ""}`.trim()
      case "slide_2":
      case "frame_2":
        return clip(
          m.problem ? upperFirst(problemHead(m.problem)) : s?.problem ? firstSentence(s.problem) : m.notes[0] ?? (m.short ? `Most ${m.audience} get ${m.short} wrong.` : m.message),
          110
        )
      case "value": {
        const ordinals = kit.lang === "english" ? ORDINALS_EN : ORDINALS_TL
        const pts: string[] = []
        for (let p = nextPoint(); p; p = pts.length < 5 ? nextPoint() : null) pts.push(p)
        return pts.map((p, i) => `${ordinals[i] ?? "Next"}, ${lowerFirst(sentence(p))}`).join(" ")
      }
      case "insight":
        if (format === "facebook_post" || format === "newsletter") {
          const extra = m.notes[1] ?? nextPoint()
          const lead = isUsed(m.takeaway) ? "" : `${say("Here's what I realized:", "Ito ang na-realize ko:")} ${lowerFirst(m.takeaway)}`
          // The takeaway counts as said, even behind a lead-in, so later sections don't repeat it.
          if (lead) mark(m.takeaway)
          return `${lead}${extra && !isUsed(extra) ? ` ${sentence(extra)}` : ""}`.trim()
        }
        if (format === "linkedin_post") return m.notes[1] ? sentence(m.notes[1]) : m.takeaway
        return sentence(nextPoint() ?? m.takeaway)
      case "slide_3":
        return clip(m.takeaway, 110)
      case "slide_4":
        return clip(sentence(nextPoint() ?? m.takeaway), 120)
      case "framework": {
        const rest = pool.splice(0)
        return numbered(rest.length ? rest : m.points)
      }
      case "slide_6":
        return m.points.slice(0, 5).map((p, i) => `${i + 1}. ${slideLine(p.replace(/^step \d+:\s*/i, ""))}`).join("\n")
      case "lesson": {
        const last = pool.pop() ?? m.points[m.points.length - 1]
        const lead = isUsed(m.takeaway) ? "" : m.takeaway
        // "Try this this week:" only in front of something the viewer can do — never a story beat or an outline note.
        const tryLine = last && ACTIONABLE.test(last.trim()) ? ` ${say("Try this this week:", "Try mo 'to this week:")} ${lowerFirst(sentence(last))}` : ""
        const body = `${lead}${phrase ? ` ${sentence(phrase)}` : ""}${tryLine}`.trim()
        return body || (s?.lesson && !isUsed(s.lesson) ? sentence(s.lesson) : "")
      }
      case "body": {
        // The proof is the result line with a number in it ("hit 2.8 ROAS within six weeks"), not "She stayed."
        const proof = s?.result ? (splitSentences(s.result).find((line) => /[0-9₱%]/.test(line)) ?? firstSentence(s.result)) : ""
        if (format === "x_thread") return numbered([...m.points, proof ? `Proof: ${proof}` : "", m.takeaway].filter(Boolean), "slash")
        if (format === "threads_post") return `${sentence(m.points[0] ?? m.message)} ${m.takeaway}`
        if (format === "custom") return [m.hook, m.message, numbered(m.points), m.takeaway, m.cta].join("\n\n")
        return [m.message, ...m.points.map((p) => sentence(p)), m.takeaway].join("\n\n")
      }
      case "sections":
        return m.points
          .map((p, i) => {
            const support = i === 1 && s ? `- Example: ${clip(storyParagraph(s), 200)}` : `- ${say("Why it matters:", "Bakit mahalaga:")} ${i === 0 && m.problem ? upperFirst(problemHead(m.problem)) : lowerFirst(m.takeaway)}`
            return `## ${upperFirst(headline(p, 9))}\n- ${sentence(p)}\n${support}`
          })
          .join("\n\n")
      case "segments":
        return m.points.map((p, i) => `${say("Segment", "Segment")} ${i + 1} — ${sentence(p)}${i === 1 && s ? ` ${say("Story:", "Kuwento:")} ${stripEndPunct(s.title)}.` : ""}`).join("\n")
      case "segment_1":
      case "segment_2":
      case "segment_3": {
        const i = Number(key.slice(-1)) - 1
        const point = m.points[i] ?? m.points[m.points.length - 1] ?? m.subject
        const extra = i === 1 ? ` ${say("Example:", "Example:")} ${clip(example(), 260)}` : ""
        return `${sentence(point)}${extra}`
      }
      case "talking_points":
        return m.points.map((p) => `- ${sentence(p)}`).join("\n")
      case "example":
        return clipSentences(fresh(example()) || example(), 320)
      case "slide_5":
        return clipSentences(fresh(s?.result || m.proof || sentence(nextPoint() ?? m.takeaway)) || m.takeaway, 160)
      case "takeaway":
        return m.takeaway
      case "conclusion":
        return isUsed(m.takeaway) ? (phrase ? sentence(phrase) : closer()) : `${m.takeaway}${phrase ? ` ${sentence(phrase)}` : ""}`
      case "recap":
        return `${say("Recap:", "Recap:")} ${m.points.map((p, i) => `${i + 1}) ${headline(p, 8)}`).join(" · ")}. ${m.takeaway}`
      case "takeaways":
        return m.points.map((p) => `- ${sentence(p)}`).join("\n")
      case "cta":
        return m.cta
      case "slide_7":
        return /save/i.test(m.cta) ? m.cta : `${say("Save this.", "I-save mo 'to.")} ${m.cta}`
      case "frame_4":
        return m.contrast
          ? `${say("Poll: “Which one are you?”", "Poll: “Alin ka dito?”")} — ${upperFirst(m.contrast.from)} / ${upperFirst(m.contrast.to)}`
          : say(`Question sticker: “What's your biggest struggle with ${m.short ?? m.subject}?”`, `Question sticker: “Ano ang pinakamahirap sa'yo pagdating sa ${m.short ?? m.subject}?”`)
      case "frame_3":
        return clip(sentence(nextPoint() ?? m.takeaway), 100)
      case "frame_5":
        return m.cta
      case "b_roll":
        return [
          `- Screen recording of the dashboard, sheet or doc you actually use for ${m.short ?? m.subject}`,
          `- Hands writing the ${m.points.length} steps on a whiteboard or in a notebook`,
          s ? `- A cutaway that sets the scene for “${stripEndPunct(s.title)}”` : "- Over-the-shoulder shot of the work in progress",
          `- Close-up on the key line: “${headline(m.takeaway, 10)}”`,
        ].join("\n")
      case "visual_direction":
        return visualDirection(m.platform)
      case "on_screen_text":
        return uniqueBy([headline(m.hook, 8), ...m.points.map((p) => headline(p, 6)), headline(m.takeaway, 8)], norm)
          .map((t) => `- ${t}`)
          .join("\n")
      case "hashtags":
        return hashtagsFor(m, kit).join(" ")
      default:
        return sentence(nextPoint() ?? m.message)
    }
  }

  return {
    section(key: string, format: ScriptFormat): string {
      const raw = content(key, format).trim()
      // Lists, CTAs and hooks are allowed to echo; prose sections never repeat an earlier sentence.
      if (["hook", "slide_1", "frame_1", "cta", "slide_7", "frame_5", "hashtags", "title", "subject", "framework", "slide_6", "talking_points", "takeaways", "on_screen_text", "b_roll", "visual_direction", "recap"].includes(key)) return mark(raw)
      const deduped = fresh(raw)
      if (deduped) return mark(deduped)
      // Everything this section would say was said already: close with something new instead of repeating it.
      if (["insight", "conclusion", "lesson", "takeaway", "slide_3"].includes(key)) {
        const p = kit.phrase(`${m.subject} ${m.takeaway}`)
        return mark(p && !isUsed(p) ? sentence(p) : closer())
      }
      const next = nextPoint()
      return mark(next ? sentence(next) : raw)
    },
  }
}

export function buildSections(format: ScriptFormat, m: ScriptMaterial, kit: Kit): ScriptSection[] {
  const spec = SCRIPT_FORMATS[format] ?? SCRIPT_FORMATS.custom
  const writer = makeWriter(m, kit)
  return spec.sections.map((s) => ({ key: s.key, label: s.label, content: kit.scrub(writer.section(s.key, format)) }))
}

export function captionFor(m: ScriptMaterial, format: ScriptFormat, kit: Kit): string {
  if (format === "short_video" || format === "long_video" || format === "video_brief" || format === "story_sequence") {
    return kit.scrub(`${stripEndPunct(m.hook)}.\n\n${m.takeaway}\n\n${m.cta}`)
  }
  if (format === "carousel") return kit.scrub(`${stripEndPunct(m.hook)} — ${lowerFirst(m.takeaway)}\n\n${m.cta}`)
  return kit.scrub(clip(`${m.hook} ${m.takeaway}`, 220))
}
