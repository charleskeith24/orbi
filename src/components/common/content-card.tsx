"use client"

import { AlarmClock, CalendarClock, CalendarDays, CircleCheck, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { ContentThumbnail } from "@/components/common/content-thumbnail"
import { FormatLabel, PillarBadge } from "@/components/common/entity-badges"
import { contentCardMessages } from "@/components/common/messages"
import { PlatformIcon } from "@/components/common/platform-icon"
import { PriorityBadge, StageBadge, TierBadge } from "@/components/common/status-badges"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PUBLISHED_STAGES } from "@/lib/constants"
import { daysBetween, formatDateTime, formatRelativeDay, parseDate } from "@/lib/dates"
import { translator, useT, useUiLang, type UiLang } from "@/lib/i18n"
import type { ContentItem, PerformanceTier } from "@/lib/types"
import { cn, formatNumber, initials } from "@/lib/utils"

interface DateInfo {
  icon: LucideIcon
  label: string
  title: string
  overdue: boolean
}

/** "Today" → "today", "Bukas" → "bukas" for "Due …"; multi-word labels ("in 3 days", "Oct 6") keep their casing. */
function lowerRelative(label: string): string {
  return /^[A-Z][a-z]+$/.test(label) ? label.toLowerCase() : label
}

/** Published → scheduled → due date, with overdue detection for unpublished work. */
export function contentDateInfo(
  item: Pick<ContentItem, "published_at" | "scheduled_at" | "due_date" | "stage">,
  now: Date = new Date(),
  lang: UiLang = "en"
): DateInfo | null {
  const t = translator(contentCardMessages, lang)
  const published = parseDate(item.published_at)
  if (published) {
    return {
      icon: CircleCheck,
      label: formatRelativeDay(published, now, lang),
      title: t("published_at", { date: formatDateTime(published) }),
      overdue: false,
    }
  }
  const isLive = PUBLISHED_STAGES.includes(item.stage)
  const scheduled = parseDate(item.scheduled_at)
  const due = scheduled ? null : parseDate(item.due_date)
  const date = scheduled ?? due
  if (!date) return null
  const days = daysBetween(now, date) ?? 0
  // Same rule as analytics `isOverdue`: a missed deadline doesn't count once the piece is approved and waiting.
  const waitingToPost = item.stage === "ready_to_post" || item.stage === "scheduled"
  if (days < 0 && !isLive && (scheduled || !waitingToPost)) {
    const late = -days
    return {
      icon: AlarmClock,
      label: t.plural("overdue_by", late, { count: formatNumber(late) }),
      title: t(scheduled ? "was_scheduled" : "was_due", { date: formatDateTime(date) }),
      overdue: true,
    }
  }
  if (scheduled) {
    return {
      icon: CalendarClock,
      label: formatRelativeDay(scheduled, now, lang),
      title: t("scheduled_at", { date: formatDateTime(scheduled) }),
      overdue: false,
    }
  }
  return {
    icon: CalendarDays,
    label: t("due", { when: lowerRelative(formatRelativeDay(date, now, lang)) }),
    title: t("due_at", { date: formatDateTime(date).replace(/, 12:00 AM$/, "") }),
    overdue: false,
  }
}

function DateMeta({ info }: { info: DateInfo }) {
  const Icon = info.icon
  return (
    <span
      title={info.title}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 text-xs whitespace-nowrap",
        info.overdue ? "font-medium text-critical-fg" : "text-muted-foreground"
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{info.label}</span>
    </span>
  )
}

/** "Bea (editor)" → "B", "Maria Santos" → "MS" — words not starting with a letter/digit are skipped. */
function ownerInitials(owner: string): string {
  return initials(
    owner
      .split(/\s+/)
      .filter((word) => /^[\p{L}\p{N}]/u.test(word))
      .join(" ")
  )
}

function OwnerAvatar({ owner }: { owner: string }) {
  const t = useT(contentCardMessages)
  if (!owner.trim()) return null
  return (
    <Avatar size="sm" className="size-5" title={owner}>
      <AvatarFallback className="text-[10px] font-medium">{ownerInitials(owner)}</AvatarFallback>
      <span className="sr-only">{t("owner", { owner })}</span>
    </Avatar>
  )
}

