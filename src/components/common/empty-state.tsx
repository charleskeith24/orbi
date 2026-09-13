import type { IconComponent } from "@/components/common/types"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

/**
 * Empty list state: icon, one sentence on why the list matters, one primary action.
 * `compact` drops the dashed frame for use inside cards and panels.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
}: {
  icon?: IconComponent
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <Empty
      className={cn(
        compact ? "flex-none gap-3 rounded-lg px-4 py-6" : "gap-5 rounded-lg border border-dashed bg-card/50 px-6 py-12",
        className
      )}
    >
      <EmptyHeader className="gap-1.5">
        {Icon ? (
          <EmptyMedia
            variant="icon"
            className={cn(
              "border bg-card text-muted-foreground shadow-xs dark:bg-input/30",
              compact ? "mb-1 size-8" : "mb-2 size-10"
            )}
          >
            <Icon className={compact ? "size-4" : "size-5"} />
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="font-medium">{title}</EmptyTitle>
        {description ? (
          <EmptyDescription className={cn("text-pretty", compact ? "text-xs" : "text-sm")}>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action || secondaryAction ? (
        <EmptyContent className="flex-row flex-wrap justify-center gap-2">
          {action}
          {secondaryAction}
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
