"use client"

import { ArrowRightLeft, Ellipsis, ExternalLink, Link2, PanelRightOpen, ScanSearch, Trash2, WandSparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RESEARCH_STATUSES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { ResearchItem, ResearchStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { researchMessages } from "./messages"
import { useResearchActions } from "./research-actions"
import { RESEARCH_STATUS_ICONS } from "./research-badges"
import { isHttpUrl } from "./research-model"

/** "⋯" menu for one reference: open, analyze, adapt, open source, status, copy link, delete. */
export function ResearchActionsMenu({ item, inSheet = false, className }: { item: ResearchItem; inSheet?: boolean; className?: string }) {
  const t = useT(researchMessages)
  const actions = useResearchActions()
  const title = item.title.trim() || t("untitled")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={t("actions_for", { title })} className={cn("text-muted-foreground", className)}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {inSheet ? null : (
          <DropdownMenuItem onSelect={() => actions.open(item.id)}>
            <PanelRightOpen aria-hidden />
            {t("open_details")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.analyze(item)}>
          <ScanSearch aria-hidden />
          {item.analysis ? t("reanalyze") : t("analyze")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/research/adapt?from=${item.id}`}>
            <WandSparkles aria-hidden />
            {t("adapt")}
          </Link>
        </DropdownMenuItem>
        {isHttpUrl(item.url) ? (
          <DropdownMenuItem asChild>
            <a href={item.url.trim()} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              {t("open_source_link")}
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRightLeft aria-hidden />
            {t("status")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuRadioGroup value={item.status} onValueChange={(next) => actions.setStatus(item, next as ResearchStatus)}>
              {RESEARCH_STATUSES.map((status) => {
                const Icon = RESEARCH_STATUS_ICONS[status.id]
                return (
                  <DropdownMenuRadioItem key={status.id} value={status.id}>
                    <Icon className="text-muted-foreground" aria-hidden />
                    {status.label}
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => actions.copyLink(item)}>
          <Link2 aria-hidden />
          {t("copy_link")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove(item)}>
          <Trash2 aria-hidden />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
