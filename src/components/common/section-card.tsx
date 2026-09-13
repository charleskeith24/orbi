import type { IconComponent } from "@/components/common/types"
import { cn } from "@/lib/utils"

/**
 * The standard bordered panel: compact header row (title, description, action),
 * padded body and an optional footer. Pass `contentClassName="p-0"` for edge-to-edge
 * tables and lists.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  footer,
  children,
  className,
  contentClassName,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: IconComponent
  action?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  const hasHeader = Boolean(title || description || action)
  return (
    <section
      data-slot="section-card"
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground", className)}
    >
      {hasHeader ? (
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
          <div className="flex min-w-0 items-start gap-2">
            {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
            <div className="min-w-0">
              {title ? <h3 className="text-sm leading-5 font-medium">{title}</h3> : null}
              {description ? <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {action ? <div className="-my-1 flex shrink-0 items-center gap-1">{action}</div> : null}
        </div>
      ) : null}
      {children !== undefined && children !== null ? (
        <div className={cn("min-w-0 flex-1", hasHeader ? "px-4 pt-3 pb-4" : "p-4", contentClassName)}>{children}</div>
      ) : null}
      {footer ? (
        <div className="flex items-center gap-2 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">{footer}</div>
      ) : null}
    </section>
  )
}
