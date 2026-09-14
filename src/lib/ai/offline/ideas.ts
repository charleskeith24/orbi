/**
 * Offline Idea Generator: turns the brand's own material — Problem Bank, Question Bank, pillar
 * examples, Story Vault, winners, expertise and offers — into distinct ideas. Titles are shaped to the
 * material (a "you still approve every ad" problem reads differently from "ROAS collapses when …"),
 * talking points carry real story facts, related problems and questions, and "why it matters" cites
 * the workspace numbers.
 */
import { FUNNEL_STAGES } from "@/lib/constants"
import type { FunnelStage, GoalCategory, HookCategory, PlatformId } from "@/lib/types"
import type { BrandContext, ContextStory } from "../context"
import { audienceFromPersona, exampleTopic, nicheTopic, type Kit } from "./brand"
import { hookSlots, writeHook } from "./hooks"
import { nicheInterests } from "./niche"
import { povLine } from "./scripts"
import { clip, firstSentence, gerund, gerundPhrase, headline, jaccard, lowerFirst, stripEndPunct, tokenSet, uniqueBy, upperFirst } from "./text"
import { agreeVerb, analyzeTopic, answerTitle, clauseReads, isVerbish, isWeakSubject, nounChunk, problemClause } from "./topic"

export interface IdeaRequest {
  count: number
  pillarId?: string | null
  personaId?: string | null
  platform?: PlatformId | null
  goalCategory?: GoalCategory | null
  topic?: string | null
  funnel?: FunnelStage | null
  /** Angle name (e.g. "Framework"). */
  angle?: string | null
  formatId?: string | null
  problemId?: string | null
  avoidTitles?: string[]
}

export interface OfflineIdea {
  title: string
  core_idea: string
  why_it_matters: string
  hook: string
  hook_category: HookCategory
  format: string
  angle: string
  talking_points: string[]
  cta: string
  platform: PlatformId
  funnel_stage: FunnelStage
  pillar_id: string | null
  persona_id: string | null
  problem_id: string | null
}

type SeedKind = "problem" | "question" | "example" | "story" | "winner" | "topic" | "offer"

interface Seed {
  kind: SeedKind
  index: number
  text: string
  /** Clean topic phrase ("contribution margin per product"). */
  subject: string
  /** Compact form for "the ___ mistake" titles, or null. */
  short: string | null
  pillarId: string | null
  personaId: string | null
  problemId: string | null
  severity: number
  frequency: number
  story: ContextStory | null
  winnerRatio: number | null
}

const ANGLES_BY_KIND: Record<SeedKind, string[]> = {
  problem: ["Problem", "Mistake", "Framework", "Tutorial", "Checklist"],
  question: ["Tutorial", "Opinion", "Framework", "Checklist"],
  example: ["Tutorial", "Framework", "Checklist", "Mistake", "Behind the Scenes"],
  story: ["Story", "Lesson", "Failure", "Transformation"],
  winner: ["Lesson", "Contrarian", "Case Study", "Before vs After"],
  topic: ["Mistake", "Framework", "Contrarian", "Story", "Checklist", "Myth", "Tutorial", "Lesson", "Prediction", "Comparison", "Question", "Behind the Scenes"],
  offer: ["Case Study", "Checklist", "Behind the Scenes"],
}

const GOAL_ANGLES: Partial<Record<GoalCategory, string[]>> = {
  awareness: ["Contrarian", "Myth", "Story", "Mistake"],
  authority: ["Framework", "Case Study", "Tutorial", "Checklist", "Opinion"],
  community: ["Question", "Story", "Behind the Scenes", "Opinion"],
  leads: ["Case Study", "Checklist", "Framework", "Tutorial"],
  business: ["Case Study", "Behind the Scenes", "Checklist"],
}

/** Pillar examples get angles that suit the pillar ("beliefs about work" is a lesson, not a tutorial). */
const EXAMPLE_ANGLES: Record<string, string[]> = {
  education: ["Tutorial", "Framework", "Checklist", "Mistake"],
  leadership: ["Framework", "Mistake", "Checklist", "Behind the Scenes"],
  authority: ["Opinion", "Contrarian", "Mistake", "Framework"],
  journey: ["Lesson", "Behind the Scenes", "Opinion"],
  personal: ["Lesson", "Opinion", "Behind the Scenes"],
  business: ["Case Study", "Checklist", "Behind the Scenes"],
}

/** Goal categories each funnel stage genuinely serves. */
const FUNNEL_GOALS: Record<FunnelStage, GoalCategory[]> = {
  tofu: ["awareness", "community"],
  mofu: ["authority", "community"],
  bofu: ["leads", "business"],
}

const SERIES_LIKE = /\b(episodes?|reflections?|diary|series|announcements?|invitations?|posts?|offers?|breakdown)\b/i

