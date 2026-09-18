"use client"

import { History } from "lucide-react"
import { SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { providerLabel } from "@/lib/ai"
import { useT, useUiLang } from "@/lib/i18n"
import { generatorMessages } from "./generator-messages"
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
  const t = useT(generatorMessages)
  const lang = useUiLang()
  if (!generations.length) return null
  return (
    <SectionCard title={t("recent_title")} description={t("recent_description")} icon={History} contentClassName="px-0 pt-2 pb-1">
      <ul className="flex flex-col divide-y">
        {generations.map((generation) => {
          const parts = describeBrief(generation.brief, db, lang)
          const summary = parts.length ? parts.join(" · ") : t("balanced_mix")
          const isShowing = showing.has(generation.id)
          const restorable = generation.ideas.length > 0
          const count = generation.ideas.length
          return (
            <li key={generation.id} className="flex min-w-0 flex-col gap-1 px-4 py-2.5">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm" title={summary}>
                  {summary}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(generation.createdAt, now, lang)}</span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="num">{restorable ? t.plural("ideas", count) : t("too_large")}</span>
                <span aria-hidden>·</span>
                <span className="min-w-0 truncate">{providerLabel(generation.provider, generation.model)}</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button type="button" variant="ghost" size="xs" onClick={() => onUseBrief(generation)}>
                    {t("use_brief")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={isShowing || (busy && !restorable)}
                    title={isShowing ? t("showing_title") : restorable ? t("restore_title") : t("run_again_title")}
                    onClick={() => onRestore(generation)}
                  >
                    {pendingOrigin === `recent:${generation.id}` ? <Spinner /> : null}
                    {isShowing ? t("showing") : restorable ? t("restore") : t("run_again")}
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
