"use client"

/**
 * Small shared pieces for team workspaces: the role label, a member's name and photo, and the read-only
 * notice that explains a disabled region. Calm UI: a short label, an icon, and the explanation behind an ⓘ.
 */
import { Eye, PencilLine, ShieldCheck, Wallet } from "lucide-react"
import { InfoHint, StatusPill } from "@/components/common"
import { PersonAvatar } from "@/components/features/profile/profile-avatar"
import { useProfile } from "@/components/features/profile/profile-store"
import { useT } from "@/lib/i18n"
import { teamMessages } from "@/lib/team/messages"
import type { WorkspaceRole } from "@/lib/team/permissions"
import { useWorkspaceAccess } from "@/lib/store"
import { canWrite, denialReason } from "@/lib/team/permissions"
import type { ID, TableName } from "@/lib/types"
import { cn } from "@/lib/utils"

const ROLE_ICONS = { owner: ShieldCheck, editor: PencilLine, viewer: Eye } as const

/** The role, as one short word with an icon (status pairs an icon with a label — §5). */
export function RoleBadge({ role, className }: { role: WorkspaceRole; className?: string }) {
  const t = useT(teamMessages)
  return (
    <StatusPill tone="neutral" icon={ROLE_ICONS[role]} className={className}>
      {t(`role_${role}`)}
    </StatusPill>
  )
}

/** "Money: on" only when it is on — an off state needs no chip. */
export function MoneyBadge({ on }: { on: boolean }) {
  const t = useT(teamMessages)
  if (!on) return null
  return (
    <StatusPill tone="neutral" icon={Wallet}>
      {t("money_on")}
    </StatusPill>
  )
}

/** A member's photo and profile name; falls back to "Member" when their profile isn't visible yet. */
export function MemberIdentity({ userId, fallback, className }: { userId: ID; fallback: string; className?: string }) {
  const profile = useProfile(userId)
  const name = profile?.display_name?.trim() || fallback
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <PersonAvatar userId={userId} name={name} className="size-7" fallbackClassName="text-[10px]" />
      <span className="grid min-w-0 leading-tight">
        <span className="truncate text-sm font-medium">{name}</span>
        {profile?.headline ? <span className="truncate text-xs text-muted-foreground">{profile.headline}</span> : null}
      </span>
    </span>
  )
}

/**
 * One line above a region the open role can't change, with the reason behind an ⓘ. Renders nothing when
 * the person may write, so pages can drop it in unconditionally.
 */
export function ReadOnlyNotice({ table, className }: { table: TableName; className?: string }) {
  const t = useT(teamMessages)
  const access = useWorkspaceAccess()
  if (canWrite(table, access)) return null
  const reason = denialReason(table, access) ?? "viewer"
  return (
    <p role="note" className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Eye className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">{t(`refused_${reason}`)}</span>
      <InfoHint title={t(`role_${access.role}`)}>{t(`role_${access.role}_hint`)}</InfoHint>
    </p>
  )
}
