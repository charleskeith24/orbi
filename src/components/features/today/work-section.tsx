"use client"

import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { contentDateInfo, PlatformIcon, SectionCard, type IconComponent } from "@/components/common"
import { Button } from "@/components/ui/button"
import { BUFFER_STAGES } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import type { ContentItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { todayMessages } from "./messages"

/** Rows shown before "Show all". */
const INITIAL = 5

/** In-page jump target (Daily rhythm): focusable, and briefly ringed while `data-flash` is set. */
export const JUMP_TARGET =
  "rounded-lg outline-none transition-shadow duration-300 data-[flash=true]:ring-2 data-[flash=true]:ring-brand/40 data-[flash=true]:ring-offset-2 data-[flash=true]:ring-offset-background"

/**
 * A Today work list: bordered card with the count next to the title, rows edge to edge, "Show all"
 * past five. `id` is the in-page anchor used by the Daily rhythm strip.
 */
export function WorkSection<T>({
  id,
  title,
  icon,
  description,
  action,
  items,
  getKey,
  renderItem,
  empty,
  urgent = false,
  className,
}: {
  id: string
  title: string
  icon: IconComponent
  description?: React.ReactNode
  action?: React.ReactNode
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => React.ReactNode
  empty: React.ReactNode
  /** Count in the critical tone when there are items (Overdue). */
  urgent?: boolean
  className?: string
}) {
  const t = useT(todayMessages)
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, INITIAL)
  return (
    <div id={id} tabIndex={-1} className={cn("min-w-0 scroll-mt-16", JUMP_TARGET, className)}>
      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            {title}
            <span className={cn("text-xs num", urgent && items.length ? "font-semibold text-critical-fg" : "font-normal text-muted-foreground")}>
              {items.length}
            </span>
          </span>
        }
        icon={icon}
        description={description}
        action={action}
        className="@container/work h-full"
        contentClassName="p-0"
        footer={
          items.length > INITIAL ? (
            <Button variant="ghost" size="xs" className="-my-1 -ml-2 text-muted-foreground" onClick={() => setExpanded((value) => !value)}>
              {expanded ? t("show_fewer") : t("show_all", { count: items.length })}
            </Button>
          ) : undefined
        }
      >
        {items.length ? (
          <ul className="mt-3 divide-y border-t">
            {shown.map((item) => (
              <li key={getKey(item)}>{renderItem(item)}</li>
            ))}
          </ul>
        ) : (
          <div className="mt-1">{empty}</div>
        )}
      </SectionCard>
    </div>
  )
}

/** Title (→ Studio) with platform glyph and a meta line; actions sit right, or below on narrow cards. */
export function WorkRow({ item, meta, actions }: { item: ContentItem; meta?: React.ReactNode; actions?: React.ReactNode }) {
  const t = useT(todayMessages)
  const title = item.title.trim() || t("untitled_content")
  return (
    <div className="flex min-w-0 flex-col gap-2 px-4 py-2.5 @lg/work:flex-row @lg/work:items-center @lg/work:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <PlatformIcon platform={item.platform} label className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/studio/${item.id}`}
            title={title.length > 70 ? title : undefined}
            className="line-clamp-2 rounded-sm text-sm leading-snug font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {title}
          </Link>
          {meta ? <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-6.5 @lg/work:pl-0">{actions}</div> : null}
    </div>
  )
}

export function OpenButton({ href, label: labelProp }: { href: string; label?: string }) {
  const t = useT(todayMessages)
  const label = labelProp ?? t("open_in_studio")
  return (
    <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground" title={label}>
      <Link href={href} aria-label={label}>
        <ArrowUpRight aria-hidden />
      </Link>
    </Button>
  )
}

/**
 * Publish / schedule / due date, red when late. Approved content (Ready to Post / Scheduled) has met
 * its production deadline, so a past due date isn't flagged there — same rule as the Overdue list.
 */
export function DateMeta({ item, now }: { item: ContentItem; now: Date }) {
  const lang = useUiLang()
  const info = contentDateInfo(item, now, lang)
  if (!info) return null
  if (info.overdue && !item.scheduled_at && BUFFER_STAGES.includes(item.stage)) return null
  const Icon = info.icon
  return (
    <span title={info.title} className={cn("inline-flex items-center gap-1 whitespace-nowrap", info.overdue && "font-medium text-critical-fg")}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {info.label}
    </span>
  )
}

/** Compact empty state for a work list: icon, one sentence, optional action. */
export function InlineEmpty({ icon: Icon, children, action }: { icon: IconComponent; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-2 pb-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-xs dark:bg-input/30">
        <Icon className="size-3.5" />
      </span>
      <p className="min-w-0 flex-1 basis-48 text-xs text-pretty text-muted-foreground">{children}</p>
      {action}
    </div>
  )
}
