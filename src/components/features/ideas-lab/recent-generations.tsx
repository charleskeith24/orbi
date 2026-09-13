"use client"

import { History } from "lucide-react"
import { SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { providerLabel } from "@/lib/ai"
import { describeBrief, timeAgo, type BriefDb, type LoggedGeneration } from "./generator-model"

/** The last Idea Generator runs from the AI log: restore the batch or load its brief into the form. */
export function RecentGenerations({
  generations,
  showing,
  db,
  now,
  busy,
  pendingOrigin,
  onRestore,
  onUseBrief,
}: {
  generations: LoggedGeneration[]
  /** Generation ids currently in the results. */
  showing: Set<string>
  db: BriefDb
  now: Date
  busy: boolean
  pendingOrigin: string | null
  onRestore: (generation: LoggedGeneration) => void
  onUseBrief: (generation: LoggedGeneration) => void
}) {
  if (!generations.length) return null
  return (
    <SectionCard title="Recent generations" description="Bring a batch back, or reuse its brief." icon={History} contentClassName="px-0 pt-2 pb-1">
      <ul className="flex flex-col divide-y">
        {generations.map((generation) => {
          const parts = describeBrief(generation.brief, db)
          const summary = parts.length ? parts.join(" · ") : "Balanced mix"
          const isShowing = showing.has(generation.id)
          const restorable = generation.ideas.length > 0
          const count = generation.ideas.length
          return (
            <li key={generation.id} className="flex min-w-0 flex-col gap-1 px-4 py-2.5">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm" title={summary}>
                  {summary}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(generation.createdAt, now)}</span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="num">{restorable ? `${count} ${count === 1 ? "idea" : "ideas"}` : "Too large to keep"}</span>
                <span aria-hidden>·</span>
                <span className="min-w-0 truncate">{providerLabel(generation.provider, generation.model)}</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button type="button" variant="ghost" size="xs" onClick={() => onUseBrief(generation)}>
                    Use brief
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={isShowing || (busy && !restorable)}
                    title={isShowing ? "Already in the results" : restorable ? "Put this batch back in the results" : "The log couldn't keep this batch — run its brief again"}
                    onClick={() => onRestore(generation)}
                  >
                    {pendingOrigin === `recent:${generation.id}` ? <Spinner /> : null}
                    {isShowing ? "Showing" : restorable ? "Restore" : "Run again"}
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
