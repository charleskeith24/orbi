"use client"

import { CircleAlert, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { ideaDetailMessages } from "./idea-detail-messages"

/** Inline AI failure with a retry button (the message from `AiError` is always safe to show). */
export function IdeaAiError({ message, onRetry, className }: { message: string; onRetry: () => void; className?: string }) {
  const t = useT(ideaDetailMessages)
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
        {t("retry")}
      </Button>
    </div>
  )
}
