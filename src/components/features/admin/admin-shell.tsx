"use client"

import {
  ArrowLeft,
  FlaskConical,
  HardDrive,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  ScrollText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useRef } from "react"
import { OrbiMark } from "@/components/app-shell/orbi-logo"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { useScreenT } from "@/components/app-shell/device-ui-lang"
import { StatusPill } from "@/components/common"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAdmin } from "./admin-context"
import { adminMessages } from "./messages"

export type AdminTab = "overview" | "requests" | "users" | "feedback" | "audit" | "security"

type TabLabel = "tab_overview" | "tab_requests" | "tab_users" | "tab_feedback" | "tab_audit" | "tab_security"

export const ADMIN_TABS: { key: AdminTab; href: string; label: TabLabel; icon: LucideIcon }[] = [
  { key: "overview", href: "/admin", label: "tab_overview", icon: LayoutDashboard },
  { key: "requests", href: "/admin/requests", label: "tab_requests", icon: Inbox },
  { key: "users", href: "/admin/users", label: "tab_users", icon: Users },
  { key: "feedback", href: "/admin/feedback", label: "tab_feedback", icon: MessageSquareText },
  { key: "audit", href: "/admin/audit", label: "tab_audit", icon: ScrollText },
  { key: "security", href: "/admin/security", label: "tab_security", icon: ShieldCheck },
]

/** The header row shared by the admin area, the local-mode notice and the loading frame. */
function AdminHeaderBar({ children }: { children?: React.ReactNode }) {
  const t = useScreenT(adminMessages)
  return (
    <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center gap-2 px-4 md:px-6">
      <Link
        href="/admin"
        aria-label={t("home_aria")}
        className="-ml-1 flex items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <OrbiMark className="size-6 text-foreground" title="Orbi" />
        <span className="text-sm font-semibold">{t("area")}</span>
      </Link>
      {children}
    </div>
  )
}

function BackToWorkspace() {
  const t = useScreenT(adminMessages)
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/" aria-label={t("back_to_workspace")}>
        <ArrowLeft aria-hidden />
        <span className="hidden sm:inline">{t("back_to_workspace")}</span>
        <span className="sm:hidden">{t("back_short")}</span>
      </Link>
    </Button>
  )
}

function AdminTabs({ active }: { active: AdminTab }) {
  const t = useScreenT(adminMessages)
  return (
    <nav aria-label={t("tabs_label")} className="mx-auto w-full max-w-[1400px] px-2 md:px-4">
      <ul className="flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {ADMIN_TABS.map((tab) => {
          const current = tab.key === active
          const Icon = tab.icon
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  current &&
                    "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(tab.label)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function AdminAccountMenu() {
  const t = useScreenT(adminMessages)
  const { self, source } = useAdmin()
  const signOutForm = useRef<HTMLFormElement>(null)
  if (!self) return null
  const initials = self.email.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "A"
  return (
    <>
      {/* Outside the menu portal so it stays mounted while the menu closes. */}
      <form ref={signOutForm} action="/auth/signout" method="post" hidden />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("account_menu")} title={self.email}>
            <Avatar className="size-6 rounded-md after:rounded-md">
              <AvatarFallback className="rounded-md text-[10px] font-medium">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuLabel className="grid gap-0.5 font-normal">
            <span className="truncate text-sm font-medium text-foreground">{self.email}</span>
            {source === "fixture" ? <span className="text-xs text-muted-foreground">{t("sample_account")}</span> : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/">
              <ArrowLeft aria-hidden /> {t("back_to_workspace")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/security">
              <ShieldCheck aria-hidden /> {t("tab_security")}
            </Link>
          </DropdownMenuItem>
          {source === "live" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOutForm.current?.requestSubmit()}>
                <LogOut aria-hidden /> {t("sign_out")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

const HEADER = "sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/65"

/**
 * The admin area frame: Orbi mark + "Admin", tabs, "Back to my workspace", theme and account menu.
 * `restricted` hides the tabs while 2-step verification is still pending.
 */
export function AdminShell({ tab, restricted = false, children }: { tab: AdminTab; restricted?: boolean; children: React.ReactNode }) {
  const t = useScreenT(adminMessages)
  const { source } = useAdmin()
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className={HEADER}>
        <AdminHeaderBar>
          {source === "fixture" ? (
            <StatusPill tone="warning" icon={FlaskConical} className="ml-1">
              {t("sample_badge")}
            </StatusPill>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <BackToWorkspace />
            <ThemeToggle />
            <AdminAccountMenu />
          </div>
        </AdminHeaderBar>
        {restricted ? null : <AdminTabs active={tab} />}
      </header>
      {source === "fixture" ? (
        <p role="note" className="border-b bg-muted/50 px-4 py-1.5 text-center text-xs text-muted-foreground">
          {t("sample_banner")}
        </p>
      ) : null}
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-6 p-4 md:p-6">{children}</div>
      </main>
    </div>
  )
}

/** Local mode (no Supabase): honest notice instead of an admin area that can't work. */
export function AdminLocalNotice() {
  const t = useScreenT(adminMessages)
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className={HEADER}>
        <AdminHeaderBar>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </AdminHeaderBar>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:pb-24">
        <section className="w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground shadow-xs sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <HardDrive className="size-4.5 text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <h1 className="text-base font-semibold">{t("local_title")}</h1>
              <p className="text-sm text-muted-foreground">{t("local_body")}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t("local_deploy")}</p>
          <p className="mt-1.5 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">docs/DEPLOY.md</p>
          <p className="mt-3 text-sm text-muted-foreground">{t("local_admin")}</p>
          <p className="mt-1.5 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">docs/ADMIN.md</p>
          <Button asChild size="lg" className="mt-5 w-full">
            <Link href="/">
              <ArrowLeft aria-hidden />
              {t("local_open")}
            </Link>
          </Button>
        </section>
      </main>
    </div>
  )
}

/** Frame shown for a moment while the dev fixture loads. */
export function AdminLoadingFrame() {
  const t = useScreenT(adminMessages)
  return (
    <div className="flex min-h-svh flex-col bg-background" aria-busy>
      <header className={HEADER}>
        <AdminHeaderBar />
      </header>
      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4 md:p-6" role="status" aria-label={t("loading")}>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-40 w-full" />
      </main>
    </div>
  )
}
