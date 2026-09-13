"use client"

import { CircleCheck, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, pluralize } from "@/lib/utils"

/**
 * Form footer: "Unsaved changes · Discard · Save changes". Sticks to the bottom of the viewport while
 * there are unsaved edits. Place it inside the `<form>` (Save is the submit button).
 */
export function SaveBar({
  dirty,
  changes,
  errorCount,
  savedLabel = "All changes saved",
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
  return (
    <div
      role="region"
      aria-label="Save changes"
      className={cn(
        "z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-3 py-2",
        dirty ? "sticky bottom-3 bg-card shadow-md shadow-black/5 dark:shadow-black/40" : "bg-muted/30",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {!dirty ? (
          <>
            <CircleCheck className="size-3.5 shrink-0 text-good-fg" aria-hidden />
            <span className="truncate">{savedLabel}</span>
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
                Fix {pluralize(errorCount, "field")} to save
              </button>
            ) : (
              <span>Fix {pluralize(errorCount, "field")} to save</span>
            )}
          </>
        ) : (
          <>
            <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden />
            <span className="font-medium text-foreground">Unsaved changes</span>
            <span className="num">· {pluralize(changes, "field")}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {dirty ? (
          <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
            Discard
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!dirty || invalid}>
          Save changes
        </Button>
      </div>
    </div>
  )
}
