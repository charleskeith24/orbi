"use client"

import { useIsMac } from "@/components/app-shell/keyboard-shortcuts"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { captureMessages } from "./capture-messages"

/**
 * Centred modal from 640px; below that a full-screen sheet (Quick Capture and Add Metrics are the
 * most-used mobile flows). Content is header / scrolling body / footer, so actions never scroll away.
 */
const FRAME = cn(
  "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0",
  "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:ring-0"
)

const SIZES = { md: "sm:max-w-xl", lg: "sm:max-w-2xl" } as const

/** Dialog frame for the global capture dialogs. Children mount on open, so form state resets every time. */
export function CaptureDialog({
  open,
  onOpenChange,
  size = "md",
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  size?: keyof typeof SIZES
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(FRAME, SIZES[size])}>{children}</DialogContent>
    </Dialog>
  )
}

export function CaptureHeader({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode
  description: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <DialogHeader className={cn("shrink-0 gap-1 border-b py-3.5 pr-12 pl-4", className)}>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription className="text-xs text-pretty">{description}</DialogDescription>
      {children}
    </DialogHeader>
  )
}

export function CaptureBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin", className)}>{children}</div>
}

/** Sticky action row. `status` sits on the left (shortcut hint or why the primary action is disabled). */
export function CaptureFooter({
  status,
  children,
  className,
}: {
  status?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t bg-muted/40 px-4 py-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:bg-muted/20",
        className
      )}
    >
      <div className="mr-auto flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">{status}</div>
      {children}
    </div>
  )
}

/** "⌘ ↵ to save" — hidden on phone-sized screens, where there is no shortcut to teach. */
export function ShortcutHint({ label }: { label?: string }) {
  const isMac = useIsMac()
  const t = useT(captureMessages)
  return (
    <span className="hidden min-w-0 items-center gap-1.5 sm:inline-flex">
      <KbdGroup>
        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>↵</Kbd>
      </KbdGroup>
      <span className="truncate">{label ?? t("to_save")}</span>
    </span>
  )
}
