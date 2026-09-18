"use client"

import { CircleAlert, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AiError } from "@/lib/ai"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { repurposeMessages } from "./messages"

/** Inline generation failure with a retry — never a dead end. */
export function RepurposeErrorNotice({
  error,
  onRetry,
  pending = false,
  className,
}: {
  error: AiError | null
  onRetry: () => void
  pending?: boolean
  className?: string
}) {
  const t = useT(repurposeMessages)
  if (!error) return null
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border border-critical/30 bg-critical/5 px-3 py-2 text-sm dark:bg-critical/10",
        className
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical-fg" aria-hidden />
      <p className="min-w-0 flex-1 text-pretty">
        <span className="font-medium text-critical-fg">{t("generation_failed")}</span>{" "}
        <span className="text-muted-foreground">{error.message}</span>
      </p>
      <Button type="button" variant="outline" size="xs" onClick={onRetry} disabled={pending}>
        <RotateCcw aria-hidden />
        {t("retry")}
      </Button>
    </div>
  )
}
