"use client"

import { OctagonAlert, RotateCcw } from "lucide-react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { strategyMessages } from "./messages"

/** Inline AI failure with a retry. AiError messages are always safe to show. */
export function AiErrorNotice({
  message,
  onRetry,
  title,
  className,
}: {
  message: string
  onRetry?: () => void
  title?: string
  className?: string
}) {
  const t = useT(strategyMessages)
  return (
    <Alert variant="destructive" className={className}>
      <OctagonAlert aria-hidden />
      <AlertTitle>{title ?? t("ai_error_title")}</AlertTitle>
      <AlertDescription className={cn("text-xs", onRetry && "pr-2")}>{message}</AlertDescription>
      {onRetry ? (
        <AlertAction>
          <Button type="button" variant="outline" size="xs" onClick={onRetry}>
            <RotateCcw aria-hidden />
            {t("retry")}
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  )
}
