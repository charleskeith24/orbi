import * as z from "zod"
import { PLATFORMS } from "@/lib/constants"
import { seedFor, splitSentences, stripEndPunct, truncateWords } from "../offline/text"
import { createKit } from "../offline/brand"
import { defineTask, inputText, platformSchema, uniqueStrings } from "./shared"

const input = z.object({
  content: inputText(15000).min(20, "Paste the reference content (at least a few lines)."),
  platform: platformSchema.nullish().transform((v) => v ?? null),
  creator: z.string().trim().max(120).nullish().transform((v) => v || null),
  title: z.string().trim().max(300).nullish().transform((v) => v || null),
})

const output = z.object({
  hook: z.string().describe("The opening line quoted (max 15 words) plus what kind of hook it is"),
  structure: z.array(z.string()).describe("The beats in order, e.g. 'Hook: number-led claim'"),
  angle: z.string(),
  psychology: z.string().describe("Which psychological levers it pulls and how"),
  why_it_works: z.string(),
  patterns: z.array(z.string()).describe("Reusable patterns the creator can borrow (structure, not words)"),
})

const CTA_RE = /\b(comment|dm|save|share|follow|link|subscribe|reply|click|book|download|join)\b/i
const STORY_RE = /\b(i|we)\b.*\b(was|were|had|did|decided|remember|lost|built|started|quit|called)\b|\b(years? ago|last (week|month|year)|one day|that night)\b/i
const CONTRARIAN_RE = /\b(most people|everyone|nobody|wrong|stop|myth|unpopular|overrated|truth is|isn't|don't)\b/i
const LESSON_RE = /\b(lesson|learned|takeaway|the point|moral|remember this|here's what)\b/i
const RESULT_RE = /[0-9₱$%]|\b(went from|increased|doubled|tripled|grew|results?)\b/i

type Beat = "Hook" | "Direct address" | "Story beat" | "Turn" | "List / steps" | "Proof" | "Lesson" | "Question" | "CTA" | "Context"

function classify(line: string, index: number): Beat {
  if (index === 0) return "Hook"
  if (CTA_RE.test(line) && index > 0) return "CTA"
  if (/^\s*(\d+[.)/]|[-•*])\s+/.test(line)) return "List / steps"
  if (LESSON_RE.test(line)) return "Lesson"
  if (RESULT_RE.test(line)) return "Proof"
  if (STORY_RE.test(line)) return "Story beat"
  if (/\b(but|instead|however|except|the problem is|pero)\b/i.test(line)) return "Turn"
  if (/\?\s*$/.test(line)) return "Question"
  if (/\byou(r)?\b/i.test(line)) return "Direct address"
  return "Context"
}

const BEAT_NOTES: Record<Beat, string> = {
  Hook: "",
  "Direct address": "names the reader's situation",
  "Story beat": "a specific moment that makes it real",
  Turn: "challenges the obvious answer",
  "List / steps": "scannable steps or items",
  Proof: "numbers or results that make it credible",
  Lesson: "the transferable takeaway",
  Question: "pulls the reader in",
  CTA: "one clear next step",
  Context: "sets up the situation",
}

