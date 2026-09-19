import { InfoHint } from "@/components/common/info-hint"
import type { IconComponent } from "@/components/common/types"
import { cn, formatNumber } from "@/lib/utils"

const PAGE_WIDTHS = {
  default: "max-w-[1400px]",
  wide: "max-w-none",
  narrow: "max-w-3xl",
} as const

export type PageWidth = keyof typeof PAGE_WIDTHS

/** Page frame: responsive padding, max width and vertical rhythm between sections. */
export function PageContainer({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode
  className?: string
  width?: PageWidth
}) {
  return (
    <div className={cn("mx-auto flex w-full min-w-0 flex-col gap-6 p-4 md:p-6", PAGE_WIDTHS[width], className)}>
      {children}
    </div>
  )
}

/**
 * Page title row (Calm UI, ARCHITECTURE §5): a title, at most one short subtitle (≤ 8 words) and the page's
 * explanation behind an ⓘ (`info`). `actions` sit on the right (wrap below on mobile) — one primary action;
 * Capture and New content live in the top bar, not here. `children` render as a second row for filters.
 *
 * `description` is the subtitle (kept for older screens that still pass a sentence — move it to `info`).
 * `icon` is legacy: new screens leave it out.
 */
export function PageHeader({
  title,
  description,
  info,
  infoTitle,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title: React.ReactNode
  /** Short subtitle, ≤ 8 words. */
  description?: React.ReactNode
  /** The page's explanation, shown in an ⓘ popover next to the title. */
  info?: React.ReactNode
  /** Popover heading and the ⓘ's accessible name ("About {infoTitle}"); defaults to the title when it's a string. */
  infoTitle?: string
  icon?: IconComponent
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const hintTitle = infoTitle ?? (typeof title === "string" ? title : undefined)
  return (
    <header className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
          {Icon ? (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-xs dark:bg-input/30">
              <Icon className="size-4" aria-hidden />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="min-w-0 text-lg leading-7 font-semibold tracking-tight text-balance">{title}</h1>
              {info ? <InfoHint title={hintTitle}>{info}</InfoHint> : null}
            </div>
            {description ? (
              <p className="mt-0.5 max-w-3xl text-sm text-pretty text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="min-w-0">{children}</div> : null}
    </header>
  )
}

/**
 * Section title row (Calm UI): a title of ≤ 4 words, an optional count, an optional ⓘ and one optional
 * action. No description line — explanations go in `info`.
 */
export function SectionHeader({
  title,
  count,
  info,
  infoTitle,
  action,
  as: Heading = "h2",
  id,
  className,
}: {
  title: React.ReactNode
  count?: number | null
  info?: React.ReactNode
  infoTitle?: string
  action?: React.ReactNode
  as?: "h2" | "h3" | "h4"
  id?: string
  className?: string
}) {
  const hintTitle = infoTitle ?? (typeof title === "string" ? title : undefined)
  return (
    <div className={cn("flex min-h-7 min-w-0 items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <Heading id={id} className="truncate text-sm leading-6 font-semibold">
          {title}
        </Heading>
        {count !== undefined && count !== null ? (
          <span className="shrink-0 text-sm text-muted-foreground num">{formatNumber(count)}</span>
        ) : null}
        {info ? <InfoHint title={hintTitle}>{info}</InfoHint> : null}
      </div>
      {action ? <div className="-my-1 flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  )
}

/** A titled group of content inside a page (no border — use SectionCard for objects and panels). */
export function PageSection({
  title,
  description,
  count,
  info,
  action,
  children,
  className,
  id,
}: {
  title: React.ReactNode
  /** Legacy description line — prefer `info` (Calm UI). */
  description?: React.ReactNode
  count?: number | null
  info?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  id?: string
}) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="min-w-0">
        <SectionHeader id={headingId} title={title} count={count} info={info} action={action} />
        {description ? <p className="text-xs text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
