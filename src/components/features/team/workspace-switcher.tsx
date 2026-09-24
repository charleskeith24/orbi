"use client"

/**
 * The workspace switcher in the account menu: "My workspace" plus every workspace you're a member of, with
 * the owner's brand name and your role. Switching reloads the store from that workspace and the choice is
 * remembered per device. Renders nothing when you're in no other workspace.
 */
import { Check, Users } from "lucide-react"
import { toast } from "sonner"
import { DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useT } from "@/lib/i18n"
import { teamMessages } from "@/lib/team/messages"
import { switchWorkspace } from "@/components/providers/data-provider"
import { useWorkspaceOwnerId, useWorkspaceRole } from "@/lib/store"
import type { WorkspaceMembership } from "@/lib/team/workspace"
import { useMyWorkspaces } from "./team-store"

export function WorkspaceSwitcher() {
  const t = useT(teamMessages)
  const memberships = useMyWorkspaces()
  const role = useWorkspaceRole()
  const activeOwner = useWorkspaceOwnerId()
  if (!memberships.length) return null

  const open = async (membership: WorkspaceMembership | null) => {
    try {
      await switchWorkspace(membership)
      if (membership) toast.success(t("switched", { name: membership.workspace_name }))
    } catch {
      toast.error(t("err_unknown"))
    }
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Users aria-hidden />
          {t("switcher_label")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-56">
          <DropdownMenuItem onSelect={() => void open(null)}>
            <Check className={role === "owner" ? undefined : "invisible"} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{t("my_workspace")}</span>
          </DropdownMenuItem>
          {memberships.map((membership) => (
            <DropdownMenuItem key={membership.owner_id} onSelect={() => void open(membership)}>
              <Check className={activeOwner === membership.owner_id && role !== "owner" ? undefined : "invisible"} aria-hidden />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate">{membership.workspace_name}</span>
                <span className="truncate text-xs text-muted-foreground">{t(`role_${membership.role}`)}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}
