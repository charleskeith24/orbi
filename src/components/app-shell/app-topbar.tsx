"use client"

import { ChevronRight, Search, Sparkles } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useIsMac } from "@/components/app-shell/keyboard-shortcuts"
import { NewMenu } from "@/components/app-shell/new-menu"
import { m } from "@/components/app-shell/topbar-messages"
import { UserMenu } from "@/components/app-shell/user-menu"
import { UsageTracker } from "@/components/features/feedback/usage-tracker"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { translator, useT, type Translator } from "@/lib/i18n"
import { navModuleFor } from "@/lib/navigation"
import { uiActions } from "@/lib/store"

export interface Crumb {
  title: string
  href: string
}

const EN = translator(m, "en")

/**
 * The top bar's location: the module ("Ideas" — its sub-pages are the tabs right below), plus one crumb on a
 * detail page ("Content Studio › Workspace"). Titles come from the nav config.
 */
export function getBreadcrumbs(pathname: string, t: Translator<(typeof m)["en"]> = EN): Crumb[] {
  if (pathname === "/strategist") return [{ title: t("strategist"), href: "/strategist" }]
  const item = navModuleFor(pathname)
  if (!item) return []
  const crumbs: Crumb[] = [{ title: item.title, href: item.href }]
  const isSubPage = item.children?.some((child) => child.href === pathname) ?? false
  if (pathname !== item.href && !isSubPage) {
    const detail: Record<string, string> = { "/studio": t("crumb_workspace"), "/campaigns": t("crumb_campaign") }
    crumbs.push({ title: detail[item.href] ?? t("crumb_details"), href: pathname })
  }
  return crumbs
}

/**
 * Top bar (Calm UI): where you are, search (⌘K), the one "＋ New" menu, the Content Strategist and your account
 * (Profile, Settings, Theme, Feedback). On phones the sidebar button and New give way to the bottom tab bar.
 */
export function AppTopbar() {
  const pathname = usePathname()
  const t = useT(m)
  const crumbs = getBreadcrumbs(pathname, t)
  const isMac = useIsMac()
  const mod = isMac ? "⌘" : "Ctrl "

  return (
    <header
      data-print="hide"
      className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/65 md:px-3"
    >
      <SidebarTrigger className="-ml-1 max-md:hidden" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4 max-md:hidden" />
      <nav aria-label={t("breadcrumb")} className="flex min-w-0 flex-1 items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href + i} className="flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium" aria-current="page">
                {crumb.title}
              </span>
            ) : (
              <Link href={crumb.href} className="truncate text-muted-foreground hover:text-foreground">
                {crumb.title}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <Button
        variant="outline"
        size="sm"
        className="hidden w-48 justify-start font-normal text-muted-foreground shadow-none lg:flex"
        onClick={() => uiActions.setCommandOpen(true)}
      >
        <Search />
        <span className="flex-1 text-left">{t("search_everything")}</span>
        <Kbd>{mod}K</Kbd>
      </Button>
      <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t("search")} onClick={() => uiActions.setCommandOpen(true)}>
        <Search />
      </Button>

      <NewMenu className="max-md:hidden" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("strategist_open")} onClick={() => uiActions.askStrategist()}>
            <Sparkles />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t("strategist")} <Kbd className="ml-1">{mod}J</Kbd>
        </TooltipContent>
      </Tooltip>
      <UserMenu />
      <UsageTracker />
    </header>
  )
}
