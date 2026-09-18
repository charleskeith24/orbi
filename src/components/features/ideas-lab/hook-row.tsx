"use client"

import { Copy, CopyPlus, Ellipsis, Star, Trash2 } from "lucide-react"
import { PillarBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HOOK_CATEGORIES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions } from "@/lib/store"
import type { ContentPillar, Hook } from "@/lib/types"
import { cn, formatNumber, truncate } from "@/lib/utils"
import { hookMessages } from "./hook-messages"
import { countBlanks, formatHookMetric, type HookStats } from "./hook-model"
import { HookText } from "./hook-text"
import { copyToClipboard } from "./lab-clipboard"

/** Star toggle for `is_favorite`. */
export function FavoriteButton({ hook, className }: { hook: Hook; className?: string }) {
  const t = useT(hookMessages)
  const on = hook.is_favorite
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-pressed={on}
      aria-label={on ? t("remove_favourite") : t("add_favourite")}
      title={on ? t("favourite_title") : t("add_favourite")}
      onClick={() => dataActions.update("hooks", hook.id, { is_favorite: !on })}
      className={cn(on ? "text-foreground" : "text-muted-foreground", className)}
    >
      <Star className={cn(on && "fill-current")} aria-hidden />
    </Button>
  )
}

/** "⋯" for one hook: copy, duplicate, delete. */
export function HookMenu({
  hook,
  onDuplicate,
  onDelete,
  className,
}: {
  hook: Hook
  onDuplicate: (hook: Hook) => void
  onDelete: (hook: Hook) => void
  className?: string
}) {
  const t = useT(hookMessages)
  const c = useT(commonMessages)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("actions_for", { text: truncate(hook.text, 40) })}
          className={cn("text-muted-foreground", className)}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => void copyToClipboard(hook.text, t("hook_copied"))}>
          <Copy aria-hidden />
          {t("copy_text")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDuplicate(hook)}>
          <CopyPlus aria-hidden />
          {t("duplicate")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(hook)}>
          <Trash2 aria-hidden />
          {c("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HookRowStats({ stats, className }: { stats: HookStats; className?: string }) {
  const t = useT(hookMessages)
  const performance = stats.performance
  const cells = [
    { label: t("uses"), value: formatNumber(stats.uses) },
    { label: t("avg_views"), value: performance ? formatHookMetric(performance.avgViews, "views") : "—" },
    { label: t("engagement"), value: performance ? formatHookMetric(performance.engagementRate, "engagement") : "—" },
    { label: t("leads_post"), value: performance ? formatHookMetric(performance.leadsPerPost, "leads") : "—" },
  ]
  return (
    <dl className={cn("grid grid-cols-4 gap-x-4", className)}>
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0 lg:text-right">
          <dt className="truncate text-[11px] text-muted-foreground">{cell.label}</dt>
          <dd className={cn("text-sm num", cell.value === "—" && "text-muted-foreground")}>{cell.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One hook in the library list. The text opens the detail sheet; "Use" fills in the blanks. */
export function HookRow({
  hook,
  stats,
  pillar,
  onOpen,
  onUse,
  onDuplicate,
  onDelete,
}: {
  hook: Hook
  stats: HookStats
  pillar?: ContentPillar
  onOpen: (id: string) => void
  onUse: (hook: Hook) => void
  onDuplicate: (hook: Hook) => void
  onDelete: (hook: Hook) => void
}) {
  const t = useT(hookMessages)
  return (
    <li className="relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 px-2 py-2.5 hover:bg-muted/40 sm:px-3 lg:grid-cols-[auto_minmax(0,1fr)_minmax(16rem,auto)_auto] lg:gap-x-4">
      <FavoriteButton hook={hook} className="relative z-10 mt-px" />
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onOpen(hook.id)}
          className="block w-full text-left text-sm leading-snug outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
        >
          <HookText text={hook.text || t("untitled_hook")} />
        </button>
        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <span>{HOOK_CATEGORIES[hook.category]?.label ?? "Custom"}</span>
          <span aria-hidden>·</span>
          <span>{t(`source_${hook.source}`)}</span>
          {countBlanks(hook.text) ? (
            <>
              <span aria-hidden>·</span>
              <span>{t("template")}</span>
            </>
          ) : null}
          {pillar ? (
            <>
              <span aria-hidden>·</span>
              <PillarBadge pillar={pillar} variant="plain" />
            </>
          ) : null}
        </p>
        <HookRowStats stats={stats} className="mt-2 max-w-sm lg:hidden" />
      </div>
      <HookRowStats stats={stats} className="hidden lg:grid" />
      <div className="relative z-10 flex items-center gap-0.5">
        <Button type="button" variant="outline" size="xs" onClick={() => onUse(hook)}>
          {t("use")}
        </Button>
        <HookMenu hook={hook} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </li>
  )
}
