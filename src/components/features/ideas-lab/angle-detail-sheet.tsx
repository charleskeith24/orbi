"use client"

import { Info, Lightbulb, Sparkles, Trash2 } from "lucide-react"
import Link from "next/link"
import { useId, useMemo } from "react"
import { toast } from "sonner"
import { DetailSheet, FormField, InlineText, PlatformIcon, StageBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatMultiple, type GroupAggregate } from "@/lib/analytics"
import { dataActions, useLookup, useTable } from "@/lib/store"
import type { ContentAngle, ContentIdea, ContentItem } from "@/lib/types"
import { formatNumber, formatPercent, pluralize } from "@/lib/utils"
import { ANGLE_NAME_MAX, DEFAULT_ANGLE_NOTE, generatorHref, validateAngleName, type AngleStats } from "./angle-model"
import { MiniStat } from "./hook-detail-sheet"
import { formatHookMetric } from "./hook-model"

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
          placeholder="Untitled angle"
          aria-label="Angle name"
          className="text-base leading-6 font-semibold"
          onSave={(name) => {
            const error = validateAngleName(name, angles, angle.id)
            if (error) {
              toast.error("Name not saved", { description: error })
              return
            }
            dataActions.update("angles", angle.id, { name: name.replace(/\s+/g, " ").trim() })
          }}
        />
      }
      description={`${angle.is_default ? "Default" : "Custom"} angle · ${pluralize(stats.ideaIds.length, "idea")} · ${pluralize(stats.itemIds.length, "content piece")}`}
      footer={
        <>
          {angle.is_default ? null : (
            <Button type="button" variant="ghost" size="sm" className="mr-auto text-destructive hover:text-destructive" onClick={() => onDelete(angle)}>
              <Trash2 aria-hidden />
              Delete
            </Button>
          )}
          <Button type="button" size="sm" asChild>
            <Link href={generatorHref(angle.id)}>
              <Sparkles aria-hidden />
              Generate ideas with this angle
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
  const ideas = useLookup("content_ideas")
  const items = useLookup("content_items")
  const linkedIdeas = useMemo(() => stats.ideaIds.map((ideaId) => ideas.get(ideaId)).filter((idea): idea is ContentIdea => Boolean(idea)), [stats.ideaIds, ideas])
  const linkedItems = useMemo(() => stats.itemIds.map((itemId) => items.get(itemId)).filter((item): item is ContentItem => Boolean(item)), [stats.itemIds, items])
  const performance = stats.performance && stats.performance.measured > 0 ? stats.performance : null
  const hidden = Math.max(0, linkedItems.length - LIST_LIMIT) + Math.max(0, linkedIdeas.length - LIST_LIMIT)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="flex min-w-0 flex-col gap-4">
        <FormField label="Description" description="What the angle does — the AI uses the name; you use this. Click to edit.">
          <InlineText
            value={angle.description}
            multiline
            maxLength={500}
            placeholder="What this angle does to a topic…"
            aria-label="Description"
            onSave={(description) => dataActions.update("angles", angle.id, { description })}
          />
        </FormField>
        <FormField label="Example">
          <InlineText
            value={angle.example}
            multiline
            maxLength={300}
            placeholder="A title written in this angle…"
            aria-label="Example"
            onSave={(example) => dataActions.update("angles", angle.id, { example })}
          />
        </FormField>
        {angle.is_default ? (
          <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-pretty text-muted-foreground dark:bg-muted/15">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{DEFAULT_ANGLE_NOTE}</span>
          </p>
        ) : null}
      </section>

      <section aria-labelledby={`${id}-performance`} className="flex min-w-0 flex-col gap-3">
        <h3 id={`${id}-performance`} className="text-sm font-medium">
          Performance
        </h3>
        {performance ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniStat label="Posts" value={formatNumber(performance.posts)} sub={`${formatNumber(performance.measured)} with analytics`} />
            <MiniStat
              label="Avg views"
              value={formatHookMetric(performance.avgViews, "views")}
              sub={overall.avgViews && performance.avgViews ? `${formatMultiple(performance.avgViews / overall.avgViews)} your average` : undefined}
            />
            <MiniStat
              label="Engagement"
              value={formatHookMetric(performance.engagementRate, "engagement")}
              sub={overall.engagementRate !== null ? `Average ${formatPercent(overall.engagementRate)}` : undefined}
            />
            <MiniStat label="Leads / post" value={formatHookMetric(performance.leadsPerPost, "leads")} />
            <MiniStat label="Winners" value={formatNumber(performance.winners)} sub="Winner or Breakout" />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-pretty text-muted-foreground">
            No published posts with analytics use this angle yet. Generate ideas with it, publish, and log analytics to see how it lands.
          </p>
        )}
      </section>

      <section aria-labelledby={`${id}-used`} className="flex min-w-0 flex-col gap-2">
        <h3 id={`${id}-used`} className="text-sm font-medium">
          Used in
        </h3>
        {linkedItems.length || linkedIdeas.length ? (
          <ul className="flex min-w-0 flex-col divide-y rounded-lg border">
            {linkedItems.slice(0, LIST_LIMIT).map((item) => (
              <li key={item.id}>
                <Link href={`/studio/${item.id}`} className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50">
                  <PlatformIcon platform={item.platform} className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.title || "Untitled content"}</span>
                  <StageBadge stage={item.stage} />
                </Link>
              </li>
            ))}
            {linkedIdeas.slice(0, LIST_LIMIT).map((idea) => (
              <li key={idea.id}>
                <Link href={`/ideas?open=${idea.id}`} className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50">
                  <Lightbulb className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{idea.title || "Untitled idea"}</span>
                  <span className="text-xs text-muted-foreground">Idea</span>
                </Link>
              </li>
            ))}
            {hidden ? <li className="px-3 py-2 text-xs text-muted-foreground">and {formatNumber(hidden)} more</li> : null}
          </ul>
        ) : (
          <p className="text-sm text-pretty text-muted-foreground">Not used yet — generate ideas with it to try it out.</p>
        )}
      </section>
    </div>
  )
}
