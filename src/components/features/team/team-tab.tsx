"use client"

/**
 * Settings → Team.
 *
 * In your own workspace: the members (role, Money access, joined, remove), the pending invites, and the
 * invite form. In somebody else's: your role and "Leave workspace" — team management belongs to the owner.
 * Local mode has no accounts, so it says so honestly.
 */
import { HardDrive, LogOut, MailPlus, RefreshCw, Trash2, UserPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Disclosure, EmptyState, InfoHint, SectionHeader, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { formatShortDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useIsGuestWorkspace, useWorkspaceAccess, useWorkspaceOwnerId } from "@/lib/store"
import { teamMessages } from "@/lib/team/messages"
import { MEMBER_ROLES, TEAM_LIMITS, type MemberRole } from "@/lib/team/permissions"
import { teamErrorKey, toTeamError } from "@/lib/team/types"
import type { WorkspaceMember } from "@/lib/team/workspace"
import { switchWorkspace } from "@/components/providers/data-provider"
import { InviteDialog } from "./invite-dialog"
import { teamActions, useMyTeam, useMyWorkspaces, useTeamBusy, useTeamSource, useTeamStatus } from "./team-store"
import { MemberIdentity, MoneyBadge, RoleBadge } from "./team-ui"

export function TeamTab({ now }: { now: Date }) {
  const status = useTeamStatus()
  const guest = useIsGuestWorkspace()
  if (status === "local") return <TeamLocalNotice />
  if (guest) return <MemberView />
  return <OwnerView now={now} />
}

/* --------------------------------- Owner ---------------------------------- */

function OwnerView({ now }: { now: Date }) {
  const t = useT(teamMessages)
  const c = useT(commonMessages)
  const team = useMyTeam()
  const status = useTeamStatus()
  const busy = useTeamBusy()
  const source = useTeamSource()
  const [inviting, setInviting] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const members = team?.members ?? []
  const invites = team?.invites ?? []
  const used = members.length + invites.length
  const left = Math.max(0, TEAM_LIMITS.members - used)

  const change = async (member: WorkspaceMember, patch: { role?: MemberRole; moneyAccess?: boolean }) => {
    try {
      await teamActions.run((api) =>
        api.setMember(member.user_id, { role: patch.role ?? member.role, moneyAccess: patch.moneyAccess ?? member.money_access })
      )
      toast.success(t("member_saved"))
    } catch (error) {
      toast.error(t(teamErrorKey(toTeamError(error).code)))
    }
  }

  const remove = async (member: WorkspaceMember) => {
    const ok = await confirm({ title: t("remove_title"), description: t("remove_body"), confirmLabel: c("remove") })
    if (!ok) return
    try {
      await teamActions.run((api) => api.removeMember(member.user_id))
      toast.success(t("removed"))
    } catch (error) {
      toast.error(t(teamErrorKey(toTeamError(error).code)))
    }
  }

  const cancel = async (inviteId: string) => {
    try {
      await teamActions.run((api) => api.cancelInvite(inviteId))
      toast.success(t("invite_cancelled"))
    } catch (error) {
      toast.error(t(teamErrorKey(toTeamError(error).code)))
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setInviting(true)} disabled={left === 0 || busy}>
          <UserPlus aria-hidden />
          {t("invite")}
        </Button>
        <span className="text-xs text-muted-foreground">{left === 0 ? t("seats_full") : t.plural("seats_left", left, { count: left })}</span>
        <InfoHint title={t("tab_title")}>{t("tab_info")}</InfoHint>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void teamActions.refresh()} disabled={status === "loading"}>
          <RefreshCw aria-hidden />
          {t("refresh")}
        </Button>
      </div>

      {source === "fixture" ? <SampleNote /> : null}

      <section className="flex min-w-0 flex-col gap-3">
        <SectionHeader title={t("members_title")} count={members.length} />
        {status === "loading" && !team ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : members.length === 0 ? (
          <EmptyState icon={UserPlus} title={t("members_empty")} action={<Button size="sm" onClick={() => setInviting(true)}>{t("invite")}</Button>} />
        ) : (
          <ul className="flex min-w-0 flex-col divide-y rounded-lg border bg-card">
            {members.map((member) => (
              <li key={member.user_id} className="flex min-w-0 flex-wrap items-center gap-3 p-4">
                <MemberIdentity userId={member.user_id} fallback={t(`role_${member.role}`)} className="min-w-40 flex-1" />
                <span className="text-xs text-muted-foreground">{t("joined", { date: formatShortDate(member.joined_at) })}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {MEMBER_ROLES.map((role) => (
                    <Button
                      key={role}
                      size="xs"
                      variant={member.role === role ? "secondary" : "ghost"}
                      aria-pressed={member.role === role}
                      disabled={busy}
                      onClick={() => void change(member, { role })}
                    >
                      {t(`role_${role}`)}
                    </Button>
                  ))}
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="sr-only sm:not-sr-only">{t("money_access")}</span>
                    <Switch
                      aria-label={t("money_access")}
                      checked={member.money_access}
                      disabled={busy}
                      onCheckedChange={(value) => void change(member, { moneyAccess: value })}
                    />
                  </label>
                  <Button size="xs" variant="ghost" disabled={busy} onClick={() => void remove(member)} aria-label={t("remove")}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <SectionHeader title={t("invites_title")} count={invites.length} />
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("invites_empty")}</p>
        ) : (
          <ul className="flex min-w-0 flex-col divide-y rounded-lg border bg-card">
            {invites.map((invite) => (
              <li key={invite.id} className="flex min-w-0 flex-wrap items-center gap-3 p-4">
                <MailPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-40 flex-1 truncate text-sm">{invite.email}</span>
                <RoleBadge role={invite.role} />
                <MoneyBadge on={invite.money_access} />
                <span className="text-xs text-muted-foreground">{t("invited", { date: formatShortDate(invite.created_at) })}</span>
                <Button size="xs" variant="ghost" disabled={busy} onClick={() => void cancel(invite.id)}>
                  {t("invite_cancel")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Disclosure label={t("concurrent_label")} variant="inline">
        <p className="text-sm text-muted-foreground">{t("concurrent_info")}</p>
      </Disclosure>

      <InviteDialog open={inviting} onOpenChange={setInviting} />
      {confirmDialog}
      {/* `now` keeps the tab's signature in step with the other Settings tabs. */}
      <span className="hidden" aria-hidden data-now={now.toISOString()} />
    </div>
  )
}

/* --------------------------------- Member --------------------------------- */

function MemberView() {
  const t = useT(teamMessages)
  const access = useWorkspaceAccess()
  const ownerId = useWorkspaceOwnerId()
  const memberships = useMyWorkspaces()
  const busy = useTeamBusy()
  const [confirm, confirmDialog] = useConfirm()
  const name = memberships.find((m) => m.owner_id === ownerId)?.workspace_name ?? t("switcher_label")

  const leave = async () => {
    const ok = await confirm({ title: t("leave_title", { name }), description: t("leave_body"), confirmLabel: t("leave") })
    if (!ok) return
    try {
      await teamActions.run((api) => api.leave(ownerId))
      await switchWorkspace(null)
      toast.success(t("left", { name }))
    } catch (error) {
      toast.error(t(teamErrorKey(toTeamError(error).code)))
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4">
        <SectionHeader title={t("member_view_title")} info={t("in_workspace_info")} />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <RoleBadge role={access.role} />
          <MoneyBadge on={access.moneyAccess} />
        </div>
        <p className="text-sm text-muted-foreground">{t("member_view_body", { name, role: t(`role_${access.role}`) })}</p>
        <p className="text-xs text-muted-foreground">{t(`role_${access.role}_hint`)}</p>
        <p className="text-xs text-muted-foreground">{t("owner_only_notice")}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void leave()}>
            <LogOut aria-hidden />
            {t("leave")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void switchWorkspace(null)}>
            {t("back_to_mine")}
          </Button>
        </div>
      </section>
      {confirmDialog}
    </div>
  )
}

/* ------------------------------- Local mode ------------------------------- */

function TeamLocalNotice() {
  const t = useT(teamMessages)
  return (
    <section className="flex min-w-0 items-start gap-3 rounded-lg border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <HardDrive className="size-4.5 text-muted-foreground" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-semibold">{t("local_title")}</h3>
        <p className="text-sm text-muted-foreground">{t("local_body")}</p>
        <p className="mt-1.5 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">docs/DEPLOY.md</p>
      </div>
    </section>
  )
}

function SampleNote() {
  const t = useT(teamMessages)
  return (
    <p role="note" className="text-xs text-muted-foreground">
      {t("sample_note")}
    </p>
  )
}
