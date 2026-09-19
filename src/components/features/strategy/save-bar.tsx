"use client"

import { CircleCheck, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { cn, formatNumber } from "@/lib/utils"
import { brandHqMessages } from "./brand-messages"

/**
 * Form footer: "Unsaved changes · Discard · Save changes". Sticks to the bottom of the viewport while
 * there are unsaved edits. Place it inside the `<form>` (Save is the submit button).
 */
export function SaveBar({
  dirty,
  changes,
  errorCount,
  savedLabel,
  onDiscard,
  onShowErrors,
  className,
}: {
  dirty: boolean
  /** Number of changed fields. */
  changes: number
  errorCount: number
  savedLabel?: string
  onDiscard: () => void
  /** Jumps to the first invalid field. */
  onShowErrors?: () => void
  className?: string
}) {
  const invalid = errorCount > 0
  const t = useT(brandHqMessages)
  const c = useT(commonMessages)
  const fixText = t.plural("fix_fields", errorCount, { count: formatNumber(errorCount) })
  return (
    <div
      role="region"
      aria-label={t("save_bar_label")}
      className={cn(
        "z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-3 py-2",
        dirty ? "sticky bottom-[calc(var(--bottom-bar,0px)+0.75rem)] bg-card shadow-md shadow-black/5 dark:shadow-black/40" : "bg-muted/30",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {!dirty ? (
          <>
            <CircleCheck className="size-3.5 shrink-0 text-good-fg" aria-hidden />
            <span className="truncate">{savedLabel ?? t("all_saved")}</span>
          </>
        ) : invalid ? (
          <>
            <TriangleAlert className="size-3.5 shrink-0 text-warning-fg" aria-hidden />
            {onShowErrors ? (
              <button
                type="button"
                onClick={onShowErrors}
                className="rounded-sm font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {fixText}
              </button>
            ) : (
              <span>{fixText}</span>
            )}
          </>
        ) : (
          <>
            <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden />
            <span className="font-medium text-foreground">{t("unsaved")}</span>
            <span className="num">{t.plural("fields", changes, { count: formatNumber(changes) })}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {dirty ? (
          <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
            {c("discard")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!dirty || invalid}>
          {c("save_changes")}
        </Button>
      </div>
    </div>
  )
}
