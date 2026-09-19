"use client"

import { AlarmClock, ArrowRight, BellRing, ChartColumn, ExternalLink, Handshake, Megaphone, Pencil, Target } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { ColorDot, DatePicker, DefinitionList, DetailSheet, KeyValue, OptionSelect, PillarBadge, PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { collabResults } from "@/lib/analytics"
import { PLATFORMS, PUBLISHED_STAGES } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { collabStatusDescriptionMessages, collabStatusMessages } from "@/lib/i18n/messages/collabs"
import { dataActions, uiActions, useDb, useRow } from "@/lib/store"
import type { Collab, CollabStatus, UpdateRow } from "@/lib/types"
import { cn, formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import { markFollowedUp, rateCollab, setCollabStatus } from "./collab-actions"
import { CollabActionsMenu } from "./collab-actions-menu"
import { CollabContentSection } from "./collab-content"
import { isFollowUpDue, linkHref } from "./collab-model"
import { CollabPitch } from "./collab-pitch"
import { CollabTypeBadge, RatingInput, useCollabName, useCollabStatusOptions } from "./collab-ui"
import { collabSheetMessages } from "./messages"

/** The next step a footer button offers, per status. */
const NEXT: Partial<Record<CollabStatus, CollabStatus>> = {
  idea: "reached_out",
  reached_out: "agreed",
  agreed: "scheduled",
  scheduled: "published",
}

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className={cn("truncate text-sm font-semibold num", muted && "font-normal text-muted-foreground")}>{value}</span>
    </div>
  )
}

/** Collab detail (`/collabs?open=<id>`): status, partner, details, your posts, outreach, results and notes. */
export function CollabDetailSheet({
  collab,
  open,
  now,
  onOpenChange,
  onEdit,
  onBeforeDelete,
}: {
  collab: Collab | null
  open: boolean
  now: Date
  onOpenChange: (open: boolean) => void
  onEdit: (collab: Collab) => void
  onBeforeDelete: () => void
}) {
  const t = useT(collabSheetMessages)
  const statusLabel = useT(collabStatusMessages)
  const name = useCollabName()
  const next = collab ? NEXT[collab.status] : undefined

  return (
    <DetailSheet
      open={open && Boolean(collab)}
      onOpenChange={onOpenChange}
      width="lg"
      onOpenAutoFocus={(event) => event.preventDefault()}
      title={collab ? name(collab) : ""}
      description={
        collab ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CollabTypeBadge type={collab.type} />
            {collab.partner_platform ? (
              <span className="inline-flex items-center gap-1">
                <PlatformIcon platform={collab.partner_platform} className="size-3.5" />
                {PLATFORMS[collab.partner_platform].label}
              </span>
            ) : null}
            {collab.collab_date ? <span className="num">{formatDate(collab.collab_date, "EEE, MMM d")}</span> : null}
          </span>
        ) : undefined
      }
      actions={
        collab ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(collab)}>
              <Pencil aria-hidden />
              {t("edit")}
            </Button>
            <CollabActionsMenu collab={collab} onEdit={onEdit} onBeforeDelete={onBeforeDelete} />
          </>
        ) : null
      }
      footer={
        collab && next ? (
          <Button type="button" size="sm" onClick={() => setCollabStatus(collab, next, { announce: true })}>
            <ArrowRight aria-hidden />
            {t(`next_${next}` as "next_reached_out")}
          </Button>
        ) : null
      }
    >
      {collab ? <CollabBody collab={collab} now={now} key={collab.id} /> : <p className="text-sm text-muted-foreground">{statusLabel("idea")}</p>}
    </DetailSheet>
  )
}

