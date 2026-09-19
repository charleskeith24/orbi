"use client"

import { Flame } from "lucide-react"
import { initialsOf } from "@/lib/circles/names"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { circlesMessages } from "./messages"

/** A neutral initials avatar (members aren't workspace entities, so no identity color). */
export function MemberAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-[10px] font-medium text-muted-foreground",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

/** Up to five overlapping avatars. */
export function MemberStack({ names }: { names: string[] }) {
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-hidden>
      {names.slice(0, 5).map((name, i) => (
        <MemberAvatar key={`${name}-${i}`} name={name} className="size-6 ring-2 ring-card" />
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
