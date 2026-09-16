"use client"

import { AddMetricsDialog } from "@/components/features/capture/add-metrics-dialog"
import { LogPostDialog } from "@/components/features/capture/log-post-dialog"
import { NewContentDialog } from "@/components/features/capture/new-content-dialog"
import { QuickCaptureDialog } from "@/components/features/capture/quick-capture-dialog"
import { LogIncomeDialog } from "@/components/features/money/log-income-dialog"
import { useUIStore } from "@/lib/store"

/** Mounts the app-wide dialogs once; open them anywhere with `uiActions.openDialog(...)`. */
export function GlobalDialogs() {
  const dialog = useUIStore((s) => s.dialog)
  const closeDialog = useUIStore((s) => s.closeDialog)
  const onOpenChange = (open: boolean) => {
    if (!open) closeDialog()
  }

  return (
    <>
      <QuickCaptureDialog
        open={dialog?.type === "quick-capture"}
        onOpenChange={onOpenChange}
        initialText={dialog?.type === "quick-capture" ? dialog.initialText : undefined}
      />
      <NewContentDialog
        open={dialog?.type === "new-content"}
        onOpenChange={onOpenChange}
        ideaId={dialog?.type === "new-content" ? dialog.ideaId : undefined}
        defaults={dialog?.type === "new-content" ? dialog.defaults : undefined}
      />
      <LogPostDialog open={dialog?.type === "log-post"} onOpenChange={onOpenChange} />
      <AddMetricsDialog
        open={dialog?.type === "add-metrics"}
        onOpenChange={onOpenChange}
        itemId={dialog?.type === "add-metrics" ? dialog.itemId : undefined}
      />
      <LogIncomeDialog
        open={dialog?.type === "log-income"}
        onOpenChange={onOpenChange}
        dealId={dialog?.type === "log-income" ? dialog.dealId : undefined}
        itemId={dialog?.type === "log-income" ? dialog.itemId : undefined}
      />
    </>
  )
}
