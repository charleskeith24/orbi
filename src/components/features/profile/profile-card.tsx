"use client"

import { Globe, MapPin } from "lucide-react"
import { PlatformIcon } from "@/components/common"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { profileLinkHref, profileLinkText } from "@/lib/profiles/links"
import type { PublicProfile } from "@/lib/profiles/types"
import type { ID } from "@/lib/types"
import { cn } from "@/lib/utils"
import { profileCardMessages, profileMessages } from "./messages"
import { ProfileAvatar } from "./profile-avatar"
import { usePhotoUrl, useProfile } from "./profile-store"

/**
 * A profile as connected people see it: photo, name, headline, location, niche (only if shown) and links.
 * `circleName` is the name this person uses in the circle, shown when it differs from their profile name.
 * Also the "How your circles see you" preview in Settings → Profile.
 */
export function ProfileCardBody({
  profile,
  name,
  photoUrl,
  circleName,
  className,
}: {
  profile: PublicProfile | null
  name: string
  photoUrl: string | null
  circleName?: string
  className?: string
}) {
  const t = useT(profileCardMessages)
  const p = useT(profileMessages)
  const shownName = profile?.display_name.trim() || name
  const links = (profile?.links ?? []).map((link) => ({ link, href: profileLinkHref(link) })).filter((l): l is { link: typeof l.link; href: string } => Boolean(l.href))
  const hasDetails = Boolean(profile && (profile.headline || profile.location || profile.niche || links.length))

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <ProfileAvatar name={shownName} photoUrl={photoUrl} className="size-12" fallbackClassName="text-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{shownName}</p>
          {circleName && circleName !== shownName ? <p className="truncate text-xs text-muted-foreground">{t("circle_name", { name: circleName })}</p> : null}
        </div>
      </div>
      {profile?.headline ? <p className="text-sm text-pretty break-words">{profile.headline}</p> : null}
      {profile?.location || profile?.niche ? (
        <dl className="flex flex-col gap-1.5 text-xs">
          {profile.location ? (
            <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <dt className="sr-only">{p("location_label")}</dt>
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <dd className="truncate">{profile.location}</dd>
            </div>
          ) : null}
          {profile.niche ? (
            <div className="flex min-w-0 items-start gap-1.5">
              <dt className="shrink-0 text-muted-foreground">{t("niche")}:</dt>
              <dd className="min-w-0 text-pretty">
                {profile.niche}
                {profile.main_platform ? (
                  <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-muted-foreground">
                    <PlatformIcon platform={profile.main_platform} className="size-3" />
                    {PLATFORMS[profile.main_platform].label}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {links.length ? (
        <ul className="flex flex-col gap-1" aria-label={t("links")}>
          {links.map(({ link, href }, i) => (
            <li key={`${link.platform}-${i}`} className="min-w-0">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex min-w-0 items-center gap-1.5 rounded-sm text-xs underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {link.platform === "website" ? (
                  <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <PlatformIcon platform={link.platform} className="size-3.5 text-muted-foreground" label={PLATFORMS[link.platform].label} />
                )}
                <span className="truncate">{profileLinkText(link)}</span>
                <span className="sr-only">{t("opens_new_tab")}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {!hasDetails ? <p className="text-xs text-muted-foreground">{profile ? t("no_details") : t("not_visible")}</p> : null}
    </div>
  )
}

/**
 * A member's name (and avatar) as a button that opens their profile card. Profiles come from `get_profiles()`,
 * so you only ever see connected people's; anyone else shows their name and a short note.
 */
export function ProfilePopover({
  userId,
  name,
  circleName,
  children,
  className,
}: {
  userId: ID
  /** Fallback name (e.g. the circle display name) while loading or when there's no profile name. */
  name: string
  circleName?: string
  children: React.ReactNode
  className?: string
}) {
  const t = useT(profileCardMessages)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("open", { name })}
          className={cn(
            "-mx-1 flex min-w-0 items-center gap-3 rounded-md px-1 py-0.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
            className
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3.5" aria-label={t("card_label", { name })}>
        <ProfilePopoverBody userId={userId} name={name} circleName={circleName} />
      </PopoverContent>
    </Popover>
  )
}

function ProfilePopoverBody({ userId, name, circleName }: { userId: ID; name: string; circleName?: string }) {
  const t = useT(profileCardMessages)
  const profile = useProfile(userId)
  const photoUrl = usePhotoUrl(profile?.avatar_path)
  if (profile === undefined) {
    return (
      <div role="status" aria-label={t("loading")} className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    )
  }
  return <ProfileCardBody profile={profile} name={name} photoUrl={photoUrl} circleName={circleName} />
}
