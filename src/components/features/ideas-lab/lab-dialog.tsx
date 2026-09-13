"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * Centred modal from 640px; a full-screen sheet below that. Header / scrolling body / footer, so the
 * actions never scroll away. Children mount on open, so form state resets every time.
 */
const FRAME = cn(
  "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0",
  "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:ring-0"
)

const SIZES = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-2xl" } as const

export function LabDialog({
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

export function LabDialogHeader({ title, description }: { title: React.ReactNode; description: React.ReactNode }) {
  return (
    <DialogHeader className="shrink-0 gap-1 border-b py-3.5 pr-12 pl-4">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription className="text-xs text-pretty">{description}</DialogDescription>
    </DialogHeader>
  )
}

export function LabDialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin", className)}>{children}</div>
}

/** Action row. `status` sits on the left (why the primary action is disabled, a count…). */
export function LabDialogFooter({ status, children }: { status?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-4 py-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:bg-muted/20">
      <div className="mr-auto flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">{status}</div>
      {children}
    </div>
  )
}
