import { cn } from "@/lib/utils"
import { splitBlanks } from "./hook-model"

/** Hook text with its "___" blanks highlighted as fill-in slots. */
export function HookText({ text, className }: { text: string; className?: string }) {
  const parts = splitBlanks(text)
  return (
    <span className={cn("text-pretty", className)}>
      {parts.map((part, index) =>
        part.blank ? (
          <span
            key={index}
            className="mx-px inline-block min-w-8 rounded-[4px] border border-dashed border-brand/45 bg-brand-soft px-1 text-center align-baseline text-[0.85em] leading-snug text-muted-foreground"
          >
            <span aria-hidden>___</span>
            <span className="sr-only">(blank)</span>
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  )
}
