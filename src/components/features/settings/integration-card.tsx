"use client"

import { CalendarClock, ChartColumn, FolderOpen, Layers, Palette, Plug, Unplug, Workflow, type LucideIcon } from "lucide-react"
import { PlatformIcon, StatusPill, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useT, useUiLang } from "@/lib/i18n"
import { integrationLabels, integrationText, type IntegrationAdapter, type IntegrationId } from "@/lib/integrations"
import { integrationsMessages } from "./integrations-messages"

const TOOL_ICONS: Partial<Record<IntegrationId, LucideIcon>> = {
  google_drive: FolderOpen,
  canva: Palette,
  buffer: Layers,
  later: CalendarClock,
  metricool: ChartColumn,
  social_analytics: Workflow,
}

/** One integration: what it would do, its honest status, and a Connect action that explains what's missing. */
export function IntegrationCard({
  adapter,
  pending,
  onConnect,
}: {
  adapter: IntegrationAdapter
  pending: boolean
  onConnect: () => void
}) {
  const t = useT(integrationsMessages)
  const lang = useUiLang()
  const labels = integrationLabels(lang)
  const status = adapter.status()
  const Icon = TOOL_ICONS[adapter.id] ?? Plug
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 dark:bg-input/30">
          {adapter.platform ? (
            <PlatformIcon platform={adapter.platform} colored className="size-[18px]" />
          ) : (
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm leading-5 font-medium">{adapter.name}</h4>
          <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{integrationText(adapter, lang).description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1" aria-label={t("capabilities_aria")}>
        {adapter.capabilities.map((capability) => (
          <Token key={capability} className="font-normal text-muted-foreground">
            {labels.capability(capability)}
          </Token>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <StatusPill tone={status === "connected" ? "good" : status === "error" ? "critical" : "neutral"} icon={Unplug}>
            {labels.status(status)}
          </StatusPill>
          <span className="text-[11px] text-muted-foreground">{t("requires", { auth: labels.auth(adapter.auth) })}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onConnect} disabled={pending} aria-label={t("connect_aria", { name: adapter.name })}>
          {pending ? <Spinner /> : <Plug aria-hidden />}
          {t("connect")}
        </Button>
      </div>
    </div>
  )
}
