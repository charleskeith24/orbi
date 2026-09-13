"use client"

import { OctagonAlert, RotateCcw } from "lucide-react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Inline AI failure with a retry. AiError messages are always safe to show. */
export function AiErrorNotice({
  message,
  onRetry,
  title = "Couldn't generate suggestions",
  className,
}: {
  message: string
  onRetry?: () => void
  title?: string
  className?: string
}) {
  return (
    <Alert variant="destructive" className={className}>
      <OctagonAlert aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className={cn("text-xs", onRetry && "pr-2")}>{message}</AlertDescription>
      {onRetry ? (
        <AlertAction>
          <Button type="button" variant="outline" size="xs" onClick={onRetry}>
            <RotateCcw aria-hidden />
            Retry
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  )
}
