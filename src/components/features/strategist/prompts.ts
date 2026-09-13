import { CalendarDays, CalendarRange, Lightbulb, NotebookPen, TrendingDown, TrendingUp, Zap, type LucideIcon } from "lucide-react"
import type { AnalyticsSnapshot } from "@/lib/ai"
import { clip } from "./turns"

export interface StrategistPrompt {
  text: string
  icon: LucideIcon
  /** Composer text for prompts that need the creator's own details before they can be answered. */
  prefill?: string
  /** Where the caret goes in `prefill` (default: the end). */
  caret?: number
}

// The story goes first and the instruction last, so the story — not the instruction — sets the topic.
const EXPERIENCE_LEAD = "Today, "

/** Spec §56 — the questions the Content Strategist is built to answer. */
export const SUGGESTED_PROMPTS: StrategistPrompt[] = [
  { text: "What should I post this week?", icon: CalendarDays },
  { text: "Why are my educational posts underperforming?", icon: TrendingDown },
  { text: "Give me 20 ideas about leadership.", icon: Lightbulb },
  {
    text: "Turn my experience today into a Facebook post.",
    icon: NotebookPen,
    prefill: `${EXPERIENCE_LEAD}\n\nTurn this experience into a Facebook post.`,
    caret: EXPERIENCE_LEAD.length,
  },
  { text: "What topics should I double down on?", icon: TrendingUp },
  { text: "What are my best hooks?", icon: Zap },
  { text: "Build my content plan for next week.", icon: CalendarRange },
]

/** Up to three questions prompted by the current numbers: weakest pillar, best winner, buffer or pace, mix. */
export function dataPrompts(snapshot: AnalyticsSnapshot): string[] {
  const out: string[] = []
  const weakest = snapshot.pillars
    .filter((p) => p.posts >= 3 && p.ratio !== null && p.ratio < 0.9)
    .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0))[0]
  if (weakest) out.push(`Why is ${weakest.label} underperforming?`)
  const winner = [...snapshot.winners].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0]
  if (winner) out.push(`Why did “${clip(winner.title, 48)}” become a winner?`)
  if (snapshot.buffer.status === "low") out.push("How do I rebuild my Content Buffer?")
  else if (snapshot.weekly.target > 0 && !snapshot.weekly.on_track) out.push("Am I on track with my posting target?")
  if (snapshot.mix_warnings.length) out.push("Which pillars am I neglecting?")
  return out.slice(0, 3)
}
