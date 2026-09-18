"use client"

import { Lightbulb, Trash2 } from "lucide-react"
import Link from "next/link"
import { useId, useMemo } from "react"
import {
  DetailSheet,
  FormField,
  FormRow,
  HookCategorySelect,
  InlineText,
  PillarSelect,
  PlatformIcon,
  StageBadge,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatMultiple, type GroupAggregate } from "@/lib/analytics"
import { HOOK_CATEGORIES } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useLookup } from "@/lib/store"
import type { ContentIdea, ContentItem, Hook } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"
import { hookMessages } from "./hook-messages"
import { countBlanks, formatHookMetric, type HookStats } from "./hook-model"
import { FavoriteButton, HookMenu } from "./hook-row"
import { HookText } from "./hook-text"
import { labMessages } from "./messages"

const LIST_LIMIT = 8

/** `/ideas/hooks?open=<id>` — edit the hook, see where it was used and how those posts performed. */
export function HookDetailSheet({
  hook,
  open,
  onOpenChange,
  stats,
  overall,
  onUse,
  onDuplicate,
  onDelete,
}: {
  hook: Hook | null
  open: boolean
  onOpenChange: (open: boolean) => void
  stats: HookStats
  overall: GroupAggregate
  onUse: (hook: Hook) => void
  onDuplicate: (hook: Hook) => void
  onDelete: (hook: Hook) => void
}) {
  const t = useT(hookMessages)
  const c = useT(commonMessages)
  if (!hook) return null
  const template = countBlanks(hook.text) > 0
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="md"
      title={<HookText text={hook.text || t("untitled_hook")} />}
      description={t(template ? "sheet_description_template" : "sheet_description", {
        category: HOOK_CATEGORIES[hook.category]?.label ?? "Custom",
        source: t(`source_${hook.source}`),
        date: formatDate(hook.created_at, "MMM d, yyyy"),
      })}
      actions={
        <>
          <FavoriteButton hook={hook} className="size-7" />
          <HookMenu hook={hook} onDuplicate={onDuplicate} onDelete={onDelete} className="size-7" />
        </>
      }
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" className="mr-auto text-destructive hover:text-destructive" onClick={() => onDelete(hook)}>
            <Trash2 aria-hidden />
            {c("delete")}
          </Button>
          <Button type="button" size="sm" onClick={() => onUse(hook)}>
            <Lightbulb aria-hidden />
            {t("use_hook")}
          </Button>
        </>
      }
    >
      <HookSheetBody key={hook.id} hook={hook} stats={stats} overall={overall} />
    </DetailSheet>
  )
}

