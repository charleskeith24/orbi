"use client"

import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { engagementsOf } from "@/lib/analytics"
import { formatDate } from "@/lib/dates"
import type { ContentMetric, MetricSource } from "@/lib/types"
import { formatNumber } from "@/lib/utils"

const SOURCE_LABEL: Record<MetricSource, string> = { manual: "Manual", import: "Imported", integration: "Integration" }

/** Newest first: greatest recorded_at, ties by updated_at then created_at (same rule as analytics). */
export function newestFirst(a: ContentMetric, b: ContentMetric): number {
  if (a.recorded_at !== b.recorded_at) return a.recorded_at < b.recorded_at ? 1 : -1
  if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
}

/** Every logged snapshot of one post, with edit and delete. `snapshots` must be sorted newest first. */
export function SnapshotHistory({
  snapshots,
  onEdit,
  onDelete,
}: {
  snapshots: ContentMetric[]
  onEdit: (snapshot: ContentMetric) => void
  onDelete: (snapshot: ContentMetric) => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="h-8 px-3 text-left font-medium">
              Recorded
            </th>
            <th scope="col" className="h-8 px-3 text-right font-medium">
              Views
            </th>
            <th scope="col" className="h-8 px-3 text-right font-medium">
              Reach
            </th>
            <th scope="col" className="h-8 px-3 text-right font-medium">
              Eng.
            </th>
            <th scope="col" className="h-8 px-3 text-right font-medium">
              Leads
            </th>
            <th scope="col" className="h-8 w-16 px-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {snapshots.map((s, index) => {
            const date = formatDate(s.recorded_at)
            return (
              <tr key={s.id} className="align-top">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {date}
                    {index === 0 ? (
                      <span className="rounded-sm bg-muted px-1 text-[11px] font-medium text-muted-foreground">Latest</span>
                    ) : null}
                  </div>
                  <p className="max-w-56 truncate text-xs text-muted-foreground" title={s.notes || undefined}>
                    {[SOURCE_LABEL[s.source] ?? s.source, s.notes].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="num px-3 py-2 text-right">{formatNumber(s.views)}</td>
                <td className="num px-3 py-2 text-right">{formatNumber(s.reach)}</td>
                <td className="num px-3 py-2 text-right">{formatNumber(engagementsOf(s))}</td>
                <td className="num px-3 py-2 text-right">{formatNumber(s.leads)}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon-xs" aria-label={`Edit snapshot from ${date}`} onClick={() => onEdit(s)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete snapshot from ${date}`}
                    onClick={() => onDelete(s)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
