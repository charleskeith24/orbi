"use client"

import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { settingsMessages } from "./settings-messages"
import { replaceSettingsUrl, SETTINGS_TABS, settingsHref, type SettingsTabKey } from "./tabs"

/** Section navigation: a sticky list on desktop, a horizontally scrolling row on mobile. */
export function SettingsNav({
  active,
  dirty,
}: {
  active: SettingsTabKey
  dirty: Partial<Record<SettingsTabKey, boolean>>
}) {
  const t = useT(settingsMessages)
  return (
    <nav aria-label={t("nav_aria")} className="-mx-4 min-w-0 md:-mx-6 lg:sticky lg:top-4 lg:mx-0 lg:self-start">
      <ul className="flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-thin md:px-6 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {SETTINGS_TABS.map((tab) => {
          const isActive = tab.key === active
          const Icon = tab.icon
          const content = (
            <>
              <Icon className={cn("size-4 shrink-0", isActive && "text-brand")} aria-hidden />
              <span>{t(`tab_${tab.key}_label`)}</span>
              {dirty[tab.key] ? (
                <>
                  <span className="ml-auto size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span className="sr-only">{t("nav_unsaved")}</span>
                </>
              ) : null}
            </>
          )
          const itemClass = "flex h-8 items-center gap-2 rounded-md px-2.5 text-sm whitespace-nowrap transition-colors"
          return (
            <li key={tab.key} className="shrink-0">
              {isActive ? (
                // The current section is marked, not linked — re-selecting it would do nothing.
                <span aria-current="page" className={cn(itemClass, "bg-muted font-medium text-foreground dark:bg-input/40")}>
                  {content}
                </span>
              ) : (
                <a
                  href={settingsHref(tab.key)}
                  onClick={(event) => {
                    // Plain clicks switch tabs in place; modified clicks (new tab / window) behave natively.
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    event.preventDefault()
                    replaceSettingsUrl(tab.key)
                  }}
                  className={cn(
                    itemClass,
                    "text-muted-foreground outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  )}
                >
                  {content}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
