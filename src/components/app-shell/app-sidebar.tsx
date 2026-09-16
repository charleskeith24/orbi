"use client"

import { ChevronRight, Cloud, HardDrive, LayoutGrid, ListCollapse } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { OrbiLogo, OrbiMark } from "@/components/app-shell/orbi-logo"
import { UserMenu } from "@/components/app-shell/user-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useT } from "@/lib/i18n"
import { isNavActive, NAV_SECTIONS, sidebarSections, type NavItem } from "@/lib/navigation"
import { updateSettings, useBrand, useDataStatus, useSettings } from "@/lib/store"
import { sidebarMessages } from "./app-sidebar-messages"

export function AppSidebar() {
  const pathname = usePathname()
  const brand = useBrand()
  const simpleMode = useSettings().simple_mode
  const t = useT(sidebarMessages)
  const { mode } = useDataStatus()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const nav = useMemo(() => sidebarSections(NAV_SECTIONS, { simpleMode, pathname }), [simpleMode, pathname])
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
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
                {state === "collapsed" && !isMobile ? (
                  <OrbiMark className="size-8! text-sidebar-foreground" />
                ) : (
                  <>
                    <OrbiLogo className="h-[22px]! w-auto! text-sidebar-foreground" />
                    <span aria-hidden className="h-4 w-px shrink-0 bg-sidebar-border" />
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {brand.brand_name || brand.name || t("brand_fallback")}
                    </span>
                  </>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {nav.sections.map((section, index) => (
          <SidebarGroup key={section.label ?? `section-${index}`} className="py-1">
            {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
            <SidebarMenu>
              {section.items.map((item) => (
                <NavEntry
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  toggleLabel={t("toggle_group", { title: item.title })}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
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
          <UserMenu />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function NavEntry({
  item,
  pathname,
  onNavigate,
  toggleLabel,
}: {
  item: NavItem
  pathname: string
  onNavigate: () => void
  toggleLabel: string
}) {
  const active = isNavActive(pathname, item.href)
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const Icon = item.icon

  if (!item.children?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
          <Link href={item.href} onClick={onNavigate}>
            <Icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const open = manualOpen ?? active
  return (
    <Collapsible asChild open={open} onOpenChange={setManualOpen}>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
          <Link href={item.href} onClick={onNavigate}>
            <Icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
        <CollapsibleTrigger asChild>
          <SidebarMenuAction className="transition-transform data-[state=open]:rotate-90">
            <ChevronRight />
            <span className="sr-only">{toggleLabel}</span>
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton asChild isActive={pathname === child.href}>
                  <Link href={child.href} onClick={onNavigate}>
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
