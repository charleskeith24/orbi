"use client"

import { Archive, ArchiveRestore, ArrowRightLeft, ChevronDown, Layers, Signal, Trash2, X } from "lucide-react"
import { ColorDot, IDEA_STATUS_ICONS, PriorityIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { IDEA_STATUS_MAP, PRIORITIES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useTable } from "@/lib/store"
import type { ContentIdea } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { useIdeaActions } from "./idea-actions"
import { ACTIVE_STATUSES } from "./idea-model"
import { ideaBankMessages } from "./messages"

/** Toolbar for the table selection: status, priority, pillar, archive/restore, delete. */
export function IdeaBulkBar({ selected, onClear }: { selected: ContentIdea[]; onClear: () => void }) {
  const actions = useIdeaActions()
  const t = useT(ideaBankMessages)
  const c = useT(commonMessages)
  const pillars = useTable("content_pillars")
  const ids = selected.map((i) => i.id)
  const archived = selected.filter((i) => i.status === "archived").length
  const activePillars = [...pillars].filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div
      role="toolbar"
      aria-label={t("bulk_label")}
      className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 shadow-xs"
    >
      <span className="px-1 text-sm font-medium num">{t("selected", { count: formatNumber(selected.length) })}</span>
      <Separator orientation="vertical" className="mx-1 data-vertical:h-4" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <ArrowRightLeft aria-hidden />
            {t("bulk_status")}
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{t("bulk_move_to", { count: formatNumber(selected.length) })}</DropdownMenuLabel>
          {ACTIVE_STATUSES.map((status) => {
            const Icon = IDEA_STATUS_ICONS[status]
            return (
              <DropdownMenuItem key={status} onSelect={() => actions.setStatus(ids, status)}>
                <Icon className="text-muted-foreground" aria-hidden />
                {IDEA_STATUS_MAP[status].label}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <p className="px-1.5 py-1 text-xs text-pretty text-muted-foreground">
            {t("bulk_convert_note")}
          </p>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <Signal aria-hidden />
            {t("bulk_priority")}
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {PRIORITIES.map((priority) => (
            <DropdownMenuItem key={priority.id} onSelect={() => actions.setPriority(ids, priority.id)}>
              <PriorityIcon priority={priority.id} className="text-muted-foreground" />
              {priority.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <Layers aria-hidden />
            {t("bulk_pillar")}
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {activePillars.map((pillar) => (
            <DropdownMenuItem key={pillar.id} onSelect={() => actions.setPillar(ids, pillar.id)}>
              <ColorDot color={pillar.color} />
              {pillar.name || t("untitled_pillar")}
            </DropdownMenuItem>
          ))}
          {activePillars.length ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem onSelect={() => actions.setPillar(ids, null)} className="text-muted-foreground">
            {t("no_pillar")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {archived ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => actions.restore(ids)}>
          <ArchiveRestore aria-hidden />
          {t("restore")}
        </Button>
      ) : null}
      {archived < selected.length ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            actions.archive(ids)
            onClear()
          }}
        >
          <Archive aria-hidden />
          {t("archive")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={async () => {
          if (await actions.remove(ids)) onClear()
        }}
      >
        <Trash2 aria-hidden />
        {c("delete")}
      </Button>

      <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={onClear}>
        <X aria-hidden />
        {c("clear")}
      </Button>
    </div>
  )
}
