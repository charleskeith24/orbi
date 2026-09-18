"use client"

import { RotateCw } from "lucide-react"
import { TONE_ICON, TONE_SOFT, TONE_TEXT } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { AiError } from "@/lib/ai"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { reportMessages } from "./messages"

/** Inline AI failure with a retry — the previous output stays in place. */
export function AiErrorNotice({
  error,
  title,
  onRetry,
  className,
}: {
  error: AiError | null
  title?: string
  onRetry: () => void
  className?: string
}) {
  const t = useT(reportMessages)
  if (!error) return null
  const Icon = TONE_ICON.critical
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2 text-sm print:hidden",
        TONE_SOFT.critical,
        className
      )}
    >
      <Icon className={cn("size-4 shrink-0", TONE_TEXT.critical)} aria-hidden />
      <p className="min-w-0 flex-1 text-pretty text-foreground">
        <span className="font-medium">{title ?? t("ai_error_title")}</span> {error.message}
      </p>
      <Button type="button" size="xs" variant="outline" onClick={onRetry}>
        <RotateCw aria-hidden />
        {t("retry")}
      </Button>
    </div>
  )
}
