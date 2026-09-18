"use client"

import { ClipboardList, Plus } from "lucide-react"
import Link from "next/link"
import { ContentThumbnail, PlatformIcon, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { PerformanceRow } from "@/lib/analytics"
import { PLATFORMS } from "@/lib/constants"
import { formatRelativeDay } from "@/lib/dates"
import { useT, useUiLang, type UiLang } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import { formatNumber } from "@/lib/utils"
import { analyticsMessages } from "./messages"

const VISIBLE = 5

/** "5 days ago" / "today" in English; "kahapon" / "3 araw ang nakalipas" in Taglish. */
function publishedWhen(row: PerformanceRow, now: Date, lang: UiLang): string {
  const label = formatRelativeDay(row.publishedAt, now, lang)
  // "Yesterday" → "yesterday"; short dates keep their capital ("Sep 1").
  return /^[A-Z][a-z]+$/.test(label) ? label.toLowerCase() : label
}

/** Published posts in scope with no analytics snapshot — manual entry is the primary data source. */
export function MissingAnalytics({ rows, viewAllHref, now }: { rows: PerformanceRow[]; viewAllHref: string; now: Date }) {
  const t = useT(analyticsMessages)
  const lang = useUiLang()
  if (!rows.length) return null
  return (
    <SectionCard
      icon={ClipboardList}
      title={t.plural("missing_title", rows.length, { count: formatNumber(rows.length) })}
      description={t("missing_description")}
      action={
        rows.length > VISIBLE ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={viewAllHref}>{t("view_all", { count: rows.length })}</Link>
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
                {row.item.title || t("untitled_post")}
              </Link>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PlatformIcon platform={row.platform} className="size-3" />
                {t("published_when", { platform: PLATFORMS[row.platform].label, when: publishedWhen(row, now, lang) })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => uiActions.openDialog({ type: "add-metrics", itemId: row.id })}
              aria-label={t("add_for", { title: row.item.title || t("untitled_post_lower") })}
            >
              <Plus aria-hidden />
              {t("add")}
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
