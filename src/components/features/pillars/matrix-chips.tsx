import { Target } from "lucide-react"
import { ColorDot, FormatCategoryIcon, Token } from "@/components/common"
import type { CategoricalColor, FormatCategory } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Severity 1–5 as five rising bars. Decorative — pair it with text or a title. */
export function SeverityMark({ severity, className }: { severity: number; className?: string }) {
  const level = Math.min(5, Math.max(1, Math.round(severity) || 1))
  return (
    <span aria-hidden className={cn("inline-flex h-2.5 shrink-0 items-end gap-px", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full", i <= level ? "bg-foreground/70" : "bg-foreground/15")}
          style={{ height: `${40 + i * 12}%` }}
        />
      ))}
    </span>
  )
}

export function PillarChip({ name, color }: { name: string; color: CategoricalColor }) {
  return (
    <Token className="max-w-44">
      <ColorDot color={color} />
      <span className="truncate">{name}</span>
    </Token>
  )
}

export function FormatChip({ name, category }: { name: string; category: FormatCategory }) {
  return (
    <Token className="max-w-44 font-normal text-foreground/85">
      <FormatCategoryIcon category={category} className="text-muted-foreground" />
      <span className="truncate">{name}</span>
    </Token>
  )
}

export function GoalChip({ name }: { name: string }) {
  return (
    <Token className="max-w-52 font-normal text-foreground/85" title={`Goal: ${name}`}>
      <Target className="text-muted-foreground" aria-hidden />
      <span className="truncate">{name}</span>
    </Token>
  )
}

/** The problem's severity and who has it — the problem itself is already in the working title (full text on hover). */
export function ProblemChip({ text, severity, persona }: { text: string; severity: number; persona: string | null }) {
  const audience = persona ?? "Any audience"
  return (
    <Token className="max-w-52 font-normal text-foreground/85" title={`Severity ${severity}/5 for ${audience}: ${text}`}>
      <SeverityMark severity={severity} />
      <span className="truncate">{audience}</span>
      <span className="sr-only">, severity {severity} of 5</span>
    </Token>
  )
}
