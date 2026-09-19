"use client"

import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { calmMessages } from "@/components/common/messages"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useDeviceValue, writeDeviceValue } from "@/hooks/use-device-value"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * Progressive disclosure (Calm UI, ARCHITECTURE §5): details wait behind a toggle instead of sitting on the page.
 *
 * - `variant="inline"` — a small "Details ›" / "Why?" link-style toggle inside a card or row.
 * - `variant="section"` — a quiet full-width divider ("More on your week ─────") that opens a whole region.
 *
 * The trigger is a real button with `aria-expanded`/`aria-controls` (Radix Collapsible); closed content isn't
 * rendered. `storageKey` remembers the open state on this device (localStorage `pbos:disclosure:<key>`).
 */
export function Disclosure({
  label,
  meta,
  children,
  variant = "inline",
  defaultOpen = false,
  open,
  onOpenChange,
  storageKey,
  className,
  triggerClassName,
  contentClassName,
}: {
  /** Trigger text; defaults to "Details" / "Detalye". */
  label?: React.ReactNode
  /** Muted text after the label (a count, a one-word summary). */
  meta?: React.ReactNode
  children: React.ReactNode
  variant?: "inline" | "section"
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  storageKey?: string
  className?: string
  triggerClassName?: string
  contentClassName?: string
}) {
  const t = useT(calmMessages)
  const key = storageKey ? `pbos:disclosure:${storageKey}` : null
  const stored = useDeviceValue(key)
  const [local, setLocal] = useState(defaultOpen)
  const isOpen = open ?? (stored === null ? local : stored === "1")

  const change = (next: boolean) => {
    if (key) writeDeviceValue(key, next ? "1" : "0")
    setLocal(next)
    onOpenChange?.(next)
  }

  const trigger = (
    <CollapsibleTrigger
      data-slot="disclosure-trigger"
      className={cn(
        "group/disclosure inline-flex min-w-0 items-center gap-1 rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:text-foreground",
        variant === "section" ? "-ml-1 h-8 px-1 text-sm font-medium" : "-ml-0.5 h-6 px-0.5 text-xs font-medium",
        triggerClassName
      )}
    >
      <ChevronRight
        aria-hidden
        className={cn(
          "shrink-0 transition-transform duration-150 group-data-[state=open]/disclosure:rotate-90",
          variant === "section" ? "size-4" : "size-3.5"
        )}
      />
      <span className="truncate">{label ?? t("details")}</span>
      {meta ? <span className="shrink-0 font-normal text-muted-foreground">{meta}</span> : null}
    </CollapsibleTrigger>
  )

  return (
    <Collapsible open={isOpen} onOpenChange={change} className={cn("flex min-w-0 flex-col", className)}>
      {variant === "section" ? (
        <div className="flex min-w-0 items-center gap-3">
          {trigger}
          <span aria-hidden className="h-px min-w-6 flex-1 bg-border" />
        </div>
      ) : (
        <div className="flex min-w-0">{trigger}</div>
      )}
      <CollapsibleContent className={cn("min-w-0", variant === "section" ? "pt-4" : "pt-1.5", contentClassName)}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
