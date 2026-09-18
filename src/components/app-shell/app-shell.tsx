"use client"

import { AppSidebar } from "@/components/app-shell/app-sidebar"
import { AppTopbar } from "@/components/app-shell/app-topbar"
import { CommandPalette } from "@/components/app-shell/command-palette"
import { DataGate } from "@/components/app-shell/data-gate"
import { useRememberUiLang } from "@/components/app-shell/device-ui-lang"
import { GlobalDialogs } from "@/components/app-shell/global-dialogs"
import { WorkspaceBanner } from "@/components/app-shell/workspace-banner"
import { StrategistPanel } from "@/components/features/strategist/strategist-panel"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppShell({ children, defaultOpen = true }: { children: React.ReactNode; defaultOpen?: boolean }) {
  useRememberUiLang()
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppTopbar />
        <WorkspaceBanner />
        <div className="flex min-w-0 flex-1 flex-col">
          <DataGate>{children}</DataGate>
        </div>
      </SidebarInset>
      <GlobalDialogs />
      <CommandPalette />
      <StrategistPanel />
    </SidebarProvider>
  )
}
