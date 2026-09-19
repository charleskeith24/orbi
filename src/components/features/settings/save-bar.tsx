"use client"

import { CircleCheck, RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { cn } from "@/lib/utils"
import { settingsMessages } from "./settings-messages"

/**
 * Footer of a settings form: "Unsaved changes · Discard · Save changes". Sticks to the bottom of
 * the viewport while there are unsaved edits. Place it inside the `<form>` (Save is the submit).
 */
export function SaveBar({
  dirty,
  valid,
  onDiscard,
  onReset,
  resetDisabled = false,
  invalidMessage,
}: {
  dirty: boolean
  valid: boolean
  onDiscard: () => void
  /** "Reset to defaults" — fills the form with defaults (still needs saving). */
  onReset?: () => void
  resetDisabled?: boolean
  /** Shown while the form is invalid; defaults to "Fix the highlighted fields to save." */
  invalidMessage?: string
}) {
  const t = useT(settingsMessages)
  const c = useT(commonMessages)
  return (
    <div
      role="region"
      aria-label={c("save_changes")}
      className={cn(
        "z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-3 py-2",
        dirty ? "sticky bottom-[calc(var(--bottom-bar,0px)+0.75rem)] bg-card shadow-md shadow-black/5 dark:shadow-black/40" : "bg-muted/30"
      )}
    >
      <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {!dirty ? (
          <>
            <CircleCheck className="size-3.5 shrink-0 text-good-fg" aria-hidden />
            {t("all_saved")}
          </>
        ) : valid ? (
          <>
            <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden />
            <span className="font-medium text-foreground">{t("unsaved")}</span>
          </>
        ) : (
          <>
            <TriangleAlert className="size-3.5 shrink-0 text-warning-fg" aria-hidden />
            {invalidMessage ?? t("fix_fields")}
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onReset ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={resetDisabled} className="text-muted-foreground">
            <RotateCcw aria-hidden />
            {t("reset_defaults")}
          </Button>
        ) : null}
        {dirty ? (
          <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
            {c("discard")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!dirty || !valid}>
          {c("save_changes")}
        </Button>
      </div>
    </div>
  )
}
