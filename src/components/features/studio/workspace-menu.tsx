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
import { PIPELINE_STAGE_MAP, PLATFORMS } from "@/lib/constants"
import { dataActions, duplicateContentItem, uiActions, useDataStore } from "@/lib/store"
import type { ContentItem } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { copyText } from "./studio-utils"

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

/** Workspace overflow menu: related records, copy link, strategist, duplicate and delete (confirmed). */
export function WorkspaceMenu({ item, onDeleting }: { item: ContentItem; onDeleting: () => void }) {
  const router = useRouter()
  const [confirm, confirmDialog] = useConfirm()
  const title = item.title.trim() || "Untitled content"

  function duplicate() {
    const copy = duplicateContentItem(item.id)
    toast.success("Duplicated", { description: `“${copy.title}” is ready in ${PIPELINE_STAGE_MAP[copy.stage]?.label ?? copy.stage}.` })
    router.push(`/studio/${copy.id}`)
  }

  async function copyLink() {
    if (await copyText(`${window.location.origin}/studio/${item.id}`)) toast.success("Link copied")
    else toast.error("Couldn't copy the link", { description: "Copy it from the address bar instead." })
  }

  function askStrategist() {
    const platform = PLATFORMS[item.platform].label
    uiActions.askStrategist(`How can I make my ${platform} piece “${title}” stronger for my audience before it goes out?`)
  }

  async function remove() {
    const db = useDataStore.getState().db
    const scripts = db.content_scripts.filter((s) => s.content_item_id === item.id).length
    const snapshots = db.content_metrics.filter((m) => m.content_item_id === item.id).length
    const children = db.content_items.filter((i) => i.parent_id === item.id).length
    const cascades = joinList(
      ["its brief", scripts ? pluralize(scripts, "script version") : "", snapshots ? pluralize(snapshots, "analytics snapshot") : ""].filter(Boolean)
    )
    const ok = await confirm({
      title: `Delete “${title}”?`,
      description: `This also deletes ${cascades}.${children ? ` ${pluralize(children, "repurposed piece")} stay, without the link back to it.` : ""} This can’t be undone.`,
      confirmLabel: "Delete content",
    })
    if (!ok) return
    onDeleting()
    router.replace("/studio")
    dataActions.remove("content_items", item.id)
    toast.success("Content deleted", { description: title })
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon-sm" aria-label="More actions">
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {item.idea_id ? (
            <DropdownMenuItem asChild>
              <Link href={`/ideas?open=${item.idea_id}`}>
                <Lightbulb aria-hidden />
                Open idea
              </Link>
            </DropdownMenuItem>
          ) : null}
          {item.parent_id ? (
            <DropdownMenuItem asChild>
              <Link href={`/studio/${item.parent_id}`}>
                <GitFork aria-hidden />
                Open source content
              </Link>
            </DropdownMenuItem>
          ) : null}
          {item.campaign_id ? (
            <DropdownMenuItem asChild>
              <Link href={`/campaigns/${item.campaign_id}`}>
                <Megaphone aria-hidden />
                Open campaign
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/pipeline?open=${item.id}`}>
              <SquareKanban aria-hidden />
              Show in Pipeline
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void copyLink()}>
            <Link2 aria-hidden />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={askStrategist}>
            <Sparkles aria-hidden />
            Ask the Content Strategist
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={duplicate}>
            <CopyPlus aria-hidden />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void remove()}>
            <Trash2 aria-hidden />
            Delete content…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  )
}