function hookType(hook: string): string {
  if (/^\d|\b\d+\s+(ways|things|tips|steps|signs|mistakes|lessons|reasons)\b/i.test(hook)) return "number-led list promise"
  if (/[0-9₱$%]/.test(hook)) return "specific-number claim"
  if (/\?\s*$/.test(hook)) return "question"
  if (CONTRARIAN_RE.test(hook)) return "contrarian claim"
  if (STORY_RE.test(hook)) return "drop-into-a-moment story opener"
  if (/:\s*$|\.{3}$|here's/i.test(hook)) return "curiosity gap"
  return "direct statement"
}

export const analyzeReferenceTask = defineTask({
  name: "analyze_reference",
  description: "Research Library: analyse why a reference post works — hook, structure, angle, psychology, patterns. Analysis only; never reproduces the reference.",
  input,
  output,
  maxTokens: 3000,

  buildPrompt(_ctx, i) {
    return {
      user: [
        `Task: analyse why this reference${i.creator ? ` by ${i.creator}` : ""}${i.platform ? ` (${PLATFORMS[i.platform].label})` : ""} works: hook, structure, angle, psychology and reusable patterns.`,
        `<reference>\n${i.content}\n</reference>`,
        "Describe and explain — don't rewrite, summarise line by line, or reproduce it. Quote at most the opening line (15 words max) in `hook`. Patterns must be structural and reusable by this creator with their own substance.",
      ].join("\n\n"),
    }
  },

  offline(ctx, i) {
    const kit = createKit(ctx, seedFor("analyze_reference", i))
    const lines = i.content.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    const units = lines.length >= 3 ? lines : splitSentences(i.content)
    const hookLine = units[0] ?? i.content
    const hookKind = hookType(hookLine)

    const beats: { beat: Beat; count: number }[] = []
    units.forEach((line, index) => {
      const beat = classify(line, index)
      const last = beats[beats.length - 1]
      if (last && last.beat === beat) last.count++
      else beats.push({ beat, count: 1 })
    })
    const structure = beats.slice(0, 8).map(({ beat, count }) =>
      beat === "Hook" ? `Hook: ${hookKind}` : `${beat}${count > 1 ? ` (${count} lines)` : ""}: ${BEAT_NOTES[beat]}`
    )

    const text = i.content
    const has = (re: RegExp) => re.test(text)
    const listCount = units.filter((u) => /^\s*(\d+[.)/]|[-•*])\s+/.test(u)).length
    const angle = listCount >= 3
      ? "Listicle / checklist"
      : has(STORY_RE) && has(LESSON_RE)
        ? "Personal story → lesson"
        : has(RESULT_RE) && /\b(client|brand|company|case)\b/i.test(text)
          ? "Case study with numbers"
          : CONTRARIAN_RE.test(hookLine)
            ? "Contrarian take"
            : /\b(how to|step|here's how)\b/i.test(text)
              ? "Tutorial / how-to"
              : /\?\s*$/.test(hookLine)
                ? "Question-led"
                : "Observation"

    const levers: string[] = []
    if (/[0-9₱$%]/.test(hookLine)) levers.push("specificity — a concrete number makes the claim feel real")
    if (/:\s*$|\.{3}$|here's|this is why/i.test(hookLine)) levers.push("a curiosity gap — the hook promises an answer only the rest delivers")
    if (/\b(stop|mistake|lose|losing|cost|wrong|never)\b/i.test(text)) levers.push("loss aversion — it names what the reader is losing or getting wrong")
    if (/\b(if you're|as a|for (founders|creators|marketers|sellers|owners))\b/i.test(text)) levers.push("identity — it tells a specific reader “this is about you”")
    if (has(STORY_RE)) levers.push("relatability — a real moment the reader can picture")
    if (/\b(clients?|years|we've|managed|built)\b/i.test(text)) levers.push("earned authority — experience shown, not claimed")
    if (!levers.length) levers.push("clarity — one idea, stated plainly")

    const youCount = (text.match(/\byou(r)?\b/gi) ?? []).length
    const avgLine = Math.round(text.split(/\s+/).length / Math.max(1, units.length))
    const lastLine = units[units.length - 1] ?? ""
    const patterns = uniqueStrings(
      [
        `Open with a ${hookKind}`,
        avgLine <= 14 ? `Short lines (~${avgLine} words each) — one idea per line` : "",
        listCount >= 3 ? `${listCount} numbered or bulleted items — easy to screenshot and save` : "",
        has(STORY_RE) ? "Put a specific moment before the advice" : "",
        has(RESULT_RE) ? "Back the claim with a number or before/after" : "",
        youCount >= 3 ? `Reader-first: “you” appears ${youCount} times` : "",
        /\?\s*$/.test(lastLine) ? "End on a question to invite comments" : CTA_RE.test(lastLine) ? "End with one clear call to action" : "",
        beats.some((b) => b.beat === "Turn") ? "Include a turn that challenges the obvious answer" : "",
      ].filter(Boolean),
      7
    )

    return {
      hook: `“${truncateWords(stripEndPunct(hookLine), 15)}” — a ${hookKind}.`,
      structure,
      angle,
      psychology: `It pulls ${levers.length > 1 ? `${levers.slice(0, -1).join("; ")}; and ${levers[levers.length - 1]}` : levers[0]}.`,
      why_it_works: `The ${hookKind} earns the next line, the ${angle.toLowerCase()} structure keeps ${units.length > 6 ? "a longer post" : "it"} easy to follow, and ${/\?\s*$/.test(lastLine) ? "the closing question turns readers into commenters" : CTA_RE.test(lastLine) ? "the ending tells people exactly what to do next" : "it ends on a clear takeaway"}. ${kit.ctx.brand.name ? "Borrow the structure — fill it with your own story and numbers." : ""}`.trim(),
      patterns,
    }
  },

  finalize(out) {
    return { ...out, structure: uniqueStrings(out.structure, 10), patterns: uniqueStrings(out.patterns, 10) }
  },
})
