"use client"

import type { User } from "@supabase/supabase-js"
import { ChevronsUpDown, Download, KeyRound, LogIn, LogOut, Settings, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRef } from "react"
import { useIsAdmin } from "@/components/features/admin/use-is-admin"
import { describeUser, useAuthUser } from "@/components/features/auth/use-auth-user"
import { InstallSidebarItem, useInstallOrbi } from "@/components/features/pwa/install-orbi"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { userMenuMessages } from "./user-menu-messages"

/**
 * Sidebar footer: the account menu in Supabase mode (with "Install Orbi" inside it); in local mode,
 * which has no accounts, just the "Install Orbi" entry (hidden once Orbi runs as an installed app).
 */
export function UserMenu() {
  if (!isSupabaseConfigured) return <InstallSidebarItem />
  return <AccountMenu />
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
 * The menu for a known user: avatar, name and email; Settings, Set a password, Admin (admins only),
 * Install Orbi and Sign out. Renders a SidebarMenuItem.
 */
export function AccountMenuView({ user }: { user: Pick<User, "email" | "user_metadata"> }) {
  const { isMobile, state, setOpenMobile } = useSidebar()
  const t = useT(userMenuMessages)
  const isAdmin = useIsAdmin()
  const signOutForm = useRef<HTMLFormElement>(null)
  // Set when a menu item opens a dialog, so the closing menu doesn't pull focus back to its trigger.
  const openingDialog = useRef(false)
  const install = useInstallOrbi()
  const { name, email, initials, avatarUrl } = describeUser(user)

  const identity = (
    <>
      <Avatar className="size-8 rounded-md after:rounded-md">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" className="rounded-md" /> : null}
        <AvatarFallback className="rounded-md text-xs font-medium">{initials}</AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{email}</span>
      </span>
    </>
  )

  return (
    <SidebarMenuItem>
      {/* Lives outside the menu portal so it stays mounted while the menu closes. */}
      <form ref={signOutForm} action="/auth/signout" method="post" hidden />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Native title, not a Radix Tooltip: a Tooltip around a menu trigger swallows the first Esc. */}
          <SidebarMenuButton
            size="lg"
            title={state === "collapsed" && !isMobile ? email : undefined}
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
            <Link href="/settings" onClick={() => setOpenMobile(false)}>
              <Settings aria-hidden /> {t("settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/set-password" onClick={() => setOpenMobile(false)}>
              <KeyRound aria-hidden /> {t("set_password")}
            </Link>
          </DropdownMenuItem>
          {isAdmin ? (
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOutForm.current?.requestSubmit()}>
            <LogOut aria-hidden /> {t("sign_out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {install.dialog}
    </SidebarMenuItem>
  )
}
