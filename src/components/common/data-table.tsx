"use client"

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatNumber } from "@/lib/utils"

type SortValue = string | number | boolean | null | undefined

export interface DataTableColumn<T> {
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** Makes the column sortable. Nulls always sort last. */
  sortValue?: (row: T) => SortValue
  align?: "left" | "right" | "center"
  className?: string
  headerClassName?: string
  width?: number | string
  /** Hide the column below a breakpoint. */
  hideBelow?: "sm" | "md" | "lg"
}

export interface DataTableSort {
  id: string
  desc: boolean
}

export interface DataTableProps<T> {
  rows: T[]
  columns: DataTableColumn<T>[]
  getRowId: (row: T) => string
  /** Rows become focusable; Enter/Space activates. Clicks on inner buttons/links are ignored. */
  onRowClick?: (row: T) => void
  /** Accessible name for a row (used by row activation and selection checkboxes). */
  rowLabel?: (row: T) => string
  defaultSort?: DataTableSort
  empty?: React.ReactNode
  dense?: boolean
  stickyHeader?: boolean
  maxHeight?: number | string
  /** Render this many rows, then a "Show more" button. */
  pageSize?: number
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  /** Own border + card surface. Set false inside a SectionCard. Default true. */
  bordered?: boolean
  className?: string
  rowClassName?: (row: T) => string | undefined
  "aria-label"?: string
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const
const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" } as const
const INTERACTIVE =
  "a,button,input,select,textarea,label,[role=checkbox],[role=menuitem],[role=switch],[role=combobox],[data-row-click=ignore]"

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b)
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })
}

const isEmptyValue = (v: SortValue) => v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v))

/**
 * Sortable, keyboard-accessible table on `ui/table`. Scrolls horizontally inside its own
 * container; optional sticky header, max height, "Show more" paging and row selection.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  rowLabel,
  defaultSort,
  empty,
  dense = false,
  stickyHeader = false,
  maxHeight,
  pageSize,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bordered = true,
  className,
  rowClassName,
  "aria-label": ariaLabel,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<DataTableSort | null>(defaultSort ?? null)
  const [limit, setLimit] = useState(pageSize ?? Infinity)

  const sorted = useMemo(() => {
    const column = sort ? columns.find((c) => c.id === sort.id) : undefined
    if (!sort || !column?.sortValue) return rows
    const getValue = column.sortValue
    return rows
      .map((row, index) => ({ row, index, value: getValue(row) }))
      .sort((a, b) => {
        const aEmpty = isEmptyValue(a.value)
        const bEmpty = isEmptyValue(b.value)
        if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1
        const result = compareValues(a.value, b.value)
        return (sort.desc ? -result : result) || a.index - b.index
      })
      .map((entry) => entry.row)
  }, [rows, columns, sort])

  const visible = Number.isFinite(limit) ? sorted.slice(0, limit) : sorted
  const selected = new Set(selectedIds)
  const allIds = sorted.map(getRowId)
  const selectedCount = allIds.filter((id) => selected.has(id)).length
  const colCount = columns.length + (selectable ? 1 : 0)
  const cellY = dense ? "py-1.5" : "py-2.5"

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return
    if (sort?.id === column.id) {
      setSort({ id: column.id, desc: !sort.desc })
      return
    }
    const sample = rows.map(column.sortValue).find((v) => !isEmptyValue(v))
    setSort({ id: column.id, desc: typeof sample === "number" })
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return
    onSelectionChange(selected.has(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id])
  }

  /** Header checkbox: adds/removes the current rows only, so selections hidden by filters survive. */
  function toggleAll() {
    if (!onSelectionChange) return
    if (selectedCount === allIds.length) {
      const current = new Set(allIds)
      onSelectionChange(selectedIds.filter((id) => !current.has(id)))
    } else {
      onSelectionChange([...selectedIds, ...allIds.filter((id) => !selected.has(id))])
    }
  }

  return (
    <div className={cn("flex min-w-0 flex-col", bordered && "overflow-hidden rounded-lg border bg-card", className)}>
      <div
        className="relative w-full overflow-auto scrollbar-thin"
        style={maxHeight !== undefined ? { maxHeight } : undefined}
      >
        <table aria-label={ariaLabel} className="w-full caption-bottom text-sm">
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="hover:bg-transparent">
              {selectable ? (
                <TableHead
                  className={cn(
                    "h-9 w-10 bg-card pr-0 pl-4 shadow-[inset_0_-1px_0_var(--border)]",
                    stickyHeader && "sticky top-0 z-10"
                  )}
                >
                  <Checkbox
                    aria-label="Select all rows"
                    checked={selectedCount === 0 ? false : selectedCount === allIds.length ? true : "indeterminate"}
                    onCheckedChange={toggleAll}
                    disabled={!allIds.length}
                  />
                </TableHead>
              ) : null}
              {columns.map((column) => {
                const active = sort?.id === column.id
                const align = column.align ?? "left"
                return (
                  <TableHead
                    key={column.id}
                    scope="col"
                    aria-sort={column.sortValue ? (active ? (sort.desc ? "descending" : "ascending") : "none") : undefined}
                    style={column.width !== undefined ? { width: column.width } : undefined}
                    className={cn(
                      "h-9 bg-card px-3 text-xs font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)] first:pl-4 last:pr-4",
                      ALIGN[align],
                      stickyHeader && "sticky top-0 z-10",
                      column.hideBelow && HIDE[column.hideBelow],
                      column.headerClassName
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          "group/sort -mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
                          align === "right" && "flex-row-reverse",
                          active && "text-foreground"
                        )}
                      >
                        {column.header}
                        {active ? (
                          sort.desc ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUp className="size-3.5" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown
                            className="size-3.5 opacity-0 transition-opacity group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60"
                            aria-hidden
                          />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length ? (
              visible.map((row) => {
                const id = getRowId(row)
                const isSelected = selected.has(id)
                return (
                  <TableRow
                    key={id}
                    data-state={isSelected ? "selected" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                    onClick={
                      onRowClick
                        ? (event) => {
                            const target = event.target as HTMLElement
                            // React bubbles clicks from portals (menus, dialogs opened from a row) through
                            // the row — only clicks physically inside the row count.
                            if (!event.currentTarget.contains(target)) return
                            const hit = target.closest(INTERACTIVE)
                            if (hit && hit !== event.currentTarget && event.currentTarget.contains(hit)) return
                            if (window.getSelection()?.toString()) return
                            onRowClick(row)
                          }
                        : undefined
                    }
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.target !== event.currentTarget) return
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              onRowClick(row)
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "hover:bg-muted/40",
                      onRowClick &&
                        "cursor-pointer outline-none focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring/70",
                      rowClassName?.(row)
                    )}
                  >
                    {selectable ? (
                      <TableCell className={cn("w-10 pr-0 pl-4", cellY)}>
                        <Checkbox
                          aria-label={`Select ${rowLabel?.(row) ?? "row"}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(id)}
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          "px-3 first:pl-4 last:pr-4",
                          cellY,
                          ALIGN[column.align ?? "left"],
                          column.align === "right" && "num",
                          column.hideBelow && HIDE[column.hideBelow],
                          column.className
                        )}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colCount} className="p-0 whitespace-normal">
                  {empty ?? <p className="px-4 py-10 text-center text-sm text-muted-foreground">No results.</p>}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
      {visible.length < sorted.length ? (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          <span className="num">
            Showing {formatNumber(visible.length)} of {formatNumber(sorted.length)}
          </span>
          <Button type="button" variant="ghost" size="xs" onClick={() => setLimit((l) => l + (pageSize ?? sorted.length))}>
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  )
}