const DELIVERABLE: Record<string, string> = {
  problem: "the real cause and the first fix to try this week",
  mistake: "the one mistake behind it and exactly what to do instead",
  framework: "a simple framework they can apply this week",
  tutorial: "the exact steps, with a real example",
  checklist: "a checklist they can run on their own business today",
  contrarian: "a sharper, honest way to think about it",
  myth: "the myth, why it breaks, and what to believe instead",
  opinion: "a clear opinion and the reasoning behind it",
  story: "the story, what was at stake and the lesson",
  lesson: "the lesson and how to apply it this week",
  failure: "what went wrong, what it cost and what changed",
  transformation: "the before, the messy middle and the after",
  "case study": "a real before-and-after with the numbers",
  comparison: "a clear call on which option fits whom",
  prediction: "what's changing and what to do about it now",
  "behind the scenes": "an honest look at how the work actually happens",
  question: "an honest answer and a rule of thumb",
  "before vs after": "the side-by-side and what made the difference",
}

function stripQuotes(text: string): string {
  return stripEndPunct(text.replace(/^["“']|["”']$/g, "").replace(/["“”]/g, ""))
}

/** "you don't know X, so Y" → "you don't know X". */
function clauseHead(clause: string): string {
  return stripEndPunct(clause.split(/,\s*(?:so|then|and then|because|which)\b|\s[—–]\s|:\s/)[0] ?? clause)
}

/** Gerund version of a "you …" clause: "you still approve every ad" → "still approving every ad". */
function youGerund(clause: string): { gerund: string; negative: boolean; feeling: boolean } | null {
  // "you're afraid to spend on ads again" → "spending on ads again"; "you feel guilty delegating" → "delegating".
  const feeling =
    /^you(?:'re|’re| are)\s+(?:afraid|scared|worried|unsure|stuck|overwhelmed|tired|nervous|hesitant|guilty)\s+(?:to|of|about|by|from|whether to|when)\s+(.+)$/i.exec(clause) ??
    /^you\s+(?:still\s+)?(?:feel|get)\s+(?:guilty|bad|nervous|anxious|awkward|scared|afraid)\s+(?:about\s+|when\s+)?(\w+ing\b.*)$/i.exec(clause)
  if (feeling) return { gerund: gerundPhrase(feeling[1]), negative: false, feeling: true }
  const m = /^you\s+(still\s+)?(don't|can't|aren't)?\s*(.+)$/i.exec(clause)
  if (!m) return null
  const [, still = "", neg, rest] = m
  const phrase = gerundPhrase(rest).replace(/\b(and|then)\s+([a-z]+)\b/g, (full, joiner: string, verb: string) =>
    isVerbish(verb) && !/(ing|ly|ed)$/.test(verb) ? `${joiner} ${gerund(verb)}` : full
  )
  return { gerund: `${still}${phrase}`, negative: Boolean(neg), feeling: false }
}

/** "spending on ads again" → "spending on ads" — time words never end a topic. */
const trimEdgeWords = (phrase: string) => phrase.replace(/(?:\s+(?:again|too|now|anymore|yet|already|still|today|anyway))+$/i, "")

/** Where a noun-phrase problem stops being a topic: "Cash tied up in inventory | right before a big sale". */
const TIME_CLAUSE = /\s+(?:right before|just before|before|after|when|while|because|since|until|every time|whenever)\s+/i

/**
 * What a Problem Bank entry is about, as a topic: "Underprices cakes and works for free" → "underpricing cakes";
 * "Doesn't know how to get orders outside friends and family" → "getting orders outside friends and family".
 */
export function problemSubject(text: string, kit: Kit): string {
  const you = youGerund(clauseHead(problemClause(text)))
  if (you) {
    let phrase = you.gerund.replace(/^still\s+/, "")
    if (you.negative) phrase = phrase.replace(/^knowing\s+how\s+to\s+([a-z]+)/, (_, verb: string) => gerund(verb)).replace(/^knowing\s+/, "")
    // "deciding between an agency and in-house" is one topic — the brand lexicon names it better than a cut clause.
    if (/^(?:deciding|choosing|picking)\s+between\b/.test(phrase)) return kit.subjectFor(text, { fallback: [phrase] })
    const head = phrase.split(/\s+(?:and|but|then|so|because|instead of|before|after|when|while|every time|without)\b/)[0]
    const topic = trimEdgeWords(head.split(" ").slice(0, 6).join(" "))
    if (!isWeakSubject(topic)) return kit.display(topic)
  } else {
    // A noun-phrase problem is its own topic up to the first time clause.
    const lead = stripEndPunct(text.split(TIME_CLAUSE)[0] ?? "")
    if (lead && lead.split(/\s+/).length <= 6 && !/^(?:no|not|never|can't|doesn't|don't|won't)\b/i.test(lead) && !isWeakSubject(lead)) return kit.display(/^[A-Z][a-z]/.test(lead) ? lowerFirst(lead) : lead)
  }
  return kit.subjectFor(text, { fallback: [nounChunk(text, 3)] })
}

/** "When to increase your ad budget? My honest answer" → "When to increase your ad budget". */
function plainAnswer(answer: string): string {
  return stripEndPunct(answer.replace(/\?\s*(?:my|the) honest answer$/i, ""))
}

function titleFor(seed: Seed, angle: string, kit: Kit, n: number): string | null {
  const a = angle.toLowerCase()
  const t = seed.subject
  const short = seed.short
  const aud = kit.audience
  const brand = kit.ctx.brand.brand_name
  switch (seed.kind) {
    case "problem": {
      const clause = clauseHead(problemClause(seed.text))
      const you = youGerund(clause)
      // Cut at the first time clause so a title never ends mid-phrase ("…right before a big").
      const head = headline(seed.text.split(TIME_CLAUSE)[0] ?? seed.text, 9)
      if (you?.feeling) {
        // Keep the feeling — "Afraid to spend on ads again…?" is the problem; "spending on ads" alone isn't.
        const felt = clause
          .replace(/^you(?:'re|’re| are)\s+/i, "being ")
          .replace(/^you\s+(?:still\s+)?(feel|get)\b/i, (_, verb: string) => (verb.toLowerCase() === "feel" ? "feeling" : "getting"))
          .split(/\s+and\s+/)[0]
        const bare = clause.replace(/^you(?:'re|’re| are)?\s+/i, "")
        if (a === "problem") return `${upperFirst(bare)}? Here's the real problem`
        if (a === "mistake") return `The hidden cost of ${felt}`
        if (a === "framework") return `A simple framework for when ${clause}`
        if (a === "tutorial") return `How to stop ${felt}`
        if (a === "checklist") return `${n} signs ${clause}`
      }
      if (you && !you.negative) {
        const bare = you.gerund.replace(/^still\s+/, "")
        if (a === "problem") return `${upperFirst(you.gerund)}? Here's the real problem`
        if (a === "mistake") return `The hidden cost of ${you.gerund}`
        if (a === "framework") return `A simple framework to stop ${bare}`
        if (a === "tutorial") return `How to stop ${bare}`
        if (a === "checklist") return `${n} signs you're still ${bare}`
      }
      if (you?.negative) {
        if (a === "problem" || a === "mistake") return `The hidden cost of not ${you.gerund}`
        if (a === "framework" || a === "tutorial") return `How to get ${short ?? t} right`
        if (a === "checklist") return `${upperFirst(t)}: a ${n}-point checklist`
      }
      if (clauseReads(clause)) {
        const c = lowerFirst(clause)
        if (a === "problem") return `Why ${c}`
        if (a === "mistake") return `Why ${c} — and the mistake behind it`
        if (a === "framework") return `A simple framework for when ${c}`
        if (a === "tutorial") return `What to do when ${c}`
        if (a === "checklist") return `The checklist for when ${c}`
      }
      if (a === "problem") return `${upperFirst(head)}: why it happens and how to fix it`
      if (a === "mistake") return `The mistake behind ${lowerFirst(head)}`
      if (a === "framework" || a === "tutorial") return `How to handle ${lowerFirst(head)}`
      if (a === "checklist") return `${upperFirst(t)}: a ${n}-point checklist`
      return null
    }
    case "question": {
      const answer = answerTitle(seed.text)
      if (a === "tutorial" || a === "question") return answer
      if (a === "opinion") return `The honest answer to “${stripEndPunct(seed.text)}?”`
      if (a === "framework") return `${plainAnswer(answer)}: a simple framework`
      if (a === "checklist") return `${plainAnswer(answer)}: a checklist`
      return null
    }
    case "example": {
      if (a === "tutorial") return `${upperFirst(t)}, step by step`
      if (a === "framework") return `${upperFirst(t)}: the version that actually works`
      if (a === "checklist") return short ? `The ${short} checklist ${aud} can steal` : `${upperFirst(t)}: a checklist ${aud} can steal`
      if (a === "mistake") return short ? `The ${short} mistake most ${aud} make` : null
      if (a === "behind the scenes") return brand ? `Behind the scenes: ${lowerFirst(t)} at ${brand}` : null
      return null
    }
    case "story": {
      const s = seed.story
      if (!s) return null
      const title = stripQuotes(s.title)
      if (a === "story") return title
      if (a === "lesson") return `What “${title}” taught me about ${t}`
      if (a === "failure") return s.type === "failure" || s.type === "experience" ? `${title}: what it cost and what I changed` : null
      if (a === "transformation") return s.result ? `Before and after: ${lowerFirst(title)}` : null
      return null
    }
    case "winner": {
      const w = stripEndPunct(seed.text)
      if (a === "lesson") return `${w} — part 2`
      if (a === "contrarian") return `The other side of “${headline(w, 9)}”`
      if (a === "case study") return `${w}: the full breakdown`
      if (a === "before vs after") return `Before vs after: ${lowerFirst(headline(w, 11))}`
      return null
    }
    case "offer": {
      if (a === "case study") return seed.story ? `${stripQuotes(seed.story.title)} — and how a ${t} starts` : `What happens in a ${t} (and who it's for)`
      if (a === "checklist") return `${n} signs you're ready for a ${t}`
      if (a === "behind the scenes") return `What we actually look at in a ${t}`
      return null
    }
    case "topic": {
      if (a === "mistake") return short ? `The biggest ${short} mistake I see ${aud} make` : `The biggest mistake ${aud} make with ${t}`
      if (a === "framework") return `A ${n}-step framework for ${t}`
      if (a === "contrarian") return short ? `Unpopular opinion: most ${short} advice is wrong` : `Unpopular opinion: most advice about ${t} is wrong`
      if (a === "story") return seed.story ? `${stripQuotes(seed.story.title)}: what it taught me about ${t}` : null
      if (a === "checklist") return short ? `The ${short} checklist for ${aud}` : `A checklist for ${t}`
      if (a === "myth") return short ? `${n} ${short} myths ${aud} still believe` : `${n} myths about ${t} that ${aud} still believe`
      if (a === "tutorial") return `How to get ${t} right, step by step`
      if (a === "lesson") return kit.years ? `${n} lessons about ${t} from ${kit.years} years in ${kit.industry}` : `${n} lessons about ${t} I'd teach a beginner`
      if (a === "prediction") return `Where ${t} is heading next — and what to do now`
      if (a === "comparison") return `${upperFirst(t)}: what works vs what everyone does`
      if (a === "question") return `Why is ${t} so hard for ${aud}?`
      if (a === "behind the scenes") return brand ? `How we handle ${t} at ${brand}` : null
      if (a === "opinion") return `My honest take on ${t}`
      return null
    }
  }
}

/** Real material behind an idea: story facts, related problems and questions, the brand's stance. */
function evidence(seed: Seed, kit: Kit): string[] {
  const s = seed.story
  const out: string[] = []
  if (s?.situation) out.push(`Real example: ${clip(firstSentence(s.situation), 150)}`)
  else if (s) out.push(`Real example: “${stripQuotes(s.title)}”${s.lesson ? ` — ${lowerFirst(stripEndPunct(s.lesson))}` : ""}`)
  if (s?.action) out.push(`What we did: ${lowerFirst(clip(stripEndPunct(firstSentence(s.action)), 150))}`)
  if (s?.result) out.push(`What changed: ${lowerFirst(clip(stripEndPunct(firstSentence(s.result)), 140))}`)
  const topicText = `${seed.text} ${seed.subject}`
  if (seed.kind === "question" && seed.problemId) {
    const pain = kit.ctx.problems.find((p) => p.id === seed.problemId)
    if (pain) out.push(`The pain behind the question: “${stripEndPunct(pain.problem)}”`)
  }
  const related = kit.problemsFor(topicText, 2, { exclude: new Set(seed.problemId ? [seed.problemId] : []) })
  for (const p of related) if (out.length < 4) out.push(`The related pain: “${stripEndPunct(p.problem)}”`)
  const q = seed.kind !== "question" ? kit.questionFor(topicText) : null
  if (q && out.length < 4) out.push(`Answer what people actually ask: “${q.question}”`)
  const pov = povLine(kit, topicText)
  if (pov && out.length < 5) out.push(`Your stance: ${pov}`)
  return out
}

function talkingPoints(seed: Seed, angle: string, kit: Kit, n: number): string[] {
  const a = angle.toLowerCase()
  const t = seed.subject
  const s = seed.story
  const aud = kit.audience
  const ev = evidence(seed, kit)
  const take = (k: number) => ev.slice(0, k)
  const named =
    seed.kind === "problem"
      ? `Name it the way ${aud} say it: “${stripEndPunct(seed.text)}.”`
      : seed.kind === "question"
        ? `Open with the exact question: “${stripEndPunct(seed.text)}?”`
        : null
  const pov = povLine(kit, `${seed.text} ${t}`)
  const comesDown = `what ${t} really ${agreeVerb(t, "come", "comes")} down to`
  let points: string[]
  switch (a) {
    case "problem":
      points = [named ?? `Open with the moment ${t} goes wrong.`, ...take(2), "The first fix to try this week — and the number that tells you it worked."]
      break
    case "mistake":
      points = [named ?? `The mistake in one sentence — and what it quietly costs ${aud}.`, ...take(2), "What to do instead — one concrete step."]
      break
    case "framework":
      points = [`Step 1 — diagnose where ${t} ${agreeVerb(t, "break", "breaks")} today.`, "Step 2 — set the one rule or number that guides it.", "Step 3 — review it every week and adjust.", ...take(1)]
      break
    case "tutorial":
      points = [named ?? `When to use this for ${t}.`, `The steps, shown on a real example${s ? ` (“${stripQuotes(s.title)}”)` : ""}.`, ...take(1), `The trap to avoid — and what "done" looks like.`]
      break
    case "checklist":
      points = [`${n} yes/no checks for ${t}.`, ...take(2), "What to do when a check fails."]
      break
    case "story":
    case "failure":
    case "transformation":
      points = s
        ? [
            s.situation ? `The moment: ${clip(s.situation, 140)}` : `The moment it happened: “${stripQuotes(s.title)}”.`,
            s.problem ? `What was at stake: ${clip(s.problem, 140)}` : "What was at stake — in money, people or time.",
            s.action ? `What I did: ${clip(s.action, 140)}` : "What I did about it.",
            `The lesson: ${s.lesson || pov || comesDown}`,
          ]
        : [`The moment ${t} became real for me.`, "What was at stake.", "What I changed.", "The lesson for this week."]
      break
    case "lesson":
      points = [s ? `What happened: ${clip(s.situation || s.title, 140)}` : named ?? `What happened with ${t}, in two sentences.`, `The lesson: ${s?.lesson || pov || comesDown}`, ...take(1).filter((e) => !e.startsWith("Real example")), `How ${aud} can apply it this week.`]
      break
    case "contrarian":
    case "myth":
    case "opinion":
      points = [named ?? `The common view on ${t} — and where it falls short.`, ...take(2), `What I believe instead${pov ? `: ${pov}` : " — and why."}`]
      break
    case "case study":
      points = s?.result
        ? [`Starting point: ${clip(s.situation, 120)}`, `What changed: ${clip(s.action, 140)}`, `Result: ${clip(s.result, 120)}`, `The transferable lesson: ${s.lesson}`]
        : [`The starting point for ${t}.`, ...take(2), "The result — and the lesson anyone can use."]
      break
    case "comparison":
      points = ["Option A — when it works.", "Option B — when it works.", ...take(1), "My call, and the deciding factor."]
      break
    case "prediction":
      points = [`What's changing in ${t}.`, "Why now.", ...take(1), "What to do in the next 90 days."]
      break
    case "behind the scenes":
      points = [`What we're working on with ${t} right now.`, "How the process actually runs — unpolished.", ...take(1), "What we'd do differently next time."]
      break
    case "question":
      points = [named ?? "The honest short answer.", "What it depends on.", ...take(1), `A rule of thumb ${aud} can use today.`]
      break
    default:
      points = [`Why ${t} matters now.`, ...take(2), "One action for this week."]
  }
  // Thin material (a new workspace): add the one structural beat the angle needs so there are always three.
  const EXTRA: Record<string, string> = {
    problem: "Why it keeps happening — usually a habit, not a lack of effort.",
    mistake: "Why smart people still make it.",
    framework: "What changes after the first week of running it.",
    tutorial: "The steps, in order, on one example.",
    checklist: "Why each check matters.",
    contrarian: "The evidence that changed my mind.",
    myth: "Where the myth came from — and why it breaks.",
    opinion: "The strongest argument against my view, stated fairly.",
    question: "The honest short answer.",
  }
  const list = uniqueBy(points.filter(Boolean), (p) => p)
  if (list.length < 3) list.splice(1, 0, EXTRA[a] ?? `What most ${aud} miss about ${t}.`)
  return list.slice(0, 5)
}

/** A title for a Problem Bank entry in the given angle (adapt reference, strategist). */
export function titleForProblem(problem: string, angle: string, kit: Kit, n = 3): string | null {
  const subject = problemSubject(problem, kit)
  return titleFor(
    { kind: "problem", index: 0, text: problem, subject, short: kit.shortSubject(subject), pillarId: null, personaId: null, problemId: null, severity: 0, frequency: 0, story: null, winnerRatio: null },
    angle,
    kit,
    n
  )
}

function hookCategoryFor(angle: string, index: number, kit: Kit, hasStory: boolean): HookCategory {
  const a = angle.toLowerCase()
  if ((a === "story" || a === "failure" || a === "lesson" || a === "transformation") && hasStory) return "story"
  if (a === "mistake") return "mistake"
  if (a === "checklist" || a === "framework") return "list"
  if (a === "contrarian" || a === "myth" || a === "opinion") return "contrarian"
  if (a === "question") return "question"
  if (a === "problem") return "problem"
  if (a === "case study" || a === "before vs after") return hasStory ? "results" : "authority"
  const best = kit.hookCategories().filter((c) => c !== "story" || hasStory)
  return best[index % Math.min(4, best.length)] ?? "curiosity"
}

function resolveAngleName(ctx: BrandContext, name: string): string {
  return ctx.angles.find((x) => x.name.toLowerCase() === name.toLowerCase())?.name ?? name
}

function whyItMatters(seed: Seed, kit: Kit, pillarId: string | null, funnel: FunnelStage, hook: HookCategory): string {
  const ctx = kit.ctx
  const reasons: string[] = []
  const persona = ctx.personas.find((p) => p.id === seed.personaId)
  if (seed.kind === "problem" && seed.severity) reasons.push(`${upperFirst(persona ? audienceFromPersona(persona.name) : "your audience")} rate this ${seed.severity}/5 in your Problem Bank.`)
  if (seed.kind === "question" && seed.frequency) reasons.push(`Asked ${seed.frequency}× in your Question Bank — people already want this answer.`)
  if (seed.kind === "winner" && seed.winnerRatio) reasons.push(`Builds on a winner that hit ${seed.winnerRatio.toFixed(1)}× your platform average.`)
  if (seed.kind === "story" && seed.story) reasons.push("Built on a real Story Vault experience — nobody else can tell it.")
  if (seed.kind === "offer") reasons.push("Turns the trust your educational posts built into conversations about your offer.")
  const pillar = ctx.pillars.find((p) => p.id === pillarId)
  if (pillar && pillar.recent_share !== null && pillar.target_percentage - pillar.recent_share >= 3) {
    reasons.push(`${pillar.name} is at ${Math.round(pillar.recent_share)}% of your recent mix vs a ${pillar.target_percentage}% target.`)
  }
  const perf = kit.hookRatio(hook)
  if (perf?.ratio && perf.ratio >= 1.1 && reasons.length < 3) reasons.push(`${perf.label} hooks average ${perf.ratio.toFixed(1)}× your views.`)
  if (reasons.length < 2) {
    const fits = FUNNEL_GOALS[funnel]
    const goal = ctx.goals.find((g) => g.is_primary && fits.includes(g.category)) ?? ctx.goals.find((g) => fits.includes(g.category))
    if (goal) {
      reasons.push(
        kit.rotate("why-goal", [
          `A ${FUNNEL_STAGES[funnel].label} piece that moves your “${goal.name}” goal.`,
          `Feeds your “${goal.name}” goal at the ${FUNNEL_STAGES[funnel].label} stage.`,
          `${FUNNEL_STAGES[funnel].label} content — the stage that serves “${goal.name}”.`,
        ])
      )
    }
  }
  if (!reasons.length) reasons.push(`${FUNNEL_STAGES[funnel].name} content on something ${kit.audience} are dealing with right now.`)
  return reasons.slice(0, 3).join(" ")
}

function seedSubject(kit: Kit, text: string, fallback: (string | null | undefined)[] = []): { subject: string; short: string | null } {
  const subject = kit.subjectFor(text, { fallback })
  return { subject, short: kit.shortSubject(subject) }
}

function buildSeeds(ctx: BrandContext, kit: Kit, req: IdeaRequest): Seed[] {
  const seeds: Omit<Seed, "index">[] = []
  const matchPillar = (id: string | null) => !req.pillarId || !id || id === req.pillarId
  const matchPersona = (id: string | null) => !req.personaId || !id || id === req.personaId
  const topicTokens = req.topic ? tokenSet(req.topic) : null
  const related = (text: string) => !topicTokens || [...topicTokens].some((t) => tokenSet(text).has(t))

  if (req.topic) {
    const story = kit.storyFor(req.topic, { pillarId: req.pillarId })
    seeds.push({
      kind: "topic",
      text: req.topic,
      ...seedSubject(kit, req.topic, [req.topic]),
      pillarId: req.pillarId ?? kit.pillarFor(req.topic)?.id ?? null,
      personaId: req.personaId ?? kit.personaFor(req.topic)?.id ?? null,
      problemId: req.problemId ?? kit.problemFor(req.topic)?.id ?? null,
      severity: 0,
      frequency: 0,
      story,
      winnerRatio: null,
    })
  }

  const problemFirst = req.problemId ? ctx.problems.filter((p) => p.id === req.problemId) : []
  for (const p of [...problemFirst, ...ctx.problems.filter((x) => x.id !== req.problemId)]) {
    if (!matchPillar(p.pillar_id) || !matchPersona(p.persona_id) || !related(p.problem)) continue
    const subject = problemSubject(p.problem, kit)
    seeds.push({
      kind: "problem",
      text: p.problem,
      subject,
      short: kit.shortSubject(subject),
      pillarId: p.pillar_id ?? req.pillarId ?? null,
      personaId: p.persona_id ?? req.personaId ?? null,
      problemId: p.id,
      severity: p.severity,
      frequency: 0,
      story: kit.storyFor(p.problem, { pillarId: p.pillar_id, minHits: 2 }),
      winnerRatio: null,
    })
  }
  for (const q of ctx.questions) {
    if (!matchPillar(q.pillar_id) || !matchPersona(q.persona_id) || !related(q.question)) continue
    seeds.push({
      kind: "question",
      text: q.question,
      ...seedSubject(kit, q.question),
      pillarId: q.pillar_id ?? req.pillarId ?? null,
      personaId: q.persona_id ?? req.personaId ?? null,
      problemId: kit.problemFor(q.question, { personaId: q.persona_id })?.id ?? null,
      severity: 0,
      frequency: q.frequency,
      story: null,
      winnerRatio: null,
    })
  }
  for (const s of ctx.stories) {
    if (!matchPillar(s.pillar_id) || !related(`${s.title} ${s.lesson} ${s.keywords.join(" ")}`)) continue
    const keyword = s.keywords.find((k) => !isWeakSubject(k) && !/^(failure|story|lesson|case study|event|crisis)$/i.test(k))
    const subject = keyword ? kit.display(keyword) : kit.subjectFor(`${s.title}. ${s.lesson}`)
    seeds.push({
      kind: "story",
      text: s.title,
      subject,
      short: kit.shortSubject(subject),
      pillarId: s.pillar_id ?? req.pillarId ?? null,
      personaId: req.personaId ?? null,
      problemId: kit.problemFor(`${s.title} ${s.lesson}`)?.id ?? null,
      severity: 0,
      frequency: 0,
      story: s,
      winnerRatio: null,
    })
  }
  for (const w of ctx.winners) {
    if (!matchPillar(w.pillar_id) || !related(w.title)) continue
    seeds.push({
      kind: "winner",
      text: w.title,
      ...seedSubject(kit, w.title),
      pillarId: w.pillar_id,
      personaId: req.personaId ?? null,
      problemId: null,
      severity: 0,
      frequency: 0,
      story: null,
      winnerRatio: w.ratio,
    })
  }
  const pillars = req.pillarId ? ctx.pillars.filter((p) => p.id === req.pillarId) : ctx.pillars
  for (const p of pillars) {
    for (const ex of p.examples) {
      const topic = exampleTopic(ex)
      if (SERIES_LIKE.test(ex) || !topic || isWeakSubject(topic) || !related(ex)) continue
      const subject = kit.display(topic)
      seeds.push({
        kind: "example",
        text: ex,
        subject,
        short: kit.shortSubject(subject),
        pillarId: p.id,
        personaId: req.personaId ?? null,
        problemId: kit.problemFor(ex)?.id ?? null,
        severity: 0,
        frequency: 0,
        story: kit.storyFor(ex, { pillarId: p.id, minHits: 2 }),
        winnerRatio: null,
      })
    }
  }
  const offer = /book (?:a |an )?(?:free )?([^,.;]+)/i.exec(ctx.brand.cta_style)?.[1]?.trim()
  const wantsBofu = req.funnel === "bofu" || req.goalCategory === "leads" || req.goalCategory === "business"
  if (offer && (wantsBofu || !req.topic)) {
    const caseStory = ctx.stories.find((s) => s.type === "case_study" && s.result)
    const subject = `free ${offer.replace(/^free\s+/i, "")}`
    seeds.push({
      kind: "offer",
      text: offer,
      subject,
      short: subject,
      pillarId: ctx.pillars.find((p) => p.name.toLowerCase() === "business")?.id ?? req.pillarId ?? null,
      personaId: req.personaId ?? null,
      problemId: null,
      severity: 0,
      frequency: 0,
      story: caseStory ?? null,
      winnerRatio: null,
    })
  }
  if (!req.topic || seeds.length < 3) {
    for (const area of ctx.brand.expertise_areas) {
      if (!related(area)) continue
      const subject = kit.display(area)
      seeds.push({
        kind: "topic",
        text: area,
        subject,
        short: kit.shortSubject(subject),
        pillarId: req.pillarId ?? kit.pillarFor(area, { fallback: false })?.id ?? null,
        personaId: req.personaId ?? null,
        problemId: null,
        severity: 0,
        frequency: 0,
        story: kit.storyFor(area, { minHits: 1 }),
        winnerRatio: null,
      })
    }
    // Niche Discovery: the niche's own topic and the interests that belong to it keep every batch inside the niche.
    const known = new Set(seeds.filter((s) => s.kind === "topic").map((s) => s.text.toLowerCase()))
    for (const text of [nicheTopic(ctx.brand.niche), ...nicheInterests(ctx.brand.niche, ctx.brand.interests, ctx.brand.expertise_areas)]) {
      if (!text || known.has(text.toLowerCase()) || isWeakSubject(text) || !related(text)) continue
      known.add(text.toLowerCase())
      const subject = kit.display(text)
      seeds.push({
        kind: "topic",
        text,
        subject,
        short: kit.shortSubject(subject),
        pillarId: req.pillarId ?? kit.pillarFor(text, { fallback: false })?.id ?? null,
        personaId: req.personaId ?? null,
        problemId: null,
        severity: 0,
        frequency: 0,
        story: kit.storyFor(text, { minHits: 1 }),
        winnerRatio: null,
      })
    }
  }
  if (!seeds.length) {
    const fallback =
      req.topic || nicheTopic(ctx.brand.niche) || ctx.brand.expertise_areas[0] || ctx.brand.interests[0] || ctx.pillars[0]?.name || ctx.brand.industry || "your work"
    const subject = kit.display(analyzeTopic(fallback).subject || fallback)
    seeds.push({ kind: "topic", text: fallback, subject, short: kit.shortSubject(subject), pillarId: req.pillarId ?? null, personaId: req.personaId ?? null, problemId: null, severity: 0, frequency: 0, story: null, winnerRatio: null })
  }

  // Interleave kinds so a batch mixes problems, questions, stories, examples and winners.
  const weight = (s: Omit<Seed, "index">) => s.severity + Math.min(s.frequency, 8) + (s.kind === "topic" && req.topic ? 100 : 0) + (s.kind === "offer" && wantsBofu ? 50 : 0) + kit.rng.next()
  const byKind = new Map<SeedKind, Omit<Seed, "index">[]>()
  for (const s of seeds) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s])
  for (const list of byKind.values()) list.sort((a, b) => weight(b) - weight(a))
  const kindOrder: SeedKind[] = req.topic
    ? ["topic", "problem", "question", "story", "example", "winner", "offer"]
    : wantsBofu
      ? ["offer", "problem", "question", "story", "example", "winner", "topic"]
      : ["problem", "question", "story", "example", "winner", "topic", "offer"]
  const ordered: Omit<Seed, "index">[] = []
  for (let round = 0; ordered.length < seeds.length; round++) {
    for (const kind of kindOrder) {
      const item = byKind.get(kind)?.[round]
      if (item) ordered.push(item)
    }
    if (round > seeds.length) break
  }
  return ordered.map((s, index) => ({ ...s, index }))
}

/** Topic-based title for an angle (winner replication, strategist). */
export function titleForTopic(subject: string, angle: string, kit: Kit, story: ContextStory | null = null, n = 5): string | null {
  return titleFor(
    { kind: "topic", index: 0, text: subject, subject, short: kit.shortSubject(subject), pillarId: null, personaId: null, problemId: null, severity: 0, frequency: 0, story, winnerRatio: null },
    angle,
    kit,
    n
  )
}

export function generateOfflineIdeas(ctx: BrandContext, kit: Kit, req: IdeaRequest): OfflineIdea[] {
  const count = Math.max(1, Math.min(30, Math.round(req.count)))
  const seeds = buildSeeds(ctx, kit, req)
  const avoid = [...ctx.recent_titles, ...(req.avoidTitles ?? [])].map(tokenSet)
  const seen: Set<string>[] = []
  const out: OfflineIdea[] = []
  const preferredAngles = req.goalCategory ? (GOAL_ANGLES[req.goalCategory] ?? []) : []

  for (let round = 0; out.length < count && round < 8; round++) {
    for (const seed of seeds) {
      if (out.length >= count) break
      const pillarKey = kit.pillarKey(ctx.pillars.find((p) => p.id === seed.pillarId))
      // A list of topics ("ROAS, agencies and growth") only works as an opinion piece.
      const exampleAngles = /,/.test(seed.subject) ? ["Opinion", "Contrarian"] : (EXAMPLE_ANGLES[pillarKey] ?? ANGLES_BY_KIND.example)
      const base = seed.kind === "example" ? exampleAngles : ANGLES_BY_KIND[seed.kind]
      const angles = req.angle ? [req.angle] : [...preferredAngles.filter((a) => base.includes(a)), ...base.filter((a) => !preferredAngles.includes(a))]
      const angle = angles[(seed.index + round) % angles.length]
      const n = kit.rotate("idea-number", [3, 5, 7])
      const title = titleFor(seed, angle, kit, n) ?? (req.angle || seed.kind === "example" ? titleFor({ ...seed, kind: "topic" }, angle, kit, n) : null)
      if (!title) continue
      const tokens = tokenSet(title)
      if (seen.some((s) => jaccard(s, tokens) >= 0.55) || avoid.some((s) => jaccard(s, tokens) >= 0.7)) continue
      seen.push(tokens)

      const i = out.length
      const pillar = ctx.pillars.find((p) => p.id === (seed.pillarId ?? req.pillarId)) ?? kit.pillarFor(`${title} ${seed.text}`)
      const pillarId = pillar?.id ?? null
      const personaId = seed.personaId ?? req.personaId ?? kit.personaFor(`${title} ${seed.text}`)?.id ?? null
      const platforms = kit.platformsFor({ pillarId, personaId, prefer: req.platform ?? null })
      const platform = req.platform ?? platforms[[0, 1, 0, 2][i % 4] % platforms.length]
      const a = angle.toLowerCase()
      const hint = a === "checklist" || a === "framework" ? (platform === "instagram" || platform === "linkedin" ? "visual" : null) : null
      const format = (req.formatId ? ctx.formats.find((f) => f.id === req.formatId) : null) ?? kit.formatFor(platform, hint)
      const funnel: FunnelStage =
        req.funnel ?? (seed.kind === "offer" ? "bofu" : a === "case study" || a === "tutorial" || a === "framework" || a === "checklist" ? "mofu" : kit.funnelFor(`${title} ${seed.text}`, pillar))
      const hookCategory = hookCategoryFor(angle, i, kit, Boolean(seed.story))
      const topicForHook = analyzeTopic(seed.kind === "topic" ? seed.text : `${seed.subject}. ${seed.text}`)
      const slots = hookSlots(topicForHook, kit, {
        subject: seed.subject,
        story: seed.story,
        problem: seed.kind === "problem" ? seed.text : null,
        question: seed.kind === "question" ? seed.text : null,
      })
      // A title that promises a number ("A 5-step framework…", "3 signs…") gets a hook with the same number.
      const promised = Number(/\b(\d+)(?:-step|-point|\s+(?:signs?|steps?|ways?|mistakes?|questions?|rules?|things?|lessons?|myths?|tips?|numbers?))\b/i.exec(title)?.[1] ?? 0)
      const hook = writeHook(hookCategory, promised >= 2 && promised <= 10 ? { ...slots, number: promised } : slots, kit)
      const deliverable = DELIVERABLE[a] ?? "a clear takeaway they can act on"
      const lead =
        seed.kind === "problem"
          ? `${upperFirst(stripEndPunct(seed.text))}.`
          : seed.kind === "question"
            ? `Answer “${stripEndPunct(seed.text)}?” directly.`
            : `${upperFirst(stripEndPunct(title))}.`
      const core = `${lead} Give ${kit.audience} ${deliverable}${seed.story ? `, using “${stripQuotes(seed.story.title)}” as proof` : ""}.`

      out.push({
        title: kit.scrub(upperFirst(title)),
        core_idea: kit.scrub(core),
        why_it_matters: whyItMatters(seed, kit, pillarId, funnel, hook.category),
        hook: hook.text,
        hook_category: hook.category,
        format: format?.name ?? "",
        angle: resolveAngleName(ctx, angle),
        talking_points: talkingPoints(seed, angle, kit, n).map((p) => kit.scrub(p)),
        cta: kit.cta({ funnel, platform, topic: seed.subject }),
        platform,
        funnel_stage: funnel,
        pillar_id: pillarId,
        persona_id: personaId,
        problem_id: seed.problemId ?? (req.problemId || null),
      })
    }
  }
  return out
}