export interface ContentCardProps {
  item: ContentItem
  /** Tighter layout for dense lists: one meta row, no thumbnail. */
  compact?: boolean
  showStage?: boolean
  showDate?: boolean
  showThumbnail?: boolean
  /** Slot rendered top-right above the click target (e.g. a dnd-kit handle). */
  dragHandle?: React.ReactNode
  /** Slot rendered top-right for a menu button. */
  actions?: React.ReactNode
  /** Makes the whole card a link (stretched title link, so inner controls stay clickable). */
  href?: string
  onClick?: () => void
  tier?: PerformanceTier | null
  selected?: boolean
  now?: Date
  className?: string
}

/** Content item summary for Kanban columns (~272px) and lists. */
export function ContentCard({
  item,
  compact = false,
  showStage = false,
  showDate = true,
  showThumbnail = !compact,
  dragHandle,
  actions,
  href,
  onClick,
  tier,
  selected = false,
  now,
  className,
}: ContentCardProps) {
  const lang = useUiLang()
  const dateInfo = showDate ? contentDateInfo(item, now, lang) : null
  const title = item.title.trim() || translator(contentCardMessages, lang)("untitled_content")
  // The ::after covers the card (containing block = the article), so the whole card is the target.
  const stretched =
    "outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none"
  // Clamp on the text itself: a <button> is an atomic inline, so a clamp on the h3 can't reach inside it.
  const titleNode = href ? (
    <Link href={href} data-card-link className={cn(stretched, "line-clamp-2")}>
      {title}
    </Link>
  ) : onClick ? (
    <button type="button" data-card-link onClick={onClick} className={cn(stretched, "block w-full text-left")}>
      <span className="line-clamp-2">{title}</span>
    </button>
  ) : (
    <span className="line-clamp-2">{title}</span>
  )
  const showTier = tier === "good" || tier === "winner" || tier === "breakout"
  const slots =
    dragHandle || actions ? (
      <div className="relative z-10 -mt-1 -mr-1.5 flex shrink-0 items-center">
        {actions}
        {dragHandle}
      </div>
    ) : null

  return (
    <article
      data-selected={selected || undefined}
      className={cn(
        "group/card relative flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground shadow-xs transition-[border-color,box-shadow]",
        (href || onClick) && "hover:border-foreground/20 hover:shadow-sm",
        "has-[[data-card-link]:focus-visible]:border-ring has-[[data-card-link]:focus-visible]:ring-3 has-[[data-card-link]:focus-visible]:ring-ring/50",
        "data-selected:border-brand/60 data-selected:ring-2 data-selected:ring-brand/25",
        compact ? "gap-1.5 p-2.5" : "gap-2.5 p-3",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {showThumbnail ? <ContentThumbnail item={item} size="sm" /> : null}
        <h3 className="min-w-0 flex-1 text-sm leading-snug font-medium break-words" title={title.length > 70 ? title : undefined}>
          {titleNode}
        </h3>
        {slots}
      </div>

      {compact ? (
        <div className="flex min-w-0 items-center gap-2">
          <PlatformIcon platform={item.platform} label className="size-3.5 text-muted-foreground" />
          <PillarBadge pillarId={item.pillar_id} variant="plain" className="min-w-0" />
          {item.priority === "high" ? <PriorityBadge priority="high" showLabel={false} /> : null}
          {showTier ? <TierBadge tier={tier} /> : null}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {dateInfo ? <DateMeta info={dateInfo} /> : null}
            <OwnerAvatar owner={item.owner} />
          </span>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <PillarBadge pillarId={item.pillar_id} className="max-w-full" />
            {showStage ? <StageBadge stage={item.stage} /> : null}
            {item.priority === "high" ? <PriorityBadge priority="high" /> : null}
            {showTier ? <TierBadge tier={tier} /> : null}
          </div>
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <PlatformIcon platform={item.platform} label className="size-3.5" />
            <FormatLabel formatId={item.format_id} showIcon={false} emptyLabel="" className="min-w-0 shrink" />
            <span className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
              {dateInfo ? <DateMeta info={dateInfo} /> : null}
              <OwnerAvatar owner={item.owner} />
            </span>
          </div>
        </>
      )}
    </article>
  )
}
