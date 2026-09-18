"use client"

import { format } from "date-fns"
import { CalendarDays, Columns3, FilePlus2, FileStack, ListPlus, Plus, Unlink } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ContentCard,
  EmptyState,
  PlatformIcon,
  SectionCard,
  StageBadge,
  StageIcon,
  TierBadge,
  ViewToggle,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PIPELINE_STAGE_MAP, PIPELINE_STAGE_ORDER, PUBLISHED_STAGES, STAGE_GROUPS } from "@/lib/constants"
import { contentItemDate, formatDate, startOfWeek, toISODate } from "@/lib/dates"
import { getUiLang, translate, useT, type Translator } from "@/lib/i18n"
import { dataActions, useSettings } from "@/lib/store"
import type { ContentCampaign, ContentItem, ID, PerformanceTier, StageGroup } from "@/lib/types"
import { formatCompact, formatNumber } from "@/lib/utils"
import { campaignDetailMessages } from "./messages"

type PiecesView = "stage" | "date"
type T = Translator<typeof campaignDetailMessages.en>

function unlinkItem(item: ContentItem, campaign: ContentCampaign) {
  dataActions.update("content_items", item.id, { campaign_id: null })
  const lang = getUiLang()
  toast.success(translate(campaignDetailMessages, lang, "removed"), {
    description: item.title || undefined,
    action: {
      label: translate(campaignDetailMessages, lang, "undo"),
      onClick: () => dataActions.update("content_items", item.id, { campaign_id: campaign.id }),
    },
  })
}

function UnlinkButton({ item, campaign }: { item: ContentItem; campaign: ContentCampaign }) {
  const t = useT(campaignDetailMessages)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          aria-label={t("remove_aria", { title: item.title || t("untitled_content") })}
          onClick={() => unlinkItem(item, campaign)}
        >
          <Unlink aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("remove_tooltip")}</TooltipContent>
    </Tooltip>
  )
}

interface DatedItem {
  item: ContentItem
  date: Date | null
}

function byStage(items: ContentItem[]): { group: StageGroup; label: string; items: ContentItem[] }[] {
  return STAGE_GROUPS.map((g) => ({
    group: g.id,
    label: g.label,
    items: items
      .filter((i) => PIPELINE_STAGE_MAP[i.stage]?.group === g.id)
      .sort(
        (a, b) =>
          PIPELINE_STAGE_ORDER[a.stage] - PIPELINE_STAGE_ORDER[b.stage] ||
          (contentItemDate(a)?.getTime() ?? Infinity) - (contentItemDate(b)?.getTime() ?? Infinity)
      ),
  })).filter((g) => g.items.length)
}

function byWeek(items: ContentItem[], weekStartsOn: 0 | 1, now: Date, t: T): { key: string; label: string; items: DatedItem[] }[] {
  const thisWeek = toISODate(startOfWeek(now, weekStartsOn))
  const groups = new Map<string, DatedItem[]>()
  const undated: DatedItem[] = []
  for (const item of items) {
    const date = contentItemDate(item)
    if (!date) {
      undated.push({ item, date })
      continue
    }
    const key = toISODate(startOfWeek(date, weekStartsOn))
    const list = groups.get(key)
    if (list) list.push({ item, date })
    else groups.set(key, [{ item, date }])
  }
  const out = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({
      key,
      label: key === thisWeek ? t("this_week_of", { date: formatDate(key, "MMM d") }) : t("week_of", { date: formatDate(key, "MMM d") }),
      items: list.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0)),
    }))
  if (undated.length) out.push({ key: "undated", label: t("no_date_yet"), items: undated })
  return out
}

function PieceRow({
  entry,
  tier,
  campaign,
}: {
  entry: DatedItem
  tier: PerformanceTier | null
  campaign: ContentCampaign
}) {
  const t = useT(campaignDetailMessages)
  const { item, date } = entry
  const published = PUBLISHED_STAGES.includes(item.stage)
  return (
    <li className="flex min-w-0 items-center gap-3 py-2">
      <span className="w-14 shrink-0 text-xs text-muted-foreground num">{date ? format(date, "EEE d") : "—"}</span>
      <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
      <Link
        href={`/studio/${item.id}`}
        className="min-w-0 flex-1 truncate text-sm outline-none hover:underline focus-visible:underline"
        title={item.title}
      >
        {item.title || t("untitled_content")}
      </Link>
      {published ? <TierBadge tier={tier} /> : null}
      <StageBadge stage={item.stage} className="hidden sm:inline-flex" />
      <UnlinkButton item={item} campaign={campaign} />
    </li>
  )
}

