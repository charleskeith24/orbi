"use client"

import { FilePlus2, Link2, X } from "lucide-react"
import Link from "next/link"
import { PlatformIcon, StageBadge } from "@/components/common"
import { ContentCombobox } from "@/components/features/money/money-ui"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { uiActions, useLookup } from "@/lib/store"
import type { Collab, ContentItem, InsertRow } from "@/lib/types"
import { linkContentToCollab, unlinkContentFromCollab } from "./collab-actions"
import { collabSheetMessages } from "./messages"

/** Opens the New content dialog pre-filled from the collab and linked to it. */
export function openNewContentForCollab(collab: Collab) {
  const defaults: InsertRow<"content_items"> = {
    ...(collab.title.trim() ? { title: collab.title.trim() } : {}),
    ...(collab.partner_platform ? { platform: collab.partner_platform } : {}),
    pillar_id: collab.pillar_id,
    goal_id: collab.goal_id,
    campaign_id: collab.campaign_id,
    due_date: collab.collab_date,
  }
  uiActions.openDialog({ type: "new-content", defaults, collabId: collab.id })
}

/** Your posts made for the collab: linked items, "Link existing" and "Create content for this collab". */
export function CollabContentSection({ collab }: { collab: Collab }) {
  const t = useT(collabSheetMessages)
  const items = useLookup("content_items")
  const linked = collab.content_item_ids.map((id) => items.get(id)).filter((i): i is ContentItem => Boolean(i))

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {linked.length ? (
        <ul className="flex flex-col divide-y rounded-lg border">
          {linked.map((item) => {
            const title = item.title.trim() || t("untitled_content")
            return (
              <li key={item.id} className="flex min-w-0 items-center gap-2 py-1.5 pr-1.5 pl-3">
                <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                <Link href={`/studio/${item.id}`} className="min-w-0 flex-1 truncate text-sm underline-offset-2 outline-none hover:underline focus-visible:underline">
                  {title}
                </Link>
                <StageBadge stage={item.stage} className="max-sm:hidden" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label={t("unlink", { title })}
                  onClick={() => unlinkContentFromCollab(collab, item.id, title)}
                >
                  <X aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-pretty text-muted-foreground">{t("content_empty")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <ContentCombobox
          value={null}
          onChange={(id) => id && linkContentToCollab(collab.id, [id])}
          excludeIds={collab.content_item_ids}
          placeholder={t("link_existing")}
          searchPlaceholder={t("search_content")}
          emptyText={t("no_content")}
          trigger={
            <Button type="button" variant="outline" size="sm">
              <Link2 aria-hidden />
              {t("link_existing")}
            </Button>
          }
        />
        <Button type="button" variant="outline" size="sm" onClick={() => openNewContentForCollab(collab)}>
          <FilePlus2 aria-hidden />
          {t("create_content")}
        </Button>
      </div>
    </div>
  )
}
