"use client"

import { Blend, ChartColumn, Lightbulb, PenLine, Plus, Send, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useIsMac } from "@/components/app-shell/keyboard-shortcuts"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT } from "@/lib/i18n"
import { uiActions, useWorkspaceAccess } from "@/lib/store"
import { teamMessages } from "@/lib/team/messages"
import { canWrite } from "@/lib/team/permissions"
import type { TableName } from "@/lib/types"
import { newMenuMessages } from "./new-menu-messages"

export interface NewAction {
  key: "quick-capture" | "new-content" | "log-post" | "add-metrics" | "new-collab"
  label: string
  icon: LucideIcon
  /** Keyboard shortcut shown beside it (Quick Capture). */
  shortcut?: string
  /** The table the action writes: a role that can't write it doesn't get the action (ARCHITECTURE §17). */
  table: TableName
  run: () => void
}

/**
 * Everything "new" in one list: Quick Capture, New content, Log a post, Add analytics and New collab — the
 * app-wide dialogs, plus the Collab tracker's form (`/collabs?new=1`). Pages don't repeat these buttons.
 *
 * In somebody else's workspace only the actions the role may actually write are returned, so a Viewer gets
 * an empty list (the ＋ button then explains instead of opening).
 */
export function useNewActions(): NewAction[] {
  const t = useT(newMenuMessages)
  const router = useRouter()
  const isMac = useIsMac()
  const access = useWorkspaceAccess()
  return ([
    {
      key: "quick-capture",
      label: t("quick_capture"),
      icon: Lightbulb,
      shortcut: isMac ? "⌥N" : "Alt+N",
      table: "content_ideas",
      run: () => uiActions.openDialog({ type: "quick-capture" }),
    },
    { key: "new-content", label: t("new_content"), icon: PenLine, table: "content_items", run: () => uiActions.openDialog({ type: "new-content" }) },
    { key: "log-post", label: t("log_post"), icon: Send, table: "content_items", run: () => uiActions.openDialog({ type: "log-post" }) },
    {
      key: "add-metrics",
      label: t("add_analytics"),
      icon: ChartColumn,
      table: "content_metrics",
      run: () => uiActions.openDialog({ type: "add-metrics" }),
    },
    { key: "new-collab", label: t("new_collab"), icon: Blend, table: "collabs", run: () => router.push("/collabs?new=1") },
  ] satisfies NewAction[]).filter((action) => canWrite(action.table, access))
}

/** The top bar's "＋ New" button and its menu (desktop and tablet; phones use the bottom bar's ＋). */
export function NewMenu({ className }: { className?: string }) {
  const t = useT(newMenuMessages)
  const team = useT(teamMessages)
  const actions = useNewActions()
  // A Viewer has nothing to create: the button stays, disabled, and says why (§10: no dead buttons).
  if (!actions.length) {
    return (
      <Button size="sm" className={className} disabled title={team("refused_viewer")} aria-label={`${t("new")} — ${team("refused_viewer")}`}>
        <Plus aria-hidden />
        <span>{t("new")}</span>
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className={className}>
          <Plus aria-hidden />
          <span>{t("new")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-52">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <DropdownMenuItem key={action.key} onSelect={action.run}>
              <Icon aria-hidden />
              {action.label}
              {action.shortcut ? <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
