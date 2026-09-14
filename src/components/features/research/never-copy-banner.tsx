import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

/** The Research Library principle: study why content works, then make your own. */
export function NeverCopyBanner({ className }: { className?: string }) {
  return (
    <div role="note" className={cn("flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm", className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <p className="min-w-0 text-pretty">
        <span className="font-medium">Analyze structure, angle, hook and pattern — then create original content. Never copy.</span>{" "}
        <span className="text-muted-foreground">Pasted text is used for analysis only and is never republished.</span>
      </p>
    </div>
  )
}
