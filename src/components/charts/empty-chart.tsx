import { ChartNoAxesColumn, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface EmptyChartProps {
  /** One sentence: what will appear here and how to get it. */
  message: string
  /** Match the chart's height so an empty state never shifts the layout. */
  height?: number
  icon?: LucideIcon
  /** Optional single primary action (e.g. "Log analytics"). */
  action?: ReactNode
  className?: string
}

export function EmptyChart({ message, height = 200, icon: Icon = ChartNoAxesColumn, action, className }: EmptyChartProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center",
        className
      )}
      style={{ minHeight: height }}
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="max-w-xs text-xs text-muted-foreground">{message}</p>
      {action}
    </div>
  )
}
