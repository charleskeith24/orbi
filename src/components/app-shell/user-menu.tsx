"use client"

import type { User } from "@supabase/supabase-js"
import { ChevronsUpDown, LogIn, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { useRef } from "react"
import { describeUser, useAuthUser } from "@/components/features/auth/use-auth-user"
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
import { isSupabaseConfigured } from "@/lib/supabase/config"

/** Account menu in the sidebar footer (Supabase mode only; local mode has no accounts). */
export function UserMenu() {
  if (!isSupabaseConfigured) return null
  return <AccountMenu />
}

function AccountMenu() {
  const { user, loading } = useAuthUser()

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
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Sign in">
          <Link href="/login">
            <LogIn />
            <span>Sign in</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return <AccountMenuView user={user} />
}

/** The menu for a known user: avatar, name and email; Settings and Sign out. Renders a SidebarMenuItem. */
export function AccountMenuView({ user }: { user: Pick<User, "email" | "user_metadata"> }) {
  const { isMobile, state, setOpenMobile } = useSidebar()
  const signOutForm = useRef<HTMLFormElement>(null)
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
        <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={8} className="min-w-60">
          <DropdownMenuLabel className="flex items-center gap-2 px-1.5 py-1.5 font-normal">{identity}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" onClick={() => setOpenMobile(false)}>
              <Settings aria-hidden /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOutForm.current?.requestSubmit()}>
            <LogOut aria-hidden /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
