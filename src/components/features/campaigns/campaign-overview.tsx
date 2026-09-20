"use client"

import { Pencil } from "lucide-react"
import {
  catVar,
  DefinitionList,
  Disclosure,
  EntityTagEditor,
  InfoHint,
  KeyValue,
  Meter,
  PersonaBadge,
  PillarBadge,
  PlatformIcon,
  SectionCard,
  StatusPill,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { BUFFER_STAGES, GOAL_CATEGORIES, PUBLISHED_STAGES } from "@/lib/constants"
import { contentItemDate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useRow } from "@/lib/store"
import type { ContentCampaign } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { timeLabel, type CampaignSummary } from "./campaign-utils"
import { campaignDetailMessages } from "./messages"

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3 first:pl-0">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold num">{formatNumber(value)}</span>
    </div>
  )
}

/**
 * Pieces vs target (with today's even-pace tick; pace detail in the ⓘ), time elapsed (the day count is in the page
 * subtitle) and where planned work sits.
 */
export function CampaignProgressCard({ summary, className }: { summary: CampaignSummary; className?: string }) {
  const t = useT(campaignDetailMessages)
  const lang = useUiLang()
  const { campaign, perf, window: win, pace } = summary
  const target = perf.targetPosts
  const unpublished = perf.items.filter((i) => !PUBLISHED_STAGES.includes(i.stage))
  const ready = unpublished.filter((i) => BUFFER_STAGES.includes(i.stage)).length
  const undated = unpublished.filter((i) => !contentItemDate(i)).length

  return (
    <SectionCard title={t("progress")} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              {t("pieces_published")}
              {pace ? (
                <InfoHint title={pace.label}>
                  <p>{pace.detail}</p>
                  {pace.expected ? <p>{t("tick_hint", { count: pace.expected })}</p> : null}
                </InfoHint>
              ) : null}
            </span>
            {pace ? (
              <StatusPill tone={pace.tone} title={pace.detail}>
                {pace.label}
              </StatusPill>
            ) : null}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl leading-8 font-semibold tracking-tight num">{formatNumber(perf.published)}</span>
            <span className="text-sm text-muted-foreground num">{target ? t("target_suffix", { target: formatNumber(target) }) : t("published_lower")}</span>
          </div>
          {target ? (
            <Meter
              value={perf.published}
              max={target}
              color={campaign.color}
              target={pace?.expected ?? undefined}
              aria-label={t("pieces_vs_target")}
              valueText={t("published_of", { published: perf.published, target })}
            />
          ) : null}
          {pace ? null : <p className="text-xs text-muted-foreground">{t("planned_add_target", { count: formatNumber(perf.planned) })}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{t("time_elapsed")}</span>
            <span className="font-medium num">{win.elapsedPct === null ? "—" : `${Math.round(win.elapsedPct)}%`}</span>
          </div>
          <Meter value={win.elapsedPct ?? 0} tone="neutral" size="sm" aria-label={t("time_elapsed_aria")} valueText={timeLabel(win, lang)} />
        </div>

        <div className="grid grid-cols-3 divide-x border-t pt-3">
          <MiniStat label={t("mini_production")} value={unpublished.length - ready} />
          <MiniStat label={t("mini_ready")} value={ready} />
          <MiniStat label={t("mini_no_date")} value={undated} />
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
  const t = useT(campaignDetailMessages)
  const c = useT(commonMessages)
  return (
    <SectionCard
      title={t("about_title")}
      className={className}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil aria-hidden />
          {c("edit")}
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
            {t("no_message")}{" "}
            <button type="button" onClick={onEdit} className="font-medium text-foreground underline-offset-4 hover:underline">
              {t("add_message")}
            </button>
          </p>
        )}
        <DefinitionList>
          <KeyValue label={t("objective")}>
            {campaign.objective ? <span className="text-pretty">{campaign.objective}</span> : null}
          </KeyValue>
          <KeyValue label={t("audience")}>
            <PersonaBadge personaId={campaign.persona_id} />
          </KeyValue>
          <KeyValue label={t("primary_pillar")}>
            <PillarBadge pillarId={campaign.pillar_id} />
          </KeyValue>
          <KeyValue label={t("goal")}>{campaign.goal_id ? <GoalValue goalId={campaign.goal_id} /> : null}</KeyValue>
          <KeyValue label={t("platforms")}>
            {campaign.platforms.length ? (
              <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                {campaign.platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} label className="size-4" />
                ))}
              </span>
            ) : null}
          </KeyValue>
          <KeyValue label={t("tags")}>
            <EntityTagEditor entityType="content_campaigns" entityId={campaign.id} />
          </KeyValue>
        </DefinitionList>
        {campaign.description ? (
          <Disclosure label={t("description")}>
            <p className="text-sm text-pretty whitespace-pre-line text-muted-foreground">{campaign.description}</p>
          </Disclosure>
        ) : null}
      </div>
    </SectionCard>
  )
}
