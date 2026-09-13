"use client"

import { CirclePause, CirclePlay, Ellipsis, FilePlus2, Pencil, Trash2 } from "lucide-react"
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
import { dataActions } from "@/lib/store"
import { pluralize } from "@/lib/utils"
import { setSeriesActive, useCreateNextEpisode } from "./series-actions"
import type { SeriesSummary } from "./series-summary"

export function SeriesActionsMenu({
  summary,
  onEdit,
  onBeforeDelete,
  showCreate = true,
}: {
  summary: SeriesSummary
  onEdit: () => void
  onBeforeDelete?: () => void
  showCreate?: boolean
}) {
  const [confirm, confirmDialog] = useConfirm()
  const createEpisode = useCreateNextEpisode()
  const { series } = summary
  const name = series.name || "Untitled series"

  async function handleDelete() {
    const episodes = summary.episodes.length
    const ok = await confirm({
      title: `Delete “${name}”?`,
      description: episodes
        ? `The series is removed. Its ${pluralize(episodes, "episode")} stay in your workspace as regular content.`
        : "The series is removed. This can’t be undone.",
      confirmLabel: "Delete series",
    })
    if (!ok) return
    onBeforeDelete?.()
    dataActions.remove("content_series", series.id)
    toast.success("Series deleted", { description: name })
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden />
            Edit series…
          </DropdownMenuItem>
          {showCreate ? (
            <DropdownMenuItem onSelect={() => createEpisode(summary)}>
              <FilePlus2 aria-hidden />
              Create episode #{summary.episodes.length + 1}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setSeriesActive(series, !series.is_active)}>
            {series.is_active ? <CirclePause aria-hidden /> : <CirclePlay aria-hidden />}
            {series.is_active ? "Pause series" : "Resume series"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void handleDelete()}>
            <Trash2 aria-hidden />
            Delete series…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  )
}
