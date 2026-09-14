"use client"

import { CircleCheck, WandSparkles } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { PillarBadge, PlatformIcon, SectionCard, StageBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { FUNNEL_STAGE_IDS, FUNNEL_STAGES } from "@/lib/constants"
import { dataActions, useLookup, useTable } from "@/lib/store"
import type { ContentItem, FunnelStage } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { sortForAssignment, suggestFunnelStage } from "./funnel-utils"

const PAGE_SIZE = 8

/** Content items without a funnel stage, with one-click assignment and suggestions from each item's idea or goal. */
export function UnassignedItems() {
  const items = useTable("content_items")
  const ideas = useLookup("content_ideas")
  const goals = useLookup("content_goals")
  const [expanded, setExpanded] = useState(false)

  const rows = useMemo(
    () =>
      sortForAssignment(items.filter((i) => !i.funnel_stage)).map((item) => ({
        item,
        suggestion: suggestFunnelStage(item, ideas, goals),
      })),
    [items, ideas, goals]
  )
  const suggested = rows.flatMap((r) => (r.suggestion ? [{ id: r.item.id, patch: { funnel_stage: r.suggestion.stage } }] : []))
  const visible = expanded ? rows : rows.slice(0, PAGE_SIZE)

  function assign(item: ContentItem, stage: FunnelStage) {
    dataActions.update("content_items", item.id, { funnel_stage: stage })
    toast.success(`Assigned to ${FUNNEL_STAGES[stage].label} · ${FUNNEL_STAGES[stage].name}`, {
      description: item.title || "Untitled content",
      action: { label: "Undo", onClick: () => dataActions.update("content_items", item.id, { funnel_stage: null }) },
    })
  }

  function applySuggestions() {
    if (!suggested.length) return
    dataActions.updateMany("content_items", suggested)
    toast.success(`${pluralize(suggested.length, "piece")} assigned`, {
      description: "Stages taken from each piece's idea or goal.",
      action: {
        label: "Undo",
        onClick: () =>
          dataActions.updateMany(
            "content_items",
            suggested.map((u) => ({ id: u.id, patch: { funnel_stage: null } }))
          ),
      },
    })
  }

  return (
    <SectionCard
      title="Content without a funnel stage"
      description={
        rows.length
          ? `${pluralize(rows.length, "piece")} — every piece needs a job. Assign a stage so the funnel mix stays honest.`
          : undefined
      }
      action={
        suggested.length ? (
          <Button type="button" size="sm" variant="outline" onClick={applySuggestions}>
            <WandSparkles className="text-brand" aria-hidden />
            Apply {suggested.length} suggestion{suggested.length === 1 ? "" : "s"}
          </Button>
        ) : null
      }
      contentClassName={rows.length ? "p-0" : undefined}
    >
      {rows.length ? (
        <>
          <ul className="divide-y border-t">
            {visible.map(({ item, suggestion }) => {
              const title = item.title || "Untitled content"
              return (
                <li key={item.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/studio/${item.id}`}
                      className="block truncate text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                    >
                      {title}
                    </Link>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <PlatformIcon platform={item.platform} label className="size-3.5" />
                      <PillarBadge pillarId={item.pillar_id} variant="plain" />
                      <StageBadge stage={item.stage} />
                      {suggestion ? (
                        <span>
                          Suggested <span className="font-medium text-foreground">{FUNNEL_STAGES[suggestion.stage].label}</span> ·{" "}
                          {suggestion.reason}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div role="group" aria-label={`Assign a funnel stage to ${title}`} className="flex shrink-0 gap-1">
                    {FUNNEL_STAGE_IDS.map((stage) => {
                      const isSuggested = suggestion?.stage === stage
                      return (
                        <Button
                          key={stage}
                          type="button"
                          size="xs"
                          variant="outline"
                          title={`${FUNNEL_STAGES[stage].name} — ${FUNNEL_STAGES[stage].goal}`}
                          aria-label={`Assign ${FUNNEL_STAGES[stage].label}${isSuggested ? " (suggested)" : ""}`}
                          onClick={() => assign(item, stage)}
                          className={cn("w-14", isSuggested && "border-brand/50 bg-brand-soft text-foreground")}
                        >
                          {FUNNEL_STAGES[stage].label}
                        </Button>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
          {rows.length > PAGE_SIZE ? (
            <div className="border-t px-4 py-2">
              <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : `Show all ${rows.length}`}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-good-fg">
          <CircleCheck className="size-3.5 shrink-0" aria-hidden />
          Every piece has a funnel stage — new content inherits its idea&apos;s stage, so the mix stays honest.
        </p>
      )}
    </SectionCard>
  )
}
