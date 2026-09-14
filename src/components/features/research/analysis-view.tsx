import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AnalysisFields } from "./research-model"

const LABEL = "text-[11px] leading-4 font-medium tracking-wide text-muted-foreground uppercase"

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className={LABEL}>{label}</dt>
      <dd className="min-w-0 text-sm text-pretty">{children}</dd>
    </div>
  )
}

const Empty = () => <span className="text-muted-foreground">—</span>

/** Read-only analysis: what makes the reference work, in the order a creator would borrow it. */
export function AnalysisView({ analysis, className }: { analysis: AnalysisFields; className?: string }) {
  return (
    <dl className={cn("grid min-w-0 gap-4", className)}>
      <Item label="Hook">{analysis.hook || <Empty />}</Item>
      <Item label="Structure">
        {analysis.structure.length ? (
          <ol className="flex flex-col gap-1">
            {analysis.structure.map((beat, index) => {
              const split = beat.indexOf(":")
              return (
                <li key={index} className="flex min-w-0 gap-2">
                  <span aria-hidden className="w-4 shrink-0 text-right text-xs leading-5 text-muted-foreground num">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    {split > 0 ? (
                      <>
                        <span className="font-medium">{beat.slice(0, split)}</span>
                        <span className="text-muted-foreground">{beat.slice(split)}</span>
                      </>
                    ) : (
                      beat
                    )}
                  </span>
                </li>
              )
            })}
          </ol>
        ) : (
          <Empty />
        )}
      </Item>
      <Item label="Angle">{analysis.angle || <Empty />}</Item>
      <Item label="Psychology">{analysis.psychology || <Empty />}</Item>
      <Item label="Why it works">{analysis.why_it_works || <Empty />}</Item>
      <Item label="Patterns to borrow">
        {analysis.patterns.length ? (
          <ul className="flex flex-col gap-1">
            {analysis.patterns.map((pattern, index) => (
              <li key={index} className="flex min-w-0 gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">{pattern}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </Item>
    </dl>
  )
}
