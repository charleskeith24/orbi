"use client"

import { Ellipsis, KeyRound, Mail, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { useScreenLang, useScreenT } from "@/components/app-shell/device-ui-lang"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import type { AdminUserRow } from "@/lib/admin/types"
import { describeAdminError } from "./api/errors"
import { useAdmin } from "./admin-context"
import { adminMessages, usersMessages } from "./messages"

type Action = "resend" | "reset" | "disable" | "enable" | "grant" | "revoke"

/**
 * Row menu on the Users table. Self rows keep the menu but disable disable/delete/remove-admin, with the
 * reason written in the menu (the API refuses them too).
 */
export function UserActionsMenu({
  user,
  onChanged,
  onDelete,
}: {
  user: AdminUserRow
  onChanged: (row: AdminUserRow) => void
  onDelete: (row: AdminUserRow) => void
}) {
  const t = useScreenT(usersMessages)
  const a = useScreenT(adminMessages)
  const lang = useScreenLang()
  const { api } = useAdmin()
  const [confirm, confirmDialog] = useConfirm()
  const [pending, setPending] = useState<Action | null>(null)
  const self = user.is_self

  async function run(action: Action) {
    const email = user.email
    if (action === "disable") {
      const ok = await confirm({
        title: t("disable_title", { email }),
        description: t("disable_body"),
        confirmLabel: t("disable_confirm"),
        cancelLabel: a("cancel"),
      })
      if (!ok) return
    } else if (action === "grant") {
      const ok = await confirm({
        title: t("make_admin_title", { email }),
        description: t("make_admin_body"),
        confirmLabel: t("make_admin_confirm"),
        cancelLabel: a("cancel"),
        destructive: false,
      })
      if (!ok) return
    } else if (action === "revoke") {
      const ok = await confirm({
        title: t("remove_admin_title", { email }),
        description: t("remove_admin_body"),
        confirmLabel: t("remove_admin_confirm"),
        cancelLabel: a("cancel"),
      })
      if (!ok) return
    }

    setPending(action)
    try {
      switch (action) {
        case "resend":
          await api.resendInvite(user.id)
          toast.success(t("resent_toast", { email }))
          break
        case "reset":
          await api.sendPasswordReset(user.id)
          toast.success(t("reset_toast", { email }))
          break
        case "disable":
          onChanged(await api.disableUser(user.id))
          toast.success(t("disabled_toast"), { description: email })
          break
        case "enable":
          onChanged(await api.enableUser(user.id))
          toast.success(t("enabled_toast"), { description: email })
          break
        case "grant":
          onChanged(await api.grantAdmin(user.id))
          toast.success(t("made_admin_toast", { email }))
          break
        case "revoke":
          onChanged(await api.revokeAdmin(user.id))
          toast.success(t("removed_admin_toast"), { description: email })
          break
      }
    } catch (error) {
      toast.error(describeAdminError(error, lang), { description: email })
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("actions_for", { email: user.email })} disabled={pending !== null}>
            {pending ? <Spinner /> : <Ellipsis aria-hidden />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {user.status === "invited" ? (
            <DropdownMenuItem onSelect={() => void run("resend")}>
              <Mail aria-hidden />
              {t("resend_invite")}
            </DropdownMenuItem>
          ) : null}
          {user.status === "active" ? (
            <DropdownMenuItem onSelect={() => void run("reset")}>
              <KeyRound aria-hidden />
              {t("reset_password")}
            </DropdownMenuItem>
          ) : null}
          {user.status === "disabled" ? (
            <DropdownMenuItem onSelect={() => void run("enable")}>
              <UserCheck aria-hidden />
              {t("enable")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={self} onSelect={() => void run("disable")}>
              <UserX aria-hidden />
              {t("disable")}
            </DropdownMenuItem>
          )}
          {user.is_admin ? (
            <DropdownMenuItem disabled={self} onSelect={() => void run("revoke")}>
              <ShieldOff aria-hidden />
              {t("remove_admin")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void run("grant")}>
              <ShieldCheck aria-hidden />
              {t("make_admin")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={self} onSelect={() => onDelete(user)}>
            <Trash2 aria-hidden />
            {t("delete")}
          </DropdownMenuItem>
          {self ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal whitespace-normal text-muted-foreground">{t("self_note")}</DropdownMenuLabel>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  )
}
