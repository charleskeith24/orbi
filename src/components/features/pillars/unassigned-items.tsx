"use client"

import { CircleCheck, WandSparkles } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { PillarBadge, PlatformIcon, SectionCard, StageBadge } from "@/components/common"
import { funnelGoalMessages } from "@/components/common/messages"
import { Button } from "@/components/ui/button"
import { FUNNEL_STAGE_IDS, FUNNEL_STAGES } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useLookup, useTable } from "@/lib/store"
import type { ContentItem, FunnelStage } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { funnelMessages } from "./funnel-messages"
import { sortForAssignment, suggestFunnelStage } from "./funnel-utils"
import { pillarMessages } from "./pillar-messages"

const PAGE_SIZE = 8

/** Content items without a funnel stage, with one-click assignment and suggestions from each item's idea or goal. */
export function UnassignedItems() {
  const t = useT(funnelMessages)
  const p = useT(pillarMessages)
  const c = useT(commonMessages)
  const goal = useT(funnelGoalMessages)
  const lang = useUiLang()
  const items = useTable("content_items")
  const ideas = useLookup("content_ideas")
  const goals = useLookup("content_goals")
  const [expanded, setExpanded] = useState(false)

  const rows = useMemo(
    () =>
      sortForAssignment(items.filter((i) => !i.funnel_stage)).map((item) => ({
        item,
        suggestion: suggestFunnelStage(item, ideas, goals, lang),
      })),
    [items, ideas, goals, lang]
  )
  const suggested = rows.flatMap((r) => (r.suggestion ? [{ id: r.item.id, patch: { funnel_stage: r.suggestion.stage } }] : []))
  const visible = expanded ? rows : rows.slice(0, PAGE_SIZE)

  function assign(item: ContentItem, stage: FunnelStage) {
    dataActions.update("content_items", item.id, { funnel_stage: stage })
    toast.success(t("assigned_to", { label: FUNNEL_STAGES[stage].label, name: FUNNEL_STAGES[stage].name }), {
      description: item.title || p("untitled_content"),
      action: { label: t("undo"), onClick: () => dataActions.update("content_items", item.id, { funnel_stage: null }) },
    })
  }

  function applySuggestions() {
    if (!suggested.length) return
    dataActions.updateMany("content_items", suggested)
    toast.success(t.plural("pieces_assigned", suggested.length, { count: formatNumber(suggested.length) }), {
      description: t("assigned_description"),
      action: {
        label: t("undo"),
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
      title={t("unassigned_title")}
      description={rows.length ? t.plural("unassigned_description", rows.length, { count: formatNumber(rows.length) }) : undefined}
      action={
        suggested.length ? (
          <Button type="button" size="sm" variant="outline" onClick={applySuggestions}>
            <WandSparkles className="text-brand" aria-hidden />
            {t.plural("apply_suggestions", suggested.length)}
          </Button>
        ) : null
      }
      contentClassName={rows.length ? "p-0" : undefined}
    >
      {rows.length ? (
        <>
          <ul className="divide-y border-t">
            {visible.map(({ item, suggestion }) => {
              const title = item.title || p("untitled_content")
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
                          {t("suggested")} <span className="font-medium text-foreground">{FUNNEL_STAGES[suggestion.stage].label}</span> ·{" "}
                          {suggestion.reason}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div role="group" aria-label={t("assign_group_aria", { title })} className="flex shrink-0 gap-1">
                    {FUNNEL_STAGE_IDS.map((stage) => {
                      const isSuggested = suggestion?.stage === stage
                      return (
                        <Button
                          key={stage}
                          type="button"
                          size="xs"
                          variant="outline"
                          title={`${FUNNEL_STAGES[stage].name} — ${goal(stage)}`}
                          aria-label={t(isSuggested ? "assign_suggested" : "assign", { label: FUNNEL_STAGES[stage].label })}
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
                {expanded ? c("show_less") : t("show_all", { count: rows.length })}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-good-fg">
          <CircleCheck className="size-3.5 shrink-0" aria-hidden />
          {t("all_assigned")}
        </p>
      )}
    </SectionCard>
  )
}
