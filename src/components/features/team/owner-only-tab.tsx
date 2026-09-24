"use client"

/**
 * The Settings tabs that belong to the workspace's owner: Data (import, start fresh, move local → cloud and
 * export — the export contains Money), Integrations, AI keys and Reminders (reminders and push go to the
 * owner only). A member sees this instead, rather than controls that would fail.
 */
import { Lock } from "lucide-react"
import { useT } from "@/lib/i18n"
import { teamMessages } from "@/lib/team/messages"
import type { SettingsTabKey } from "@/components/features/settings/tabs"

export const OWNER_ONLY_SETTINGS_TABS: SettingsTabKey[] = ["reminders", "ai", "integrations", "data"]

export function OwnerOnlyTab() {
  const t = useT(teamMessages)
  return (
    <section className="flex min-w-0 items-start gap-3 rounded-lg border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Lock className="size-4.5 text-muted-foreground" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-semibold">{t("owner_only_notice")}</h3>
        <p className="text-sm text-muted-foreground">{t("owner_only_body")}</p>
      </div>
    </section>
  )
}
