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
import { uiActions } from "@/lib/store"
import { newMenuMessages } from "./new-menu-messages"

export interface NewAction {
  key: "quick-capture" | "new-content" | "log-post" | "add-metrics" | "new-collab"
  label: string
  icon: LucideIcon
  /** Keyboard shortcut shown beside it (Quick Capture). */
  shortcut?: string
  run: () => void
}

/**
 * Everything "new" in one list: Quick Capture, New content, Log a post, Add analytics and New collab — the
 * app-wide dialogs, plus the Collab tracker's form (`/collabs?new=1`). Pages don't repeat these buttons.
 */
export function useNewActions(): NewAction[] {
  const t = useT(newMenuMessages)
  const router = useRouter()
  const isMac = useIsMac()
  return [
    {
      key: "quick-capture",
      label: t("quick_capture"),
      icon: Lightbulb,
      shortcut: isMac ? "⌥N" : "Alt+N",
      run: () => uiActions.openDialog({ type: "quick-capture" }),
    },
    { key: "new-content", label: t("new_content"), icon: PenLine, run: () => uiActions.openDialog({ type: "new-content" }) },
    { key: "log-post", label: t("log_post"), icon: Send, run: () => uiActions.openDialog({ type: "log-post" }) },
    { key: "add-metrics", label: t("add_analytics"), icon: ChartColumn, run: () => uiActions.openDialog({ type: "add-metrics" }) },
    { key: "new-collab", label: t("new_collab"), icon: Blend, run: () => router.push("/collabs?new=1") },
  ]
}

/** The top bar's "＋ New" button and its menu (desktop and tablet; phones use the bottom bar's ＋). */
export function NewMenu({ className }: { className?: string }) {
  const t = useT(newMenuMessages)
  const actions = useNewActions()
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