/** Content Pieces: every item with this campaign, grouped by pipeline stage or by week. */
export function CampaignPieces({
  campaign,
  items,
  tiers,
  views,
  now,
  onAddExisting,
  onNewContent,
  className,
}: {
  campaign: ContentCampaign
  items: ContentItem[]
  tiers: Map<ID, PerformanceTier>
  views: Map<ID, number>
  now: Date
  onAddExisting: () => void
  onNewContent: () => void
  className?: string
}) {
  const settings = useSettings()
  const t = useT(campaignDetailMessages)
  const [view, setView] = useState<PiecesView>("stage")
  const stageGroups = useMemo(() => byStage(items), [items])
  const weekGroups = useMemo(() => byWeek(items, settings.week_starts_on, now, t), [items, settings.week_starts_on, now, t])
  const published = items.filter((i) => PUBLISHED_STAGES.includes(i.stage)).length
  const pieces = (count: number) => t.plural("pieces", count, { count: formatNumber(count) })
  const viewOptions = [
    { value: "stage" as const, label: t("by_stage"), icon: Columns3 },
    { value: "date" as const, label: t("by_date"), icon: CalendarDays },
  ]

  return (
    <SectionCard
      className={className}
      title={t("pieces_title")}
      description={
        items.length
          ? t("pieces_description", { pieces: pieces(items.length), published, planned: items.length - published })
          : t("pieces_description_empty")
      }
      action={
        items.length ? (
          <>
            <ViewToggle value={view} onChange={setView} options={viewOptions} aria-label={t("group_pieces")} />
            <Button type="button" variant="outline" size="sm" onClick={onAddExisting}>
              <ListPlus aria-hidden />
              <span className="hidden sm:inline">{t("add_existing")}</span>
              <span className="sr-only sm:hidden">{t("add_existing_sr")}</span>
            </Button>
          </>
        ) : undefined
      }
    >
      {!items.length ? (
        <EmptyState
          compact
          icon={FileStack}
          title={t("pieces_empty_title")}
          description={t("pieces_empty_description")}
          action={
            <Button type="button" size="sm" onClick={onNewContent}>
              <Plus aria-hidden />
              {t("new_content")}
            </Button>
          }
          secondaryAction={
            <Button type="button" size="sm" variant="outline" onClick={onAddExisting}>
              <ListPlus aria-hidden />
              {t("add_existing")}
            </Button>
          }
        />
      ) : view === "stage" ? (
        <div className="flex flex-col gap-5">
          {stageGroups.map((group) => (
            <section key={group.group} aria-label={t("group_aria", { label: group.label, count: group.items.length })} className="flex flex-col gap-2">
              <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <StageIcon stage={group.items[0].stage} />
                {group.label}
                <span className="num">{group.items.length}</span>
              </h4>
              <div className="grid gap-2 md:grid-cols-2">
                {group.items.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    compact
                    href={`/studio/${item.id}`}
                    tier={tiers.get(item.id) ?? null}
                    now={now}
                    actions={<UnlinkButton item={item} campaign={campaign} />}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {weekGroups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h4 className="flex items-center justify-between gap-2 border-b pb-1.5 text-xs font-medium text-muted-foreground">
                <span>{group.label}</span>
                <span className="num">
                  {pieces(group.items.length)}
                  {group.items.some((e) => views.has(e.item.id))
                    ? t("views_suffix", { count: formatCompact(group.items.reduce((acc, e) => acc + (views.get(e.item.id) ?? 0), 0)) })
                    : ""}
                </span>
              </h4>
              <ul className="divide-y divide-border/60">
                {group.items.map((entry) => (
                  <PieceRow key={entry.item.id} entry={entry} tier={tiers.get(entry.item.id) ?? null} campaign={campaign} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {items.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
          <Button type="button" size="sm" variant="ghost" onClick={onNewContent}>
            <FilePlus2 aria-hidden />
            {t("new_content_in_campaign")}
          </Button>
        </div>
      ) : null}
    </SectionCard>
  )
}
