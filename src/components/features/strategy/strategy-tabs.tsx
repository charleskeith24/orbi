"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { strategyMessages } from "./messages"

const TABS = [
  { href: "/strategy", label: "tab_brand" },
  { href: "/strategy/goals", label: "tab_goals" },
  { href: "/strategy/platforms", label: "tab_platforms" },
  { href: "/strategy/system", label: "tab_system" },
] as const

/** Sibling navigation for the four Strategy pages (scrolls horizontally on narrow screens). */
export function StrategyTabs({ className }: { className?: string }) {
  const pathname = usePathname()
  const t = useT(strategyMessages)
  return (
    <nav aria-label={t("tabs_label")} className={cn("-mx-4 min-w-0 md:mx-0", className)}>
      <ul className="flex gap-1 overflow-x-auto border-b px-4 scrollbar-thin md:px-0">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative -mb-px flex h-9 items-center border-b-2 px-2.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-brand font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {t(tab.label)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
