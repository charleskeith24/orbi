"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { profileInitials } from "@/lib/profiles/profile"
import type { ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { usePhotoUrl, useProfile } from "./profile-store"

/**
 * A person's avatar: their profile photo when there is one, otherwise their initials on a neutral circle
 * (people aren't workspace entities, so no identity color). Decorative by default — the name is shown next to it;
 * pass `alt` when it stands alone.
 */
export function ProfileAvatar({
  name,
  photoUrl,
  alt = "",
  className,
  fallbackClassName,
}: {
  name: string
  photoUrl: string | null | undefined
  alt?: string
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar className={cn("size-7", className)} aria-hidden={alt ? undefined : true}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={alt} draggable={false} className="rounded-[inherit]" /> : null}
      <AvatarFallback className={cn("rounded-[inherit] text-[10px] font-medium text-muted-foreground", fallbackClassName)}>{profileInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

/**
 * The avatar for a user id: looks up the profile you may see (`get_profiles()` — circle-mates, team members) and
 * its photo. Falls back to `name`'s initials while loading, and for anyone whose profile you can't see.
 */
export function PersonAvatar({ userId, name, className, fallbackClassName }: { userId: ID; name: string; className?: string; fallbackClassName?: string }) {
  const profile = useProfile(userId)
  const photoUrl = usePhotoUrl(profile?.avatar_path)
  return <ProfileAvatar name={name} photoUrl={photoUrl} className={className} fallbackClassName={fallbackClassName} />
}
