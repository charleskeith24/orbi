"use client"

import { formatDistanceStrict } from "date-fns"
import { ChartNoAxesColumn, GitFork, Send } from "lucide-react"
import Link from "next/link"
import { ContentThumbnail, InlineText } from "@/components/common"
import { ItemCollabChip } from "@/components/features/collabs/collab-links"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { PLATFORMS, PUBLISHED_STAGES, REPURPOSE_TYPES } from "@/lib/constants"
import { parseDate } from "@/lib/dates"
import { dataActions, moveItemToStage, uiActions, useRow } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { workspaceMessages } from "./messages"
import { PropertyBar, publishedToast } from "./workspace-chips"
import { WorkspaceMenu } from "./workspace-menu"

/** Title (click to edit), provenance line, the next pipeline action and the property chips. */
export function WorkspaceHeader({ item, now, onDeleting }: { item: ContentItem; now: Date; onDeleting: () => void }) {
  const t = useT(workspaceMessages)
  const format = useRow("content_formats", item.format_id)
  const parent = useRow("content_items", item.parent_id)
  const live = PUBLISHED_STAGES.includes(item.stage)
  const updated = parseDate(item.updated_at)

  function markPublished() {
    moveItemToStage(item.id, "published")
    publishedToast(item.id)
  }

  return (
    <header className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-80 items-start gap-3">
          <ContentThumbnail item={item} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <InlineText
              as="h1"
              value={item.title}
              placeholder={t("untitled_content")}
              required
              maxLength={300}
              aria-label={t("title")}
              onSave={(title) => dataActions.update("content_items", item.id, { title })}
            />
            <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                {PLATFORMS[item.platform].label}
                {format ? ` · ${format.name}` : ""}
              </span>
              {parent ? (
                <>
                  <span aria-hidden>·</span>
                  <Link
                    href={`/studio/${parent.id}`}
                    className="inline-flex min-w-0 items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <GitFork className="size-3 shrink-0" aria-hidden />
                    <span className="max-w-72 truncate">
                      {item.repurpose_type
                        ? t("repurposed_type", { type: REPURPOSE_TYPES[item.repurpose_type].label, title: parent.title || t("untitled") })
                        : t("repurposed_from", { title: parent.title || t("untitled") })}
                    </span>
                  </Link>
                </>
              ) : null}
              <ItemCollabChip itemId={item.id} />
              {updated ? (
                <>
                  <span aria-hidden>·</span>
                  <span title={updated.toLocaleString()}>
                    {t("edited", {
                      when: now.getTime() - updated.getTime() < 60_000 ? t("just_now") : formatDistanceStrict(updated, now, { addSuffix: true }),
                    })}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {live ? (
            <Button type="button" size="sm" onClick={() => uiActions.openDialog({ type: "add-metrics", itemId: item.id })}>
              <ChartNoAxesColumn aria-hidden />
              {t("add_analytics")}
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={markPublished}>
              <Send aria-hidden />
              {t("mark_published")}
            </Button>
          )}
          <WorkspaceMenu item={item} onDeleting={onDeleting} />
        </div>
      </div>
      <PropertyBar item={item} now={now} />
    </header>
  )
}