export function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border bg-card px-3 py-2.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="text-lg leading-6 font-semibold num">{value}</span>
      {sub ? <span className="truncate text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

function HookSheetBody({ hook, stats, overall }: { hook: Hook; stats: HookStats; overall: GroupAggregate }) {
  const id = useId()
  const t = useT(hookMessages)
  const l = useT(labMessages)
  const items = useLookup("content_items")
  const ideas = useLookup("content_ideas")
  const linkedItems = useMemo(() => stats.itemIds.map((itemId) => items.get(itemId)).filter((item): item is ContentItem => Boolean(item)), [stats.itemIds, items])
  const linkedIdeas = useMemo(() => stats.ideaIds.map((ideaId) => ideas.get(ideaId)).filter((idea): idea is ContentIdea => Boolean(idea)), [stats.ideaIds, ideas])
  const performance = stats.performance
  const hidden = Math.max(0, linkedItems.length - LIST_LIMIT) + Math.max(0, linkedIdeas.length - LIST_LIMIT)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="flex min-w-0 flex-col gap-4">
        <FormField label={t("hook")} description={t("hook_help")}>
          <InlineText
            value={hook.text}
            multiline
            required
            maxLength={300}
            placeholder={t("write_hook")}
            aria-label={t("hook_text")}
            onSave={(text) => {
              const clean = text.replace(/\s+/g, " ").trim()
              dataActions.update("hooks", hook.id, { text: clean, is_template: countBlanks(clean) > 0 })
            }}
          />
        </FormField>
        <FormRow>
          <FormField label={t("hook_style")} htmlFor={`${id}-style`}>
            <HookCategorySelect
              id={`${id}-style`}
              value={hook.category}
              onChange={(category) => {
                if (category) dataActions.update("hooks", hook.id, { category })
              }}
            />
          </FormField>
          <FormField label={t("content_pillar")} htmlFor={`${id}-pillar`}>
            <PillarSelect id={`${id}-pillar`} allowNone value={hook.pillar_id} onChange={(pillar_id) => dataActions.update("hooks", hook.id, { pillar_id })} />
          </FormField>
        </FormRow>
        <FormField label={t("notes")}>
          <InlineText
            value={hook.notes}
            multiline
            maxLength={1000}
            placeholder={t("notes_placeholder_sheet")}
            aria-label={t("notes")}
            onSave={(notes) => dataActions.update("hooks", hook.id, { notes })}
          />
        </FormField>
      </section>

      <section aria-labelledby={`${id}-performance`} className="flex min-w-0 flex-col gap-3">
        <h3 id={`${id}-performance`} className="text-sm font-medium">
          {l("performance")}
        </h3>
        {performance && performance.measured > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniStat label={l("posts")} value={formatNumber(performance.posts)} sub={l("with_analytics", { count: formatNumber(performance.measured) })} />
            <MiniStat
              label={l("avg_views")}
              value={formatHookMetric(performance.avgViews, "views")}
              sub={
                overall.avgViews && performance.avgViews
                  ? l("vs_average", { multiple: formatMultiple(performance.avgViews / overall.avgViews) })
                  : undefined
              }
            />
            <MiniStat
              label={l("engagement")}
              value={formatHookMetric(performance.engagementRate, "engagement")}
              sub={overall.engagementRate !== null ? l("average_rate", { rate: formatPercent(overall.engagementRate) }) : undefined}
            />
            <MiniStat label={l("leads_per_post")} value={formatHookMetric(performance.leadsPerPost, "leads")} />
            <MiniStat label={l("retention")} value={formatHookMetric(performance.avgRetention, "retention")} />
            <MiniStat label={l("winners")} value={formatNumber(performance.winners)} sub={l("winner_or_breakout")} />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-pretty text-muted-foreground">
            {t("no_performance")}
          </p>
        )}
      </section>

      <section aria-labelledby={`${id}-used`} className="flex min-w-0 flex-col gap-2">
        <h3 id={`${id}-used`} className="text-sm font-medium">
          {l("used_in")}
        </h3>
        {linkedItems.length || linkedIdeas.length ? (
          <ul className="flex min-w-0 flex-col divide-y rounded-lg border">
            {linkedItems.slice(0, LIST_LIMIT).map((item) => (
              <li key={item.id}>
                <Link
                  href={`/studio/${item.id}`}
                  className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                >
                  <PlatformIcon platform={item.platform} className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.title || l("untitled_content")}</span>
                  <StageBadge stage={item.stage} />
                </Link>
              </li>
            ))}
            {linkedIdeas.slice(0, LIST_LIMIT).map((idea) => (
              <li key={idea.id}>
                <Link
                  href={`/ideas?open=${idea.id}`}
                  className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                >
                  <Lightbulb className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{idea.title || l("untitled_idea")}</span>
                  <span className="text-xs text-muted-foreground">{l("idea")}</span>
                </Link>
              </li>
            ))}
            {hidden ? <li className="px-3 py-2 text-xs text-muted-foreground">{l("and_more", { count: formatNumber(hidden) })}</li> : null}
          </ul>
        ) : (
          <p className="text-sm text-pretty text-muted-foreground">{t("not_used")}</p>
        )}
      </section>
    </div>
  )
}
