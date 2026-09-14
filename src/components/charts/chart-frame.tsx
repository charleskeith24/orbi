"use client"

import { ChartColumn, Table2 } from "lucide-react"
import { useId, useState, type ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

/** Accessible twin of a chart: plain columns and rows (format values before passing them in). */
export interface ChartTable {
  columns: string[]
  rows: (string | number)[][]
}

export interface ChartFrameProps {
  title: string
  description?: string
  /** Toolbar content (e.g. a metric select) placed before the Chart/Table toggle. */
  actions?: ReactNode
  /** When set, a Chart/Table toggle lets every reader get the values without hovering. */
  table?: ChartTable
  footer?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

/** Card wrapper for one chart: title, description, actions and a table view. */
export function ChartFrame({
  title,
  description,
  actions,
  table,
  footer,
  className,
  contentClassName,
  children,
}: ChartFrameProps) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground [--chart-surface:var(--card)]",
        className
      )}
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <h3 id={titleId} className="text-sm leading-5 font-medium">
            {title}
          </h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions || table ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {actions}
            {table ? (
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                spacing={0}
                value={view}
                onValueChange={(value) => {
                  if (value === "chart" || value === "table") setView(value)
                }}
                aria-label="Display as"
              >
                <ToggleGroupItem value="chart" aria-label="Show chart">
                  <ChartColumn />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Show table">
                  <Table2 />
                </ToggleGroupItem>
              </ToggleGroup>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className={cn("min-w-0", contentClassName)}>
        {view === "table" && table ? <ChartDataTable table={table} /> : children}
      </div>
      {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
    </section>
  )
}

function ChartDataTable({ table }: { table: ChartTable }) {
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {table.columns.map((column, i) => (
            <TableHead key={i} className={cn("h-8 text-xs font-medium text-muted-foreground", i > 0 && "text-right")}>
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.rows.length ? (
          table.rows.map((row, r) => (
            <TableRow key={r}>
              {row.map((cell, c) => (
                <TableCell key={c} className={cn("py-1.5", c === 0 ? "max-w-72 truncate" : "num text-right")}>
                  {typeof cell === "number" ? numberFormat.format(cell) : cell}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={table.columns.length} className="py-6 text-center text-muted-foreground">
              No rows yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
