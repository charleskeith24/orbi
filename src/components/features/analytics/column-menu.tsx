"use client"

import { Columns3, RotateCcw } from "lucide-react"
import { Fragment, useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DEFAULT_POST_COLUMNS, POST_DETAIL_COLUMNS, POST_METRIC_FIELDS, sanitizeColumns, type PostColumnId } from "./post-fields"

const STORAGE_KEY = "pbos:analytics:post-columns:v1"

function readStored(): PostColumnId[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return (raw ? sanitizeColumns(JSON.parse(raw)) : null) ?? DEFAULT_POST_COLUMNS
  } catch {
    return DEFAULT_POST_COLUMNS
  }
}

function store(ids: PostColumnId[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage can be blocked (private mode, site data off) — visibility then lasts for the session.
  }
}

/** Visible table columns, remembered per browser. */
export function useColumnVisibility() {
  const [ids, setIds] = useState<PostColumnId[]>(readStored)
  const visible = useMemo(() => new Set(ids), [ids])
  const toggle = useCallback((id: PostColumnId, show: boolean) => {
    setIds((prev) => {
      const next = show ? [...prev.filter((c) => c !== id), id] : prev.filter((c) => c !== id)
      store(next)
      return next
    })
  }, [])
  const reset = useCallback(() => {
    store(DEFAULT_POST_COLUMNS)
    setIds(DEFAULT_POST_COLUMNS)
  }, [])
  return { visible, toggle, reset }
}

const GROUPS: { label: string; columns: { id: PostColumnId; label: string }[] }[] = [
  { label: "Details", columns: POST_DETAIL_COLUMNS },
  { label: "Counts", columns: POST_METRIC_FIELDS.filter((f) => f.group === "counts") },
  { label: "Rates", columns: POST_METRIC_FIELDS.filter((f) => f.group === "rates") },
]

export function ColumnMenu({
  visible,
  onToggle,
  onReset,
}: {
  visible: ReadonlySet<PostColumnId>
  onToggle: (id: PostColumnId, show: boolean) => void
  onReset: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Columns: ${visible.size} shown`}>
          <Columns3 aria-hidden />
          Columns
          <span className="num text-xs text-muted-foreground">{visible.size}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(30rem,var(--radix-dropdown-menu-content-available-height))] w-56 overflow-y-auto">
        {GROUPS.map((group, i) => (
          <Fragment key={group.label}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-xs text-muted-foreground">{group.label}</DropdownMenuLabel>
            {group.columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={visible.has(column.id)}
                onCheckedChange={(checked) => onToggle(column.id, checked === true)}
                onSelect={(event) => event.preventDefault()}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </Fragment>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onReset}>
          <RotateCcw aria-hidden />
          Reset to default
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
