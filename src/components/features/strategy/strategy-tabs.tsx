"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/strategy", label: "Brand HQ" },
  { href: "/strategy/goals", label: "Goals" },
  { href: "/strategy/platforms", label: "Platforms" },
  { href: "/strategy/system", label: "Flywheel & System" },
] as const

/** Sibling navigation for the four Strategy pages (scrolls horizontally on narrow screens). */
export function StrategyTabs({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Strategy pages" className={cn("-mx-4 min-w-0 md:mx-0", className)}>
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
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
