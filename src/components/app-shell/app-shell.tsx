"use client"

import { AppSidebar } from "@/components/app-shell/app-sidebar"
import { AppTopbar } from "@/components/app-shell/app-topbar"
import { BOTTOM_BAR_PADDING, BottomTabBar } from "@/components/app-shell/bottom-tab-bar"
import { CommandPalette } from "@/components/app-shell/command-palette"
import { DataGate } from "@/components/app-shell/data-gate"
import { useRememberUiLang } from "@/components/app-shell/device-ui-lang"
import { GlobalDialogs } from "@/components/app-shell/global-dialogs"
import { ModuleTabs } from "@/components/app-shell/module-tabs"
import { WorkspaceBanner } from "@/components/app-shell/workspace-banner"
import { ProfilesSync } from "@/components/features/profile/profiles-sync"
import { InviteBanner } from "@/components/features/team/invite-banner"
import { TeamSync } from "@/components/features/team/team-sync"
import { WorkspaceStrip } from "@/components/features/team/workspace-strip"
import { StrategistPanel } from "@/components/features/strategist/strategist-panel"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

/**
 * Sidebar (desktop) or bottom tab bar (phones), the top bar, the backup line, the module's tab row, then the page.
 * On phones the page is padded so nothing hides behind the bottom bar.
 */
export function AppShell({ children, defaultOpen = true }: { children: React.ReactNode; defaultOpen?: boolean }) {
  useRememberUiLang()
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppTopbar />
        <WorkspaceBanner />
        <WorkspaceStrip />
        <InviteBanner />
        <ModuleTabs />
        <div className={cn("flex min-w-0 flex-1 flex-col", BOTTOM_BAR_PADDING)}>
          <DataGate>{children}</DataGate>
        </div>
      </SidebarInset>
      <BottomTabBar />
      <GlobalDialogs />
      <ProfilesSync />
      <TeamSync />
      <CommandPalette />
      <StrategistPanel />
    </SidebarProvider>
  )
}
