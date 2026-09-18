"use client"

import { Info, Lightbulb, Sparkles, Trash2 } from "lucide-react"
import Link from "next/link"
import { useId, useMemo } from "react"
import { toast } from "sonner"
import { DetailSheet, FormField, InlineText, PlatformIcon, StageBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatMultiple, type GroupAggregate } from "@/lib/analytics"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useLookup, useTable } from "@/lib/store"
import type { ContentAngle, ContentIdea, ContentItem } from "@/lib/types"
import { formatNumber, formatPercent } from "@/lib/utils"
import { angleMessages } from "./angle-messages"
import { ANGLE_NAME_MAX, generatorHref, validateAngleName, type AngleStats } from "./angle-model"
import { MiniStat } from "./hook-detail-sheet"
import { formatHookMetric } from "./hook-model"
import { labMessages } from "./messages"

const LIST_LIMIT = 8

/** `/ideas/angles?open=<id>` — edit the angle, see its ideas, content and results. */
export function AngleDetailSheet({
  angle,
  open,
  onOpenChange,
  stats,
  overall,
  onDelete,
}: {
  angle: ContentAngle | null
  open: boolean
  onOpenChange: (open: boolean) => void
  stats: AngleStats
  overall: GroupAggregate
  onDelete: (angle: ContentAngle) => void
}) {
  const angles = useTable("angles")
  const t = useT(angleMessages)
  const c = useT(commonMessages)
  const lang = useUiLang()
  if (!angle) return null
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="md"
      title={
        <InlineText
          value={angle.name}
          required
          maxLength={ANGLE_NAME_MAX}
          placeholder={t("untitled_angle")}
          aria-label={t("angle_name")}
          className="text-base leading-6 font-semibold"
          onSave={(name) => {
            const error = validateAngleName(name, angles, angle.id, lang)
            if (error) {
              toast.error(t("name_not_saved"), { description: error })
              return
            }
            dataActions.update("angles", angle.id, { name: name.replace(/\s+/g, " ").trim() })
          }}
        />
      }
      description={t("sheet_description", {
        kind: angle.is_default ? t("kind_default") : t("kind_custom"),
        ideas: t.plural("ideas", stats.ideaIds.length, { count: formatNumber(stats.ideaIds.length) }),
        pieces: t.plural("pieces", stats.itemIds.length, { count: formatNumber(stats.itemIds.length) }),
      })}
      footer={
        <>
          {angle.is_default ? null : (
            <Button type="button" variant="ghost" size="sm" className="mr-auto text-destructive hover:text-destructive" onClick={() => onDelete(angle)}>
              <Trash2 aria-hidden />
              {c("delete")}
            </Button>
          )}
          <Button type="button" size="sm" asChild>
            <Link href={generatorHref(angle.id)}>
              <Sparkles aria-hidden />
              {t("generate_with")}
            </Link>
          </Button>
        </>
      }
    >
      <AngleSheetBody key={angle.id} angle={angle} stats={stats} overall={overall} />
    </DetailSheet>
  )
}

function AngleSheetBody({ angle, stats, overall }: { angle: ContentAngle; stats: AngleStats; overall: GroupAggregate }) {
  const id = useId()
  const t = useT(angleMessages)
  const l = useT(labMessages)
  const ideas = useLookup("content_ideas")
  const items = useLookup("content_items")
  const linkedIdeas = useMemo(() => stats.ideaIds.map((ideaId) => ideas.get(ideaId)).filter((idea): idea is ContentIdea => Boolean(idea)), [stats.ideaIds, ideas])
  const linkedItems = useMemo(() => stats.itemIds.map((itemId) => items.get(itemId)).filter((item): item is ContentItem => Boolean(item)), [stats.itemIds, items])
  const performance = stats.performance && stats.performance.measured > 0 ? stats.performance : null
  const hidden = Math.max(0, linkedItems.length - LIST_LIMIT) + Math.max(0, linkedIdeas.length - LIST_LIMIT)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="flex min-w-0 flex-col gap-4">
        <FormField label={t("description_label")} description={t("description_help")}>
          <InlineText
            value={angle.description}
            multiline
            maxLength={500}
            placeholder={t("description_placeholder_sheet")}
            aria-label={t("description_label")}
            onSave={(description) => dataActions.update("angles", angle.id, { description })}
          />
        </FormField>
        <FormField label={t("example")}>
          <InlineText
            value={angle.example}
            multiline
            maxLength={300}
            placeholder={t("example_placeholder_sheet")}
            aria-label={t("example")}
            onSave={(example) => dataActions.update("angles", angle.id, { example })}
          />
        </FormField>
        {angle.is_default ? (
          <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-pretty text-muted-foreground dark:bg-muted/15">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{t("default_note")}</span>
          </p>
        ) : null}
      </section>

      <section aria-labelledby={`${id}-performance`} className="flex min-w-0 flex-col gap-3">
        <h3 id={`${id}-performance`} className="text-sm font-medium">
          {l("performance")}
        </h3>
        {performance ? (
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
                <Link href={`/studio/${item.id}`} className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50">
                  <PlatformIcon platform={item.platform} className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.title || l("untitled_content")}</span>
                  <StageBadge stage={item.stage} />
                </Link>
              </li>
            ))}
            {linkedIdeas.slice(0, LIST_LIMIT).map((idea) => (
              <li key={idea.id}>
                <Link href={`/ideas?open=${idea.id}`} className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50">
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
