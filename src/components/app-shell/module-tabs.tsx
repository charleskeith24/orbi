"use client"

import { usePathname } from "next/navigation"
import { HubTabs } from "@/components/common/hub-tabs"
import { moduleTabsFor } from "@/lib/navigation"

/**
 * The tab row under the top bar for modules with sub-pages (Ideas: Idea Bank · Generator · Hooks · Angles).
 * Tabs are links to the existing routes, aligned with the page's content column. Nothing on other pages.
 */
export function ModuleTabs() {
  const pathname = usePathname()
  const hub = moduleTabsFor(pathname)
  if (!hub) return null
  return (
    <div data-print="hide" className="border-b">
      <HubTabs tabs={hub.tabs} label={hub.module.title} className="mx-auto w-full max-w-[1400px] px-4 md:px-6" />
    </div>
  )
}
