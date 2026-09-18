"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { cn } from "@/lib/utils"

const WIDTHS = {
  md: "data-[side=right]:sm:max-w-[480px]",
  lg: "data-[side=right]:sm:max-w-[640px]",
  xl: "data-[side=right]:sm:max-w-[820px]",
} as const

/**
 * Right-hand detail panel: fixed header (title, description, actions, close), scrollable
 * body and optional footer. Full-screen on mobile. Esc closes.
 */
export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
  footer,
  children,
  width = "lg",
  className,
  bodyClassName,
  onOpenAutoFocus,
  onEscapeKeyDown,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  /** Header buttons (edit, menu…) placed before the close button. */
  actions?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  width?: keyof typeof WIDTHS
  className?: string
  bodyClassName?: string
  /** e.g. `(e) => e.preventDefault()` to keep focus off the first field when opened via `?open=`. */
  onOpenAutoFocus?: React.ComponentProps<typeof SheetContent>["onOpenAutoFocus"]
  /** e.g. commit or cancel an inline edit before Esc closes the sheet. */
  onEscapeKeyDown?: React.ComponentProps<typeof SheetContent>["onEscapeKeyDown"]
}) {
  const c = useT(commonMessages)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        onOpenAutoFocus={onOpenAutoFocus}
        onEscapeKeyDown={onEscapeKeyDown}
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn("gap-0 p-0 data-[side=right]:w-full", WIDTHS[width], className)}
      >
        <header className="flex shrink-0 items-start gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1 py-0.5">
            <SheetTitle className="text-base leading-6 font-semibold break-words">{title}</SheetTitle>
            {description ? <SheetDescription className="mt-0.5 text-xs">{description}</SheetDescription> : null}
          </div>
          <div className="-mr-1 flex shrink-0 items-center gap-1">
            {actions}
            <SheetClose asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={c("close")}>
                <X aria-hidden />
              </Button>
            </SheetClose>
          </div>
        </header>
        <div className={cn("min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin", bodyClassName)}>{children}</div>
        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
