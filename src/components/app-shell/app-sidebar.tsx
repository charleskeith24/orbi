"use client"

import { ChevronRight, Cloud, HardDrive, LayoutGrid, ListCollapse } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { OrbiLogo, OrbiMark } from "@/components/app-shell/orbi-logo"
import { ProfileAvatar } from "@/components/features/profile/profile-avatar"
import { useMyProfile, usePhotoUrl } from "@/components/features/profile/profile-store"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useDeviceValue, writeDeviceValue } from "@/hooks/use-device-value"
import { useT } from "@/lib/i18n"
import { firstName, profileName } from "@/lib/profiles/profile"
import {
  groupItems,
  isNavActive,
  NAV_SECTIONS,
  parseCollapsedGroups,
  sidebarSections,
  type NavItem,
  type NavSectionKey,
} from "@/lib/navigation"
import { updateSettings, useBrand, useDataStatus, useSettings } from "@/lib/store"
import { sidebarMessages } from "./app-sidebar-messages"

/** This device's folded sidebar groups (`parseCollapsedGroups`). */
const COLLAPSED_KEY = "pbos:sidebar:collapsed"

/**
 * The sidebar (Calm UI): Home and Today, the Plan · Create · Grow · Measure groups (each folds; remembered per
 * device), then Money and Settings. One link per module — sub-pages are tabs on the page. Simple mode trims it
 * to the everyday modules (§12). The account menu lives in the top bar.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const brand = useBrand()
  const simpleMode = useSettings().simple_mode
  const t = useT(sidebarMessages)
  const { me } = useMyProfile()
  const photoUrl = usePhotoUrl(me?.avatar_path)
  const workspaceName = brand.brand_name || brand.name || t("brand_fallback")
  const personName = profileName(me?.display_name, brand.name.trim() || workspaceName)
  const { mode } = useDataStatus()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const nav = useMemo(() => sidebarSections(NAV_SECTIONS, { simpleMode, pathname }), [simpleMode, pathname])
  const collapsedValue = useDeviceValue(COLLAPSED_KEY)
  const collapsed = useMemo(() => parseCollapsedGroups(collapsedValue), [collapsedValue])
  // The icon rail has no group headers to unfold, so it always lists every module.
  const iconRail = state === "collapsed" && !isMobile
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }
  const toggleGroup = (key: NavSectionKey) => {
    const next = new Set(collapsed)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    writeDeviceValue(COLLAPSED_KEY, next.size ? [...next].join(",") : null)
  }
  const modeLabel = simpleMode ? t.plural("show_all", nav.hidden) : t("back_to_simple")

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Orbi">
              {/* `!` sizes beat the menu button's `[&_svg]:size-4`. */}
              <Link href="/" onClick={onNavigate}>
                {iconRail ? (
                  <OrbiMark className="size-8! text-sidebar-foreground" />
                ) : (
                  <>
                    <OrbiLogo className="h-[22px]! w-auto! text-sidebar-foreground" />
                    <span aria-hidden className="h-4 w-px shrink-0 bg-sidebar-border" />
                    {/* Your photo and first name, not the workspace name — that stays as the link's accessible name. */}
                    <ProfileAvatar name={personName} photoUrl={photoUrl} className="size-6" fallbackClassName="text-[10px]" />
                    <span className="min-w-0 truncate text-sm text-sidebar-foreground">{firstName(personName)}</span>
                    <span className="sr-only">{workspaceName}</span>
                  </>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin gap-0">
        {nav.sections.map((section) => {
          const folded = !iconRail && collapsed.has(section.key)
          const items = iconRail ? section.items : groupItems(section, { collapsed: folded, pathname })
          const menuId = `sidebar-group-${section.key}`
          return (
            <SidebarGroup key={section.key} className="py-1">
              {section.label ? (
                <SidebarGroupLabel asChild>
                  <button
                    type="button"
                    aria-expanded={!folded}
                    aria-controls={menuId}
                    onClick={() => toggleGroup(section.key)}
                    className="group/label w-full gap-1 text-left hover:text-sidebar-foreground"
                  >
                    <span>{section.label}</span>
                    <ChevronRight
                      aria-hidden
                      className="size-3! opacity-0 transition-[transform,opacity] duration-150 group-hover/label:opacity-100 group-focus-visible/label:opacity-100 group-aria-expanded/label:rotate-90 group-aria-[expanded=false]/label:opacity-100"
                    />
                  </button>
                </SidebarGroupLabel>
              ) : null}
              <SidebarMenu id={menuId}>
                {items.map((item) => (
                  <NavEntry key={item.href} item={item} active={isNavActive(pathname, item.href)} onNavigate={onNavigate} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="gap-0.5">
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Simple mode lives in app_settings (also in Settings → General); ⌘K reaches every page either way. */}
            <SidebarMenuButton
              size="sm"
              tooltip={modeLabel}
              className="text-muted-foreground"
              onClick={() => updateSettings({ simple_mode: !simpleMode })}
            >
              {simpleMode ? <LayoutGrid aria-hidden /> : <ListCollapse aria-hidden />}
              <span>{modeLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="sm"
              tooltip={mode === "local" ? t("workspace_local_tooltip") : t("workspace_synced_tooltip")}
            >
              <Link href="/settings?tab=data" onClick={onNavigate} className="text-muted-foreground">
                {mode === "local" ? <HardDrive /> : <Cloud />}
                <span>{mode === "local" ? t("workspace_local") : t("workspace_synced")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function NavEntry({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
        <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}>
          <Icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
