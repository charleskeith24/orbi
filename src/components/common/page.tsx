import type { IconComponent } from "@/components/common/types"
import { cn } from "@/lib/utils"

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
 * Page title row. `actions` sit on the right (wrap below on mobile);
 * `children` render as a second row for tabs or filters.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: IconComponent
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
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
            <h1 className="text-lg leading-7 font-semibold tracking-tight text-balance">{title}</h1>
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

/** A titled group of content inside a page (no border — use SectionCard for panels). */
export function PageSection({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  id?: string
}) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm leading-6 font-semibold">
            {title}
          </h2>
          {description ? <p className="text-xs text-pretty text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}
