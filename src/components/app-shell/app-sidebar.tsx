"use client"

import { ChevronRight, Cloud, HardDrive } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
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
import { isNavActive, NAV_SECTIONS, type NavItem } from "@/lib/navigation"
import { useBrand, useDataStatus } from "@/lib/store"

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <path d="M5 19V5h7a4.5 4.5 0 0 1 0 9H5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="18" r="2" fill="currentColor" />
    </svg>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const brand = useBrand()
  const { mode } = useDataStatus()
  const { isMobile, setOpenMobile } = useSidebar()
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Personal Brand OS">
              <Link href="/" onClick={onNavigate}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <BrandMark className="size-4.5" />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">Personal Brand OS</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {brand.brand_name || brand.name || "Your brand"}
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {NAV_SECTIONS.map((section, index) => (
          <SidebarGroup key={section.label ?? `section-${index}`} className="py-1">
            {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
            <SidebarMenu>
              {section.items.map((item) => (
                <NavEntry key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="sm" tooltip={mode === "local" ? "Local workspace" : "Synced workspace"}>
              <Link href="/settings?tab=data" onClick={onNavigate} className="text-muted-foreground">
                {mode === "local" ? <HardDrive /> : <Cloud />}
                <span>{mode === "local" ? "Local workspace · this browser" : "Synced · Supabase"}</span>
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

function NavEntry({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
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
            <span className="sr-only">Toggle {item.title}</span>
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
