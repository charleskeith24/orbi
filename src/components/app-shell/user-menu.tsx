"use client"

import type { User } from "@supabase/supabase-js"
import { ChevronsUpDown, CircleUserRound, Download, KeyRound, LogIn, LogOut, Settings, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRef } from "react"
import { useIsAdmin } from "@/components/features/admin/use-is-admin"
import { describeUser, useAuthUser } from "@/components/features/auth/use-auth-user"
import { ProfileAvatar } from "@/components/features/profile/profile-avatar"
import { useMyProfile, usePhotoUrl } from "@/components/features/profile/profile-store"
import { InstallSidebarItem, useInstallOrbi } from "@/components/features/pwa/install-orbi"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar"
import { useT } from "@/lib/i18n"
import { profileName } from "@/lib/profiles/profile"
import { useBrand } from "@/lib/store"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { userMenuMessages } from "./user-menu-messages"

/** Settings → Profile. */
const PROFILE_HREF = "/settings?tab=profile"

/**
 * Sidebar footer: the account menu with your profile photo and display name. Online (Supabase) it has the
 * account items and "Install Orbi"; in local mode, which has no accounts, it shows the profile kept on this
 * device (Settings → Profile) with Settings and "Install Orbi".
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

  if (loading) {
    return (
      <SidebarMenuItem>
        <SidebarMenuSkeleton showIcon />
      </SidebarMenuItem>
    )
  }

  if (!user) {
    // Session ended (e.g. signed out in another tab): offer the way back instead of an empty slot.
    return (
      <>
        <InstallSidebarItem />
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip={t("sign_in")}>
            <Link href="/login">
              <LogIn />
              <span>{t("sign_in")}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </>
    )
  }

  return <AccountMenuView user={user} />
}

/**
 * The menu for a known user: profile photo and display name (else the sign-up name or the email's local part)
 * with the email; Profile, Settings, Set a password, Admin (admins only), Install Orbi and Sign out.
 * Renders a SidebarMenuItem.
 */
export function AccountMenuView({ user }: { user: Pick<User, "email" | "user_metadata"> }) {
  const { me } = useMyProfile()
  const photoUrl = usePhotoUrl(me?.avatar_path)
  const display = describeUser(user)
  const name = profileName(me?.display_name, display.name)
  return <ProfileMenuView name={name} subtitle={display.email} photoUrl={photoUrl} account={{ email: display.email }} />
}

/** The sidebar-footer menu. `account` = online items (Set a password, Admin, Sign out); null in local mode. */
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
  const { isMobile, state, setOpenMobile } = useSidebar()
  const t = useT(userMenuMessages)
  const isAdmin = useIsAdmin()
  const signOutForm = useRef<HTMLFormElement>(null)
  // Set when a menu item opens a dialog, so the closing menu doesn't pull focus back to its trigger.
  const openingDialog = useRef(false)
  const install = useInstallOrbi()

  const identity = (
    <>
      <ProfileAvatar name={name} photoUrl={photoUrl} className="size-8 rounded-md after:rounded-md" fallbackClassName="text-xs" />
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </>
  )

  return (
    <SidebarMenuItem>
      {/* Lives outside the menu portal so it stays mounted while the menu closes. */}
      {account ? <form ref={signOutForm} action="/auth/signout" method="post" hidden /> : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Native title, not a Radix Tooltip: a Tooltip around a menu trigger swallows the first Esc. */}
          <SidebarMenuButton
            size="lg"
            title={state === "collapsed" && !isMobile ? (account?.email ?? name) : undefined}
            aria-label={t("menu_label", { name })}
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            {identity}
            <ChevronsUpDown className="ml-auto text-muted-foreground" aria-hidden />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isMobile ? "top" : "right"}
          align="end"
          sideOffset={8}
          className="min-w-60"
          onCloseAutoFocus={(event) => {
            if (!openingDialog.current) return
            openingDialog.current = false
            event.preventDefault()
          }}
        >
          <DropdownMenuLabel className="flex items-center gap-2 px-1.5 py-1.5 font-normal">{identity}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={PROFILE_HREF} onClick={() => setOpenMobile(false)}>
              <CircleUserRound aria-hidden /> {t("profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" onClick={() => setOpenMobile(false)}>
              <Settings aria-hidden /> {t("settings")}
            </Link>
          </DropdownMenuItem>
          {account ? (
            <DropdownMenuItem asChild>
              <Link href="/set-password" onClick={() => setOpenMobile(false)}>
                <KeyRound aria-hidden /> {t("set_password")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {account && isAdmin ? (
            <DropdownMenuItem asChild>
              <Link href="/admin" onClick={() => setOpenMobile(false)}>
                <ShieldCheck aria-hidden /> {t("admin")}
              </Link>
            </DropdownMenuItem>
          ) : null}
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
      {install.dialog}
    </SidebarMenuItem>
  )
}
