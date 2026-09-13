"use client"

import { Gauge, Pencil, Quote } from "lucide-react"
import {
  catVar,
  DefinitionList,
  EntityTagEditor,
  KeyValue,
  Meter,
  PersonaBadge,
  PillarBadge,
  PlatformLabel,
  SectionCard,
  StatusPill,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { BUFFER_STAGES, GOAL_CATEGORIES, PUBLISHED_STAGES } from "@/lib/constants"
import { contentItemDate } from "@/lib/dates"
import { useRow } from "@/lib/store"
import type { ContentCampaign } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { timeLabel, type CampaignSummary } from "./campaign-utils"

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold num">{formatNumber(value)}</span>
    </div>
  )
}

/** Pieces vs target (with today's even-pace tick), time elapsed and where planned work sits. */
export function CampaignProgressCard({ summary, className }: { summary: CampaignSummary; className?: string }) {
  const { campaign, perf, window: win, pace } = summary
  const target = perf.targetPosts
  const unpublished = perf.items.filter((i) => !PUBLISHED_STAGES.includes(i.stage))
  const ready = unpublished.filter((i) => BUFFER_STAGES.includes(i.stage)).length
  const undated = unpublished.filter((i) => !contentItemDate(i)).length

  return (
    <SectionCard title="Progress" icon={Gauge} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Pieces published</span>
            {pace ? (
              <StatusPill tone={pace.tone} title={pace.detail}>
                {pace.label}
              </StatusPill>
            ) : null}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl leading-8 font-semibold tracking-tight num">{formatNumber(perf.published)}</span>
            <span className="text-sm text-muted-foreground num">{target ? `/ ${formatNumber(target)} target` : "published"}</span>
          </div>
          {target ? (
            <div title={pace?.expected ? `The tick marks the ${pace.expected} pieces an even pace would have live today.` : undefined}>
              <Meter
                value={perf.published}
                max={target}
                color={campaign.color}
                target={pace?.expected ?? undefined}
                aria-label="Pieces published vs target"
                valueText={`${perf.published} of ${target} published`}
              />
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {pace?.detail ?? `${formatNumber(perf.planned)} planned · add a target post count to track pace`}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Time elapsed</span>
            <span className="font-medium num">{win.elapsedPct === null ? "—" : `${Math.round(win.elapsedPct)}%`}</span>
          </div>
          <Meter value={win.elapsedPct ?? 0} tone="neutral" size="sm" aria-label="Campaign time elapsed" valueText={timeLabel(win)} />
          <p className="text-xs text-muted-foreground">{timeLabel(win)}</p>
        </div>

        <div className="grid grid-cols-3 divide-x rounded-md border">
          <MiniStat label="In production" value={unpublished.length - ready} />
          <MiniStat label="Ready / sched." value={ready} />
          <MiniStat label="No date" value={undated} />
        </div>
      </div>
    </SectionCard>
  )
}

function GoalValue({ goalId }: { goalId: string | null }) {
  const goal = useRow("content_goals", goalId)
  if (!goal) return null
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
      <span className="text-pretty">{goal.name}</span>
      <span className="text-xs text-muted-foreground">{GOAL_CATEGORIES[goal.category]?.label}</span>
    </span>
  )
}

/** The strategic brief of the campaign: message, objective, audience, pillar, goal, platforms, tags. */
export function CampaignAboutCard({
  campaign,
  onEdit,
  className,
}: {
  campaign: ContentCampaign
  onEdit: () => void
  className?: string
}) {
  return (
    <SectionCard
      title="Message & objective"
      icon={Quote}
      className={className}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil aria-hidden />
          Edit
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {campaign.message ? (
          <blockquote
            className="border-l-2 py-0.5 pl-3 text-sm leading-6 font-medium text-pretty"
            style={{ borderColor: catVar(campaign.color) }}
          >
            {campaign.message}
          </blockquote>
        ) : (
          <p className="text-sm text-muted-foreground">
            No campaign message yet — the one idea every piece should reinforce.{" "}
            <button type="button" onClick={onEdit} className="font-medium text-foreground underline-offset-4 hover:underline">
              Add a message
            </button>
          </p>
        )}
        <DefinitionList>
          <KeyValue label="Objective">
            {campaign.objective ? <span className="text-pretty">{campaign.objective}</span> : null}
          </KeyValue>
          <KeyValue label="Description">
            {campaign.description ? <span className={cn("text-pretty text-muted-foreground")}>{campaign.description}</span> : null}
          </KeyValue>
          <KeyValue label="Audience">
            <PersonaBadge personaId={campaign.persona_id} />
          </KeyValue>
          <KeyValue label="Primary pillar">
            <PillarBadge pillarId={campaign.pillar_id} />
          </KeyValue>
          <KeyValue label="Goal">{campaign.goal_id ? <GoalValue goalId={campaign.goal_id} /> : null}</KeyValue>
          <KeyValue label="Platforms">
            {campaign.platforms.length ? (
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {campaign.platforms.map((p) => (
                  <PlatformLabel key={p} platform={p} className="text-sm" />
                ))}
              </span>
            ) : null}
          </KeyValue>
          <KeyValue label="Tags">
            <EntityTagEditor entityType="content_campaigns" entityId={campaign.id} />
          </KeyValue>
        </DefinitionList>
      </div>
    </SectionCard>
  )
}
