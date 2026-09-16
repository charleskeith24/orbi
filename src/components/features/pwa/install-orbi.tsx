"use client"

import { Download } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useT } from "@/lib/i18n"
import { InstallInstructionsDialog, type InstructionsMode } from "./install-dialog"
import { m } from "./messages"
import { promptInstall, useInstallMode } from "./pwa-runtime"

/**
 * "Install Orbi": the browser's install prompt where there is one (Android/desktop Chrome and Edge),
 * Add-to-Home-Screen / Add-to-Dock steps on iPhone, iPad, other Android browsers and Safari; hidden when
 * Orbi already runs as an installed app. Render `dialog` even while the item is hidden.
 */
export function useInstallOrbi() {
  const mode = useInstallMode()
  const t = useT(m)
  const [dialogMode, setDialogMode] = useState<InstructionsMode>("ios")
  const [dialogOpen, setDialogOpen] = useState(false)

  async function install() {
    if (mode === "hidden") return
    if (mode === "prompt") {
      if ((await promptInstall()) === "unavailable") toast.error(t("prompt_failed"))
      return
    }
    setDialogMode(mode)
    setDialogOpen(true)
  }

  return {
    visible: mode !== "hidden",
    /** Selecting the item opens a dialog (not the browser prompt). */
    opensDialog: mode !== "prompt",
    label: t("install_label"),
    hint: t("install_hint"),
    install,
    dialog: <InstallInstructionsDialog mode={dialogMode} open={dialogOpen} onOpenChange={setDialogOpen} />,
  }
}

/** The sidebar-footer entry (local mode and signed-out states, where there is no account menu). */
export function InstallSidebarItem() {
  const { visible, label, hint, install, dialog } = useInstallOrbi()
  return (
    <>
      {visible ? (
        <SidebarMenuItem>
          <SidebarMenuButton size="sm" tooltip={hint} className="text-muted-foreground" onClick={() => void install()}>
            <Download aria-hidden />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ) : null}
      {dialog}
    </>
  )
}
