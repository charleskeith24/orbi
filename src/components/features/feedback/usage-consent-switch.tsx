"use client"

import { useId } from "react"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/lib/i18n"
import { setUsageAnalytics } from "@/lib/telemetry"
import { cn } from "@/lib/utils"
import { m } from "./messages"
import { useIsOnlineVersion, useUsageConsent } from "./use-beta"

/**
 * Opt-in for anonymous usage analytics, remembered per device (off by default). Renders nothing
 * outside the online version, so it can be mounted anywhere (Feedback dialog, onboarding welcome).
 */
export function UsageConsentSwitch({ className }: { className?: string }) {
  const t = useT(m)
  const online = useIsOnlineVersion()
  const on = useUsageConsent()
  const id = useId()
  if (!online) return null

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border bg-muted/30 p-3", className)}>
      <Switch id={id} checked={on} onCheckedChange={setUsageAnalytics} aria-describedby={`${id}-description`} className="mt-0.5" />
      <div className="grid min-w-0 gap-1">
        <label htmlFor={id} className="text-sm leading-snug font-medium">
          {t("usage_title")}
        </label>
        <p id={`${id}-description`} className="text-xs text-pretty text-muted-foreground">
          {t("usage_body")}
        </p>
      </div>
      <span className="sr-only" aria-live="polite">
        {on ? t("usage_on") : t("usage_off")}
      </span>
    </div>
  )
}
