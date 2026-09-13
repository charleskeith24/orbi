import type { IconComponent } from "@/components/common/types"
import { cn } from "@/lib/utils"

export interface DefinitionItem {
  label: React.ReactNode
  value: React.ReactNode
  icon?: IconComponent
}

/**
 * Property list for detail sheets. `horizontal` aligns labels in a column (Linear-style
 * properties); `vertical` stacks label over value in 1–3 columns.
 * Children must be `KeyValue` rows.
 */
export function DefinitionList({
  items,
  children,
  layout = "horizontal",
  columns = 1,
  className,
}: {
  items?: DefinitionItem[]
  children?: React.ReactNode
  layout?: "horizontal" | "vertical"
  columns?: 1 | 2 | 3
  className?: string
}) {
  return (
    <dl
      data-layout={layout}
      className={cn(
        "group/dl min-w-0",
        layout === "horizontal"
          ? "grid grid-cols-[minmax(6.5rem,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2.5"
          : cn("grid gap-x-6 gap-y-3.5", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3"),
        className
      )}
    >
      {items?.map((item, index) => (
        <KeyValue key={index} label={item.label} icon={item.icon}>
          {item.value}
        </KeyValue>
      ))}
      {children}
    </dl>
  )
}

const isEmpty = (value: React.ReactNode) => value === null || value === undefined || value === "" || value === false

/** One label/value pair (renders `dt` + `dd`). Empty values show a muted dash. */
export function KeyValue({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: React.ReactNode
  icon?: IconComponent
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        "group-data-[layout=horizontal]/dl:col-span-2 group-data-[layout=horizontal]/dl:grid group-data-[layout=horizontal]/dl:grid-cols-subgrid group-data-[layout=horizontal]/dl:items-start",
        className
      )}
    >
      <dt className="flex min-h-5 min-w-0 items-center gap-1.5 text-xs text-muted-foreground group-data-[layout=horizontal]/dl:min-h-6">
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="flex min-h-5 min-w-0 flex-wrap items-center gap-1 text-sm break-words group-data-[layout=horizontal]/dl:min-h-6">
        {isEmpty(children) ? <span className="text-muted-foreground">—</span> : children}
      </dd>
    </div>
  )
}
