"use client"

import { CopyPlus, Ellipsis, GitFork, Lightbulb, Link2, Megaphone, Sparkles, SquareKanban, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT } from "@/lib/i18n"
import { PIPELINE_STAGE_MAP, PLATFORMS } from "@/lib/constants"
import { dataActions, duplicateContentItem, uiActions, useDataStore } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { workspaceMessages } from "./messages"
import { copyText } from "./studio-utils"

function joinList(parts: string[], and: string): string {
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`
}

/** Workspace overflow menu: related records, copy link, strategist, duplicate and delete (confirmed). */
export function WorkspaceMenu({ item, onDeleting }: { item: ContentItem; onDeleting: () => void }) {
  const t = useT(workspaceMessages)
  const router = useRouter()
  const [confirm, confirmDialog] = useConfirm()
  const title = item.title.trim() || t("untitled_content")

  function duplicate() {
    const copy = duplicateContentItem(item.id)
    toast.success(t("duplicated"), {
      description: t("duplicated_description", { title: copy.title, stage: PIPELINE_STAGE_MAP[copy.stage]?.label ?? copy.stage }),
    })
    router.push(`/studio/${copy.id}`)
  }

  async function copyLink() {
    if (await copyText(`${window.location.origin}/studio/${item.id}`)) toast.success(t("link_copied"))
    else toast.error(t("link_copy_failed"), { description: t("link_copy_failed_description") })
  }

  function askStrategist() {
    const platform = PLATFORMS[item.platform].label
    uiActions.askStrategist(t("strategist_question", { platform, title }))
  }

  async function remove() {
    const db = useDataStore.getState().db
    const scripts = db.content_scripts.filter((s) => s.content_item_id === item.id).length
    const snapshots = db.content_metrics.filter((m) => m.content_item_id === item.id).length
    const children = db.content_items.filter((i) => i.parent_id === item.id).length
    const cascades = joinList(
      [
        t("its_brief"),
        scripts ? t.plural("script_versions", scripts, { count: formatNumber(scripts) }) : "",
        snapshots ? t.plural("snapshots", snapshots, { count: formatNumber(snapshots) }) : "",
      ].filter(Boolean),
      t("and")
    )
    const ok = await confirm({
      title: t("delete_title", { title }),
      description: t("delete_description", {
        cascades,
        children: children ? t.plural("children_stay", children, { count: formatNumber(children) }) : "",
      }),
      confirmLabel: t("delete_confirm"),
    })
    if (!ok) return
    onDeleting()
    router.replace("/studio")
    dataActions.remove("content_items", item.id)
    toast.success(t("deleted"), { description: title })
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon-sm" aria-label={t("more_actions")}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {item.idea_id ? (
            <DropdownMenuItem asChild>
              <Link href={`/ideas?open=${item.idea_id}`}>
                <Lightbulb aria-hidden />
                {t("open_idea")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {item.parent_id ? (
            <DropdownMenuItem asChild>
              <Link href={`/studio/${item.parent_id}`}>
                <GitFork aria-hidden />
                {t("open_source")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {item.campaign_id ? (
            <DropdownMenuItem asChild>
              <Link href={`/campaigns/${item.campaign_id}`}>
                <Megaphone aria-hidden />
                {t("open_campaign")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/pipeline?open=${item.id}`}>
              <SquareKanban aria-hidden />
              {t("show_in_pipeline")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void copyLink()}>
            <Link2 aria-hidden />
            {t("copy_link")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={askStrategist}>
            <Sparkles aria-hidden />
            {t("ask_strategist")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={duplicate}>
            <CopyPlus aria-hidden />
            {t("duplicate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void remove()}>
            <Trash2 aria-hidden />
            {t("delete_menu")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  )
}
