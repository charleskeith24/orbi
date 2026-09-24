"use client"

/**
 * "Mika invited you to their workspace as Editor — Accept / Decline", one line under the top bar. The
 * invite itself lives in the database; accepting adds the membership with the role the owner chose.
 */
import { MailPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { teamMessages } from "@/lib/team/messages"
import { teamErrorKey, toTeamError } from "@/lib/team/types"
import { useDataStatus } from "@/lib/store"
import { teamActions, useMyInvites, useTeamStore } from "./team-store"

export function InviteBanner() {
  const t = useT(teamMessages)
  const invites = useMyInvites()
  const { status } = useDataStatus()
  const busy = useTeamStore((s) => s.busy)
  const [answering, setAnswering] = useState<string | null>(null)
  const invite = invites[0]
  if (status !== "ready" || !invite) return null

  const answer = async (accept: boolean) => {
    setAnswering(invite.owner_id)
    try {
      const result = await teamActions.run((api) => api.respond(invite.owner_id, accept))
      if (result === "accepted") toast.success(t("accepted", { name: invite.workspace_name }))
      else toast.success(t("declined"))
    } catch (error) {
      toast.error(t(teamErrorKey(toTeamError(error).code)))
    } finally {
      setAnswering(null)
    }
  }

  const pending = busy && answering === invite.owner_id
  return (
    <div data-print="hide" role="status" className="flex min-h-8 flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-1 text-xs text-muted-foreground">
      <MailPlus className="size-3.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-foreground">
        {t("banner_invited", { name: invite.workspace_name, role: t(`role_${invite.role}`) })}
      </p>
      <Button type="button" size="xs" disabled={pending} onClick={() => void answer(true)}>
        {t("accept")}
      </Button>
      <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => void answer(false)}>
        {t("decline")}
      </Button>
    </div>
  )
}
