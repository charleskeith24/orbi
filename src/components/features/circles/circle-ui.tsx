"use client"

import { Flame } from "lucide-react"
import { PersonAvatar, ProfileAvatar } from "@/components/features/profile/profile-avatar"
import { useT } from "@/lib/i18n"
import type { ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { circlesMessages } from "./messages"

/**
 * A member's avatar: their profile photo when you may see it (circle-mates can — `get_profiles()`), otherwise
 * neutral initials of their circle name (members aren't workspace entities, so no identity color).
 */
export function MemberAvatar({ name, userId, className }: { name: string; userId?: ID; className?: string }) {
  const classes = cn("size-7 shrink-0", className)
  return userId ? <PersonAvatar userId={userId} name={name} className={classes} /> : <ProfileAvatar name={name} photoUrl={null} className={classes} />
}

/** Up to five overlapping avatars. */
export function MemberStack({ members }: { members: { userId: ID; name: string }[] }) {
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-hidden>
      {members.slice(0, 5).map((member) => (
        <MemberAvatar key={member.userId} userId={member.userId} name={member.name} className="size-6 ring-2 ring-card" />
      ))}
    </span>
  )
}

/** "3-week streak" with a flame; muted "No streak yet" at 0. Calm: no colors that rank people. */
export function StreakLabel({ weeks, compact = false, className }: { weeks: number; compact?: boolean; className?: string }) {
  const t = useT(circlesMessages)
  if (weeks <= 0) return compact ? null : <span className={cn("text-xs text-muted-foreground", className)}>{t("no_streak")}</span>
  const label = t.plural("streak", weeks)
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)} title={label}>
      <Flame className="size-3.5 text-foreground/70" aria-hidden />
      {compact ? (
        <>
          <span className="num text-foreground">{weeks}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </span>
  )
}
