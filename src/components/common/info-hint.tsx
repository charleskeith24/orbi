"use client"

import { Info } from "lucide-react"
import { calmMessages } from "@/components/common/messages"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * ⓘ next to a title: the explanation that used to sit on the page, one tap away (Calm UI, ARCHITECTURE §5).
 * A real button (Tab, Enter/Space, tap) opening a popover; Esc or a click outside closes it. `label` names it
 * for screen readers ("About Content Buffer") — pass `title` and it's derived. Strings are wrapped in a
 * paragraph; pass nodes for lists or links.
 */
export function InfoHint({
  children,
  title,
  label,
  side = "bottom",
  align = "start",
  className,
  contentClassName,
}: {
  children: React.ReactNode
  /** Bold first line of the popover; also names the button ("About {title}"). */
  title?: string
  /** Accessible name of the button (overrides the one derived from `title`). */
  label?: string
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  className?: string
  contentClassName?: string
}) {
  const t = useT(calmMessages)
  const name = label ?? (title ? t("info_about", { title }) : t("info"))
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="info-hint"
          aria-label={name}
          className={cn(
            // The ::after widens the tap target to ~36px without moving the layout.
            "relative inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground/70 outline-none transition-colors after:absolute after:-inset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:text-foreground",
            className
          )}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        collisionPadding={12}
        className={cn("w-72 max-w-[calc(100vw-2rem)] gap-1.5 p-3 text-xs leading-relaxed text-pretty text-muted-foreground", contentClassName)}
      >
        {title ? <p className="text-[13px] leading-5 font-medium text-foreground">{title}</p> : null}
        {typeof children === "string" ? <p>{children}</p> : children}
      </PopoverContent>
    </Popover>
  )
}
