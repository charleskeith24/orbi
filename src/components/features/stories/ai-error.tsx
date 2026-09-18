"use client"

import { CircleAlert, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { experienceMessages } from "./experience-messages"

/** Inline AI failure with a retry button (AiError messages are always safe to show). */
export function AiErrorNotice({
  message,
  onRetry,
  retryLabel,
  className,
}: {
  message: string
  onRetry: () => void
  retryLabel?: string
  className?: string
}) {
  const t = useT(experienceMessages)
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive dark:bg-destructive/10",
        className
      )}
    >
      <CircleAlert className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-pretty">{message}</span>
      <Button type="button" size="xs" variant="outline" onClick={onRetry}>
        <RotateCcw aria-hidden />
        {retryLabel ?? t("retry")}
      </Button>
    </div>
  )
}
