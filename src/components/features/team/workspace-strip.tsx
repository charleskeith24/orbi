"use client"

/**
 * One compact line under the top bar while you're in somebody else's workspace, so it is never a surprise:
 * the workspace's name, your role, an ⓘ, and a way back to your own. Same shape as `WorkspaceBanner`.
 */
import { LogOut, Users } from "lucide-react"
import { InfoHint } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useDataStatus, useWorkspaceAccess, useWorkspaceOwnerId } from "@/lib/store"
import { teamMessages } from "@/lib/team/messages"
import { switchWorkspace } from "@/components/providers/data-provider"
import { useMyWorkspaces } from "./team-store"

export function WorkspaceStrip() {
  const t = useT(teamMessages)
  const access = useWorkspaceAccess()
  const ownerId = useWorkspaceOwnerId()
  const { status } = useDataStatus()
  const memberships = useMyWorkspaces()
  if (status !== "ready" || access.role === "owner") return null
  // Until the memberships arrive the workspace has no name yet: say nothing rather than something wrong.
  const name = memberships.find((m) => m.owner_id === ownerId)?.workspace_name
  if (!name) return null

  return (
    <div data-print="hide" role="status" className="flex h-8 items-center gap-2 border-b bg-brand-soft/60 px-4 text-xs text-muted-foreground">
      <Users className="size-3.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-medium text-foreground">{t("in_workspace", { name })}</span> · {t(`role_${access.role}`)}
      </p>
      <InfoHint title={t("in_workspace", { name })} side="bottom" align="end">
        {t("in_workspace_info")}
      </InfoHint>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        aria-label={t("back_to_mine")}
        className="-mr-1 shrink-0 font-medium text-foreground"
        onClick={() => void switchWorkspace(null)}
      >
        <LogOut className="sm:hidden" aria-hidden />
        <span className="hidden sm:inline">{t("back_to_mine")}</span>
      </Button>
    </div>
  )
}