function CollabBody({ collab, now }: { collab: Collab; now: Date }) {
  const t = useT(collabSheetMessages)
  const statusDescription = useT(collabStatusDescriptionMessages)
  const statusOptions = useCollabStatusOptions()
  const db = useDb()
  const pillar = useRow("content_pillars", collab.pillar_id)
  const goal = useRow("content_goals", collab.goal_id)
  const campaign = useRow("content_campaigns", collab.campaign_id)
  const deal = useRow("brand_deals", collab.brand_deal_id)
  const results = useMemo(() => collabResults(collab, db), [collab, db])
  // The first linked post that's live but has no analytics yet ("Add analytics").
  const unmeasured = useMemo(() => {
    const measured = new Set(db.content_metrics.map((m) => m.content_item_id))
    const live = new Set(db.content_items.filter((i) => PUBLISHED_STAGES.includes(i.stage)).map((i) => i.id))
    return collab.content_item_ids.find((id) => live.has(id) && !measured.has(id)) ?? null
  }, [collab.content_item_ids, db.content_metrics, db.content_items])
  const due = isFollowUpDue(collab, now)
  const href = linkHref(collab.partner_link)
  const hasPartner = Boolean(collab.partner_name || collab.partner_handle || collab.partner_link || collab.partner_platform || collab.partner_niche || collab.partner_followers !== null)
  const update = (patch: UpdateRow<"collabs">) => dataActions.update("collabs", collab.id, patch)
  // Before the collab happens the pitch is the main job; afterwards the results are.
  const early = collab.status === "idea" || collab.status === "reached_out" || collab.status === "agreed"
  const showResults = collab.status === "published" || collab.status === "reviewed" || results.posts > 0 || collab.rating !== null
  const outreach = (
    <Section title={t("outreach")}>
      <CollabPitch collab={collab} />
    </Section>
  )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
          <OptionSelect options={statusOptions} value={collab.status} size="sm" aria-label={t("status")} onChange={(next) => next && setCollabStatus(collab, next)} />
          <p className="text-xs text-pretty text-muted-foreground">{statusDescription(collab.status)}</p>
        </div>
        {collab.status === "reached_out" || (collab.status === "agreed" && collab.follow_up_on) ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-sm",
              due && "border-critical/30 bg-critical/5 dark:bg-critical/10"
            )}
          >
            {due ? <AlarmClock className="size-4 shrink-0 text-critical-fg" aria-hidden /> : <BellRing className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            <span className={cn("min-w-0 flex-1", due && "font-medium text-critical-fg")}>
              {collab.follow_up_on ? (due ? t("follow_up_due", { date: formatDate(collab.follow_up_on, "EEE, MMM d") }) : t("follow_up_on", { date: formatDate(collab.follow_up_on, "EEE, MMM d") })) : t("follow_up_none")}
            </span>
            <Button type="button" variant="outline" size="xs" onClick={() => markFollowedUp(collab, now)}>
              <BellRing aria-hidden />
              {t("followed_up")}
            </Button>
          </div>
        ) : null}
      </div>

      <Section title={t("partner")}>
        {hasPartner ? (
          <DefinitionList>
            <KeyValue label={t("partner_name")}>{collab.partner_name || null}</KeyValue>
            <KeyValue label={t("partner_handle")}>{collab.partner_handle || null}</KeyValue>
            <KeyValue label={t("partner_platform")}>
              {collab.partner_platform ? (
                <span className="inline-flex items-center gap-1.5">
                  <PlatformIcon platform={collab.partner_platform} className="size-3.5 text-muted-foreground" />
                  {PLATFORMS[collab.partner_platform].label}
                </span>
              ) : null}
            </KeyValue>
            <KeyValue label={t("partner_link")}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 underline-offset-2 hover:underline">
                  <span className="truncate">{collab.partner_link}</span>
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="sr-only">{t("opens_new_tab")}</span>
                </a>
              ) : collab.partner_link ? (
                <span className="break-all">{collab.partner_link}</span>
              ) : null}
            </KeyValue>
            <KeyValue label={t("partner_niche")}>{collab.partner_niche || null}</KeyValue>
            <KeyValue label={t("partner_followers")}>
              {collab.partner_followers !== null ? <span className="num">{t("followers_approx", { count: formatCompact(collab.partner_followers) })}</span> : null}
            </KeyValue>
          </DefinitionList>
        ) : (
          <p className="text-xs text-pretty text-muted-foreground">{t("partner_empty")}</p>
        )}
      </Section>

      {early ? outreach : null}

      <Section title={t("details")}>
        <DefinitionList>
          <KeyValue label={t("type")}>
            <CollabTypeBadge type={collab.type} />
          </KeyValue>
          <KeyValue label={t("collab_date")}>
            <DatePicker value={collab.collab_date} onChange={(collab_date) => update({ collab_date })} size="sm" aria-label={t("collab_date")} placeholder={t("set_date")} className="w-full max-w-60" />
          </KeyValue>
          <KeyValue label={t("follow_up_date")}>
            <DatePicker value={collab.follow_up_on} onChange={(follow_up_on) => update({ follow_up_on })} size="sm" aria-label={t("follow_up_date")} placeholder={t("set_date")} className="w-full max-w-60" />
          </KeyValue>
          <KeyValue label={t("pillar")}>{pillar ? <PillarBadge pillar={pillar} variant="plain" /> : null}</KeyValue>
          <KeyValue label={t("goal")}>
            {goal ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Target className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{goal.name}</span>
              </span>
            ) : null}
          </KeyValue>
          <KeyValue label={t("campaign")}>
            {campaign ? (
              <Link href={`/campaigns/${campaign.id}`} className="inline-flex min-w-0 items-center gap-1.5 underline-offset-2 hover:underline">
                <Megaphone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <ColorDot color={campaign.color} shape="square" />
                <span className="truncate">{campaign.name}</span>
              </Link>
            ) : null}
          </KeyValue>
          <KeyValue label={t("brand_deal")}>
            {deal ? (
              <Link href={`/money/deals?open=${deal.id}`} className="inline-flex min-w-0 items-center gap-1.5 underline-offset-2 hover:underline">
                <Handshake className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{deal.brand_name}</span>
              </Link>
            ) : null}
          </KeyValue>
        </DefinitionList>
      </Section>

      <Section title={t("your_posts")}>
        <CollabContentSection collab={collab} />
      </Section>

      {!early && (collab.status === "scheduled" || collab.outreach_message.trim()) ? outreach : null}

      {showResults ? (
        <Section
          title={t("results")}
          action={
            unmeasured ? (
              <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => uiActions.openDialog({ type: "add-metrics", itemId: unmeasured })}>
                <ChartColumn aria-hidden />
                {t("add_analytics")}
              </Button>
            ) : undefined
          }
        >
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure label={t("measured")} value={t("measured_of", { measured: results.measured, posts: results.posts })} muted={!results.posts} />
            <Figure label={t("views")} value={results.measured ? formatNumber(results.views) : "—"} muted={!results.measured} />
            <Figure label={t("engagement")} value={results.engagementRate !== null ? formatPercent(results.engagementRate) : "—"} muted={results.engagementRate === null} />
            <Figure label={t("followers_gained")} value={results.measured ? `+${formatNumber(results.followersGained)}` : "—"} muted={!results.measured} />
          </div>
          <p className="text-xs text-pretty text-muted-foreground">
            {!results.posts ? t("results_no_posts") : !results.measured ? t("results_no_metrics") : t("results_note")}
          </p>
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm">{t("your_rating")}</span>
              <RatingInput value={collab.rating} onChange={(rating) => rateCollab(collab, rating, now)} />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm" id={`repeat-${collab.id}`}>
                {t("would_repeat")}
              </span>
              <div role="group" aria-labelledby={`repeat-${collab.id}`} className="flex gap-1.5">
                {([true, false] as const).map((value) => (
                  <Button
                    key={String(value)}
                    type="button"
                    size="xs"
                    variant={collab.would_repeat === value ? "secondary" : "outline"}
                    aria-pressed={collab.would_repeat === value}
                    onClick={() => update({ would_repeat: collab.would_repeat === value ? null : value })}
                  >
                    {value ? t("yes") : t("no")}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      ) : null}

      {collab.notes ? (
        <Section title={t("notes")}>
          <p className="text-sm text-pretty whitespace-pre-line">{collab.notes}</p>
        </Section>
      ) : null}
    </div>
  )
}
