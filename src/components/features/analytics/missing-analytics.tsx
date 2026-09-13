"use client"

import { ClipboardList, Plus } from "lucide-react"
import Link from "next/link"
import { ContentThumbnail, PlatformIcon, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { PerformanceRow } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatRelativeDay } from "@/lib/dates"
import { uiActions } from "@/lib/store"
import { pluralize } from "@/lib/utils"

const VISIBLE = 5

/** Published posts in scope with no analytics snapshot — manual entry is the primary data source. */
export function MissingAnalytics({ rows, viewAllHref, now }: { rows: PerformanceRow[]; viewAllHref: string; now: Date }) {
  if (!rows.length) return null
  return (
    <SectionCard
      icon={ClipboardList}
      title={`${pluralize(rows.length, "published post")} ${rows.length === 1 ? "has" : "have"} no analytics yet`}
      description="Log views, reach and engagement so winners, reports and recommendations stay accurate."
      action={
        rows.length > VISIBLE ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={viewAllHref}>View all {rows.length}</Link>
          </Button>
        ) : undefined
      }
      contentClassName="p-0 pt-2"
    >
      <ul className="divide-y border-t">
        {rows.slice(0, VISIBLE).map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-4 py-2">
            <ContentThumbnail item={row.item} size="sm" aspect="square" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/analytics/posts?open=${row.id}`}
                className="block truncate text-sm underline-offset-2 hover:underline"
              >
                {row.item.title || "Untitled post"}
              </Link>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PlatformIcon platform={row.platform} className="size-3" />
                {PLATFORMS[row.platform].label} · published {formatRelativeDay(row.publishedAt, now).toLowerCase()}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => uiActions.openDialog({ type: "add-metrics", itemId: row.id })}
              aria-label={`Add analytics for ${row.item.title || "untitled post"}`}
            >
              <Plus aria-hidden />
              Add
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
