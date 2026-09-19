"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { calmMessages } from "@/components/common/messages"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export interface HubTab {
  /** Short tab label ("Hooks"); the page keeps its full name in ⌘K and the breadcrumb. */
  title: string
  href: string
}

/** The tab for `pathname`: an exact match, else the longest `href/` prefix (detail pages under a tab). */
export function activeHubTab(tabs: readonly HubTab[], pathname: string): HubTab | null {
  let best: HubTab | null = null
  for (const tab of tabs) {
    if (tab.href === pathname) return tab
    if (pathname.startsWith(`${tab.href}/`) && (!best || tab.href.length > best.href.length)) best = tab
  }
  return best
}

/**
 * Route-linked tabs for a module's sub-pages (Calm UI, ARCHITECTURE §4/§5). Every tab is a plain link, so URLs,
 * `?open=`, ⌘K and bookmarks keep working; the current one has `aria-current="page"`. Scrolls sideways on
 * phones. The app shell renders them for every module with sub-pages (`ModuleTabs`); use this directly only for
 * a page-level set of route tabs.
 */
export function HubTabs({
  tabs,
  label,
  className,
  listClassName,
}: {
  tabs: readonly HubTab[]
  /** Accessible name of the tab row (e.g. the module name). */
  label?: string
  className?: string
  listClassName?: string
}) {
  const pathname = usePathname()
  const t = useT(calmMessages)
  const active = activeHubTab(tabs, pathname)
  return (
    <nav aria-label={label ?? t("sections")} data-slot="hub-tabs" className={cn("min-w-0", className)}>
      <ul className={cn("scrollbar-none -mb-px flex min-w-0 gap-5 overflow-x-auto", listClassName)}>
        {tabs.map((tab) => {
          const current = tab === active
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center rounded-sm text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
                  current ? "text-foreground after:bg-foreground" : "text-muted-foreground hover:text-foreground after:bg-transparent"
                )}
              >
                {tab.title}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
