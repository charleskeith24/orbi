/**
 * Experience → content (spec §31): splits a raw experience into STAR parts (situation, problem,
 * action, result, lesson, emotion) using sentence markers in English and Tagalog, so it can be saved
 * to the Story Vault and turned into posts. Only what the creator wrote is used — nothing is invented.
 */
import type { ContextStory } from "../context"
import type { Kit } from "./brand"
import { povLine } from "./scripts"
import { clean, headline, keywords, sentence, splitSentences, stripEndPunct, upperFirst } from "./text"

export interface ExperienceParts {
  /** A headline for the moment ("Our biggest client paused all ads for a month"). */
  title: string
  situation: string
  problem: string
  action: string
  result: string
  lesson: string
  emotion: string
  keywords: string[]
  subject: string
}

const LESSON_RE = /\b(learned|learnt|lesson|realized|realised|taught me|takeaway|moral|now i know|i now believe|what i'd do|natutunan|na-realize|aral)\b/i
const LESSON_LEAD = /^(?:so\s+)?(?:the\s+)?(?:big\s+|real\s+)?(?:lesson|takeaway|moral|what i learned|my takeaway|natutunan ko|ang natutunan ko|ang aral)\s*(?:here|is|was)?\s*[:—–-]\s*/i
const ACTION_RE =
  /\b(i|we)\s+(finally\s+|then\s+|immediately\s+)?(decided|called|built|started|stopped|changed|hired|fired|told|asked|paused|rebuilt|wrote|moved|cut|launched|tested|sat down|set up|created|made|tried|switched|said no|said yes|delegated|documented|scheduled|raised|dropped|killed|rewrote|mapped|offered|refunded|reached out)\b|\b(tinawagan|kinausap|nag-?set up|gumawa|ginawa|sinabi ko|nagdesisyon|nag-?decide|binago|inayos|nagsimula|nag-?offer|nag-?handover)\b/i
const RESULT_RE = /\b(result|ended up|since then|after that|finally|went from|increased|decreased|grew|dropped to|dropped from|saved|closed|hit|reached|doubled|tripled|now we|now i|within|by the end|mula noon|simula noon)\b|[0-9₱%]/i
const PROBLEM_RE =
  /\b(but|problem|issue|struggl\w*|failed|mistake|wrong|lost|couldn't|didn't|wasn't|nobody|late|short|burn\w*|stuck|missed|angry|complain\w*|panick?\w*|scared|worried|afraid|because|kasi|kinabahan|takot|problema|wala)\b/i
const EMOTION_RE = /\b(scared|afraid|nervous|embarrass\w*|ashamed|shame|proud|relieved|relief|angry|frustrat\w*|panick?\w*|guilty|excited|grateful|tired|exhausted|burned out|anxious|kinabahan|takot|hiya|masaya|pagod)\b/i
const TIME_LEAD = /^(?:yesterday|today|this morning|last (?:night|week|month|year)|kanina|kahapon|ngayon|earlier(?: today)?)[,\s]+/i

/** "Yesterday our biggest client called …" → "Our biggest client called …". */
export function stripTimeLead(text: string): string {
  return upperFirst(stripEndPunct(clean(text).replace(TIME_LEAD, "")))
}

export function parseExperience(text: string, kit: Kit): ExperienceParts {
  const sentences = splitSentences(clean(text))
  const used = new Set<number>()
  const take = (re: RegExp, from = 0, many = 1): string => {
    const picked: string[] = []
    sentences.forEach((s, i) => {
      if (i < from || used.has(i) || picked.length >= many || !re.test(s)) return
      used.add(i)
      picked.push(s)
    })
    return picked.join(" ")
  }
  const lessonRaw = take(LESSON_RE)
  const lesson = lessonRaw ? upperFirst(lessonRaw.replace(LESSON_LEAD, "")) : ""
  const action = take(ACTION_RE, 0, 2)
  const firstAction = sentences.findIndex((s, i) => used.has(i) && ACTION_RE.test(s))
  const result = take(RESULT_RE, firstAction >= 0 ? firstAction + 1 : sentences.length)
  let problem = take(PROBLEM_RE)
  let situation = sentences.filter((_, i) => !used.has(i)).slice(0, 2).join(" ")
  // Every sentence carried a marker: the first one still sets the scene.
  if (!situation) {
    situation = problem || sentences[0] || clean(text)
    if (situation === problem) problem = ""
  }
  const emotionWord = EMOTION_RE.exec(text)?.[0]
  const found = kit.subjectFor(text)
  // "…fired a client…" → the topic is "clients" ("3 things I wish I knew about clients"), never a bare "client".
  const pluralize = (w: string) => (/[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(?:ch|sh|x|z)$/.test(w) ? `${w}es` : `${w}s`)
  const subject = /^[a-z]+$/.test(found) && !/s$/.test(found) && new RegExp(`\\b(?:a|an|one)\\s+(?:[a-z]+\\s+)?${found}\\b`, "i").test(text) ? pluralize(found) : found
  const pov = povLine(kit, text)
  const moment = stripEndPunct((sentences[0] ?? "").replace(TIME_LEAD, ""))
  const title =
    result && /[0-9₱%]/.test(result)
      ? upperFirst(headline(result, 11))
      : moment && moment.split(" ").length <= 14
        ? upperFirst(moment)
        : lesson && lesson.split(" ").length <= 12
          ? stripEndPunct(lesson)
          : `What ${subject} taught me`
  return {
    title,
    situation: sentence(situation),
    problem: problem ? sentence(problem) : "",
    action: action ? sentence(action) : "",
    result: result ? sentence(result) : "",
    lesson: lesson ? sentence(lesson) : pov ? sentence(pov) : "",
    emotion: emotionWord ? upperFirst(emotionWord.toLowerCase()) : "",
    keywords: keywords(text, 6),
    subject,
  }
}

/** A Story Vault-shaped view of the parts, for the hook and script writers. */
export function experienceStory(parts: ExperienceParts): ContextStory {
  return {
    id: "",
    title: parts.title,
    type: "experience",
    situation: parts.situation,
    problem: parts.problem,
    action: parts.action,
    result: parts.result,
    lesson: parts.lesson,
    emotion: parts.emotion,
    keywords: parts.keywords,
    pillar_id: null,
    is_favorite: false,
  }
}
