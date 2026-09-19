"use client"

import { CalendarCheck, CalendarDays, Cloud, HardDrive, House, LayoutGrid, ListCollapse, Menu, Plus, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { sidebarMessages } from "@/components/app-shell/app-sidebar-messages"
import { useNewActions } from "@/components/app-shell/new-menu"
import { newMenuMessages } from "@/components/app-shell/new-menu-messages"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useT } from "@/lib/i18n"
import { isNavActive, NAV_SECTIONS, sidebarSections } from "@/lib/navigation"
import { updateSettings, useDataStatus, useSettings } from "@/lib/store"
import { cn } from "@/lib/utils"
import { bottomBarMessages } from "./bottom-tab-bar-messages"

/**
 * Room for the bar: `--bottom-bar` (globals.css) is its height plus the safe area on phones while the bar is on the
 * page, else unset. The shell pads page content with it; sticky footers use `bottom-[calc(var(--bottom-bar,0px)+…)]`.
 */
export const BOTTOM_BAR_PADDING = "pb-[var(--bottom-bar,0px)]"

const TABS: { href: string; title: string; icon: LucideIcon }[] = [
  { href: "/", title: "Home", icon: House },
  { href: "/today", title: "Today", icon: CalendarCheck },
  { href: "/calendar", title: "Calendar", icon: CalendarDays },
]

const TAB =
  "flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:bg-muted"

/**
 * Phones (below `md`): Home · Today · ＋ · Calendar · More, fixed to the bottom above the safe area. "＋" opens the
 * New menu as a sheet; "More" opens every module as a sheet (Simple mode trims it like the sidebar, §12).
 * Desktop keeps the sidebar and the top bar's New button.
 */
export function BottomTabBar() {
  const pathname = usePathname()
  const t = useT(bottomBarMessages)
  const n = useT(newMenuMessages)
  const [sheet, setSheet] = useState<"new" | "more" | null>(null)
  const inBar = TABS.some((tab) => isNavActive(pathname, tab.href))

  const link = (tab: (typeof TABS)[number]) => {
    const active = isNavActive(pathname, tab.href)
    const Icon = tab.icon
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={cn(TAB, active ? "text-foreground" : "text-muted-foreground")}
      >
        <Icon className={cn("size-5", active && "stroke-[2.25]")} aria-hidden />
        <span>{tab.title}</span>
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label={t("nav_label")}
        data-print="hide"
        data-slot="bottom-tab-bar"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {link(TABS[0])}
          {link(TABS[1])}
          <div className="flex items-center justify-center">
            <button
              type="button"
              data-slot="bottom-tab-new"
              aria-label={n("new")}
              aria-haspopup="dialog"
              aria-expanded={sheet === "new"}
              onClick={() => setSheet("new")}
              className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
            >
              <Plus className="size-5" aria-hidden />
            </button>
          </div>
          {link(TABS[2])}
          <button
            type="button"
            data-slot="bottom-tab-more"
            aria-haspopup="dialog"
            aria-expanded={sheet === "more"}
            onClick={() => setSheet("more")}
            className={cn(TAB, inBar ? "text-muted-foreground" : "text-foreground")}
          >
            <Menu className={cn("size-5", !inBar && "stroke-[2.25]")} aria-hidden />
            <span>{t("more")}</span>
          </button>
        </div>
      </nav>
      <NewSheet open={sheet === "new"} onOpenChange={(open) => setSheet(open ? "new" : null)} />
      <MoreSheet open={sheet === "more"} onOpenChange={(open) => setSheet(open ? "more" : null)} pathname={pathname} />
    </>
  )
}

const SHEET = "max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl pb-[calc(0.75rem+env(safe-area-inset-bottom))]"

function NewSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const n = useT(newMenuMessages)
  const actions = useNewActions()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={SHEET} aria-describedby={undefined}>
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle>{n("new")}</SheetTitle>
        </SheetHeader>
        <ul className="flex flex-col px-2">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <li key={action.key}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false)
                    action.run()
                  }}
                  className="flex h-12 w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:bg-muted active:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground dark:bg-input/30">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {action.label}
                </button>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}

function MoreSheet({ open, onOpenChange, pathname }: { open: boolean; onOpenChange: (open: boolean) => void; pathname: string }) {
  const t = useT(bottomBarMessages)
  const s = useT(sidebarMessages)
  const simpleMode = useSettings().simple_mode
  const { mode } = useDataStatus()
  const nav = useMemo(() => sidebarSections(NAV_SECTIONS, { simpleMode, pathname }), [simpleMode, pathname])
  const close = () => onOpenChange(false)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={SHEET}>
        <SheetHeader className="px-4 pt-4 pb-1">
          <SheetTitle>{t("menu_title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("nav_label")}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t("menu_title")} className="flex flex-col gap-3 px-2 pt-1">
          {nav.sections.map((section) => (
            <div key={section.key} className="flex flex-col gap-0.5">
              {section.label ? <p className="px-2 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">{section.label}</p> : null}
              <ul className="grid grid-cols-2 gap-x-1">
                {section.items.map((item) => {
                  const active = isNavActive(pathname, item.href)
                  const Icon = item.icon
                  return (
                    <li key={item.href} className="min-w-0">
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-11 min-w-0 items-center gap-2.5 rounded-lg px-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted",
                          active ? "bg-muted font-medium text-foreground dark:bg-input/40" : "text-foreground/90"
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")} aria-hidden />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mx-4 mt-3 flex flex-col border-t pt-2">
          <button
            type="button"
            onClick={() => updateSettings({ simple_mode: !simpleMode })}
            className="flex h-10 items-center gap-2.5 rounded-lg px-0 text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            {simpleMode ? <LayoutGrid className="size-4" aria-hidden /> : <ListCollapse className="size-4" aria-hidden />}
            {simpleMode ? s.plural("show_all", nav.hidden) : s("back_to_simple")}
          </button>
          <Link
            href="/settings?tab=data"
            onClick={close}
            className="flex h-10 items-center gap-2.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            {mode === "local" ? <HardDrive className="size-4" aria-hidden /> : <Cloud className="size-4" aria-hidden />}
            {mode === "local" ? s("workspace_local") : s("workspace_synced")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
