"use client"

import type { User } from "@supabase/supabase-js"
import { CircleUserRound, Download, KeyRound, LogIn, LogOut, MessageSquarePlus, Monitor, Moon, Settings, ShieldCheck, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useRef, useState } from "react"
import { themeMessages } from "@/components/app-shell/theme-toggle-messages"
import { useIsAdmin } from "@/components/features/admin/use-is-admin"
import { describeUser, useAuthUser } from "@/components/features/auth/use-auth-user"
import { FeedbackDialog } from "@/components/features/feedback/feedback-dialog"
import { m as feedbackMessages } from "@/components/features/feedback/messages"
import { ProfileAvatar } from "@/components/features/profile/profile-avatar"
import { useMyProfile, usePhotoUrl } from "@/components/features/profile/profile-store"
import { useInstallOrbi } from "@/components/features/pwa/install-orbi"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n"
import { profileName } from "@/lib/profiles/profile"
import { useBrand } from "@/lib/store"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { userMenuMessages } from "./user-menu-messages"

/** Settings → Profile. */
const PROFILE_HREF = "/settings?tab=profile"

/**
 * The account avatar at the end of the top bar and its menu: your profile photo and name, then Profile, Settings,
 * Theme, Feedback and "Install Orbi" — plus Set a password, Admin (admins only) and Sign out online. In local mode,
 * which has no accounts, it shows the profile kept on this device (Settings → Profile).
 */
export function UserMenu() {
  if (!isSupabaseConfigured) return <LocalProfileMenu />
  return <AccountMenu />
}

/** Local mode: your device-only profile (name falls back to Brand HQ's name). */
function LocalProfileMenu() {
  const t = useT(userMenuMessages)
  const brand = useBrand()
  const { me } = useMyProfile()
  const photoUrl = usePhotoUrl(me?.avatar_path)
  const name = profileName(me?.display_name, brand.name.trim() || t("your_profile"))
  return <ProfileMenuView name={name} subtitle={t("local_subtitle")} photoUrl={photoUrl} account={null} />
}

function AccountMenu() {
  const { user, loading } = useAuthUser()
  const t = useT(userMenuMessages)

  if (loading) return <Skeleton className="size-8 rounded-full" />

  if (!user) {
    // Session ended (e.g. signed out in another tab): offer the way back instead of an empty slot.
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/login">
          <LogIn aria-hidden />
          {t("sign_in")}
        </Link>
      </Button>
    )
  }

  return <AccountMenuView user={user} />
}

/**
 * The menu for a known user: profile photo and display name (else the sign-up name or the email's local part)
 * with the email.
 */
export function AccountMenuView({ user }: { user: Pick<User, "email" | "user_metadata"> }) {
  const { me } = useMyProfile()
  const photoUrl = usePhotoUrl(me?.avatar_path)
  const display = describeUser(user)
  const name = profileName(me?.display_name, display.name)
  return <ProfileMenuView name={name} subtitle={display.email} photoUrl={photoUrl} account={{ email: display.email }} />
}

/** `account` = online items (Set a password, Admin, Sign out); null in local mode. */
function ProfileMenuView({
  name,
  subtitle,
  photoUrl,
  account,
}: {
  name: string
  subtitle: string
  photoUrl: string | null
  account: { email: string } | null
}) {
  const t = useT(userMenuMessages)
  const th = useT(themeMessages)
  const fb = useT(feedbackMessages)
  const { theme, setTheme } = useTheme()
  const isAdmin = useIsAdmin()
  const signOutForm = useRef<HTMLFormElement>(null)
  // Set when a menu item opens a dialog, so the closing menu doesn't pull focus back to its trigger.
  const openingDialog = useRef(false)
  const install = useInstallOrbi()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <>
      {/* Lives outside the menu portal so it stays mounted while the menu closes. */}
      {account ? <form ref={signOutForm} action="/auth/signout" method="post" hidden /> : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-slot="account-trigger"
            aria-label={t("menu_label", { name })}
            title={account?.email ?? name}
            className="relative flex size-8 shrink-0 items-center justify-center rounded-full outline-none transition-shadow hover:ring-2 hover:ring-border focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:ring-2 data-[state=open]:ring-border"
          >
            <ProfileAvatar name={name} photoUrl={photoUrl} className="size-7" fallbackClassName="text-[10px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="min-w-60"
          onCloseAutoFocus={(event) => {
            if (!openingDialog.current) return
            openingDialog.current = false
            event.preventDefault()
          }}
        >
          <DropdownMenuLabel className="flex items-center gap-2.5 px-1.5 py-1.5 font-normal">
            <ProfileAvatar name={name} photoUrl={photoUrl} className="size-8" fallbackClassName="text-xs" />
            <span className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium text-foreground">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={PROFILE_HREF}>
              <CircleUserRound aria-hidden /> {t("profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings aria-hidden /> {t("settings")}
            </Link>
          </DropdownMenuItem>
          {account ? (
            <DropdownMenuItem asChild>
              <Link href="/set-password">
                <KeyRound aria-hidden /> {t("set_password")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {account && isAdmin ? (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck aria-hidden /> {t("admin")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sun className="dark:hidden" aria-hidden />
              <Moon className="hidden dark:block" aria-hidden />
              {th("theme")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-36">
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  <Sun aria-hidden /> {th("light")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon aria-hidden /> {th("dark")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor aria-hidden /> {th("system")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onSelect={() => {
              openingDialog.current = true
              setFeedbackOpen(true)
            }}
          >
            <MessageSquarePlus aria-hidden /> {fb("menu_label")}
          </DropdownMenuItem>
          {install.visible ? (
            <DropdownMenuItem
              onSelect={() => {
                openingDialog.current = install.opensDialog
                void install.install()
              }}
            >
              <Download aria-hidden /> {install.label}
            </DropdownMenuItem>
          ) : null}
          {account ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOutForm.current?.requestSubmit()}>
                <LogOut aria-hidden /> {t("sign_out")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      {install.dialog}
    </>
  )
}
