"use client"

import { ChevronRight, Lightbulb, Plus, Search, Sparkles } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { m } from "@/components/app-shell/topbar-messages"
import { FeedbackButton } from "@/components/features/feedback/feedback-button"
import { UsageTracker } from "@/components/features/feedback/usage-tracker"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { translator, useT, type Translator } from "@/lib/i18n"
import { isNavActive, NAV_SECTIONS } from "@/lib/navigation"
import { uiActions } from "@/lib/store"

export interface Crumb {
  title: string
  href: string
}

const EN = translator(m, "en")

/** Breadcrumbs derived from the navigation config (+ detail pages). Page titles come from the nav config. */
export function getBreadcrumbs(pathname: string, t: Translator<(typeof m)["en"]> = EN): Crumb[] {
  if (pathname === "/strategist") return [{ title: t("strategist"), href: "/strategist" }]
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (!isNavActive(pathname, item.href)) continue
      const crumbs: Crumb[] = [{ title: item.title, href: item.href }]
      const child = item.children?.find((c) => c.href === pathname && c.href !== item.href)
      if (child) crumbs.push(child)
      else if (pathname !== item.href && !item.children?.some((c) => pathname === c.href)) {
        const detail: Record<string, string> = { "/studio": t("crumb_workspace"), "/campaigns": t("crumb_campaign") }
        crumbs.push({ title: detail[item.href] ?? t("crumb_details"), href: pathname })
      }
      return crumbs
    }
  }
  return []
}

const subscribeNoop = () => () => {}
function useIsMac() {
  return useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => true
  )
}

export function AppTopbar() {
  const pathname = usePathname()
  const t = useT(m)
  const crumbs = getBreadcrumbs(pathname, t)
  const isMac = useIsMac()
  const mod = isMac ? "⌘" : "Ctrl "

  return (
    <header
      data-print="hide"
      className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/65"
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
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
        className="hidden w-52 justify-start font-normal text-muted-foreground lg:flex"
        onClick={() => uiActions.setCommandOpen(true)}
      >
        <Search />
        <span className="flex-1 text-left">{t("search_everything")}</span>
        <Kbd>{mod}K</Kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label={t("search")}
        onClick={() => uiActions.setCommandOpen(true)}
      >
        <Search />
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          {/* The label hides on phones, so the button keeps an accessible name there. */}
          <Button variant="outline" size="sm" aria-label={t("capture")} onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
            <Lightbulb />
            <span className="hidden sm:inline">{t("capture")}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("capture_tooltip")}</TooltipContent>
      </Tooltip>
      <Button size="sm" aria-label={t("new_content")} onClick={() => uiActions.openDialog({ type: "new-content" })}>
        <Plus />
        <span className="hidden sm:inline">{t("new_content")}</span>
      </Button>
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
      <FeedbackButton />
      <ThemeToggle />
      <UsageTracker />
    </header>
  )
}
