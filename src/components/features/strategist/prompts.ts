import { CalendarDays, CalendarRange, Lightbulb, NotebookPen, TrendingDown, TrendingUp, Zap, type LucideIcon } from "lucide-react"
import type { AnalyticsSnapshot } from "@/lib/ai"
import { translator, type UiLang } from "@/lib/i18n/core"
import { strategistMessages } from "./strategist-messages"
import { clip } from "./turns"

type PromptLabelKey = "prompt_week" | "prompt_underperforming" | "prompt_ideas" | "prompt_experience" | "prompt_double_down" | "prompt_hooks" | "prompt_plan"

/**
 * A prompt chip. `text` is the question sent to the strategist and stays English in both UI languages —
 * the offline engine matches English keywords, and a Tagalog-looking question switches its reply to
 * Taglish, which would let the UI language change the AI output. Only `label` (what the chip shows) is
 * translated.
 */
export interface StrategistPrompt {
  text: string
  /** Translated chip text; falls back to `text`. */
  label?: string
  icon: LucideIcon
  /** Composer text for prompts that need the creator's own details before they can be answered. */
  prefill?: string
  /** Where the caret goes in `prefill` (default: the end). */
  caret?: number
}

// The story goes first and the instruction last, so the story — not the instruction — sets the topic.
const EXPERIENCE_LEAD = "Today, "

/** Spec §56 — the questions the Content Strategist is built to answer (English `text`, label keys for the UI). */
const PROMPTS: (StrategistPrompt & { labelKey: PromptLabelKey })[] = [
  { text: "What should I post this week?", labelKey: "prompt_week", icon: CalendarDays },
  { text: "Why are my educational posts underperforming?", labelKey: "prompt_underperforming", icon: TrendingDown },
  { text: "Give me 20 ideas about leadership.", labelKey: "prompt_ideas", icon: Lightbulb },
  {
    text: "Turn my experience today into a Facebook post.",
    labelKey: "prompt_experience",
    icon: NotebookPen,
    // The composer text is the question itself, so it stays English too.
    prefill: `${EXPERIENCE_LEAD}\n\nTurn this experience into a Facebook post.`,
    caret: EXPERIENCE_LEAD.length,
  },
  { text: "What topics should I double down on?", labelKey: "prompt_double_down", icon: TrendingUp },
  { text: "What are my best hooks?", labelKey: "prompt_hooks", icon: Zap },
  { text: "Build my content plan for next week.", labelKey: "prompt_plan", icon: CalendarRange },
]

/** The §56 prompts with chip labels in the UI language. */
export function suggestedPrompts(lang: UiLang = "en"): StrategistPrompt[] {
  const t = translator(strategistMessages, lang)
  return PROMPTS.map(({ labelKey, ...prompt }) => ({ ...prompt, label: t(labelKey) }))
}

export const SUGGESTED_PROMPTS: StrategistPrompt[] = suggestedPrompts("en")

/** Up to three questions prompted by the current numbers: weakest pillar, best winner, buffer or pace, mix. */
export function dataPrompts(snapshot: AnalyticsSnapshot, lang: UiLang = "en"): { text: string; label: string }[] {
  const t = translator(strategistMessages, lang)
  const out: { text: string; label: string }[] = []
  const weakest = snapshot.pillars
    .filter((p) => p.posts >= 3 && p.ratio !== null && p.ratio < 0.9)
    .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0))[0]
  if (weakest) out.push({ text: `Why is ${weakest.label} underperforming?`, label: t("data_weakest", { label: weakest.label }) })
  const winner = [...snapshot.winners].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0]
  if (winner) {
    const title = clip(winner.title, 48)
    out.push({ text: `Why did “${title}” become a winner?`, label: t("data_winner", { title }) })
  }
  if (snapshot.buffer.status === "low") out.push({ text: "How do I rebuild my Content Buffer?", label: t("data_buffer") })
  else if (snapshot.weekly.target > 0 && !snapshot.weekly.on_track) {
    out.push({ text: "Am I on track with my posting target?", label: t("data_pace") })
  }
  if (snapshot.mix_warnings.length) out.push({ text: "Which pillars am I neglecting?", label: t("data_mix") })
  return out.slice(0, 3)
}
