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
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import { formatNumber } from "@/lib/utils"
import { seriesMessages } from "./messages"
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
  const t = useT(seriesMessages)
  const [confirm, confirmDialog] = useConfirm()
  const createEpisode = useCreateNextEpisode()
  const { series } = summary
  const name = series.name || t("untitled_series")

  async function handleDelete() {
    const episodes = summary.episodes.length
    const ok = await confirm({
      title: t("delete_title", { name }),
      description: episodes ? t.plural("delete_with_episodes", episodes, { count: formatNumber(episodes) }) : t("delete_plain"),
      confirmLabel: t("delete_confirm"),
    })
    if (!ok) return
    onBeforeDelete?.()
    dataActions.remove("content_series", series.id)
    toast.success(t("deleted"), { description: name })
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("actions_for", { name })}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden />
            {t("edit_series_menu")}
          </DropdownMenuItem>
          {showCreate ? (
            <DropdownMenuItem onSelect={() => createEpisode(summary)}>
              <FilePlus2 aria-hidden />
              {t("create_episode", { number: summary.episodes.length + 1 })}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setSeriesActive(series, !series.is_active)}>
            {series.is_active ? <CirclePause aria-hidden /> : <CirclePlay aria-hidden />}
            {series.is_active ? t("pause_series") : t("resume_series")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void handleDelete()}>
            <Trash2 aria-hidden />
            {t("delete_series_menu")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  )
}
