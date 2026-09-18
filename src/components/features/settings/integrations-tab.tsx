"use client"

import { useState } from "react"
import { useT, useUiLang } from "@/lib/i18n"
import {
  INTEGRATION_CATEGORIES,
  integrationLabels,
  INTEGRATIONS,
  integrationsIn,
  type IntegrationAdapter,
  type IntegrationId,
} from "@/lib/integrations"
import { uiActions } from "@/lib/store"
import { ConnectDialog, type ConnectAttempt } from "./connect-dialog"
import { CsvImport } from "./csv-import"
import { IntegrationCard } from "./integration-card"
import { integrationsMessages } from "./integrations-messages"

export function IntegrationsTab({ now }: { now: Date }) {
  const t = useT(integrationsMessages)
  const labels = integrationLabels(useUiLang())
  const [attempt, setAttempt] = useState<ConnectAttempt | null>(null)
  const [pendingId, setPendingId] = useState<IntegrationId | null>(null)
  const connected = INTEGRATIONS.filter((a) => a.status() === "connected").length

  async function connect(adapter: IntegrationAdapter) {
    setPendingId(adapter.id)
    try {
      const result = await adapter.connect()
      setAttempt({ adapter, result })
    } finally {
      setPendingId(null)
    }
  }

  function goToImport() {
    setAttempt(null)
    window.requestAnimationFrame(() => document.getElementById("csv-import")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <CsvImport now={now} />

      <section aria-labelledby="settings-connections" className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0">
          <h3 id="settings-connections" className="text-sm leading-6 font-semibold">
            {t("connections")}
          </h3>
          <p className="text-xs text-pretty text-muted-foreground">
            {t("connections_description", { connected, total: INTEGRATIONS.length })}
          </p>
        </div>
        {INTEGRATION_CATEGORIES.map((category) => {
          const adapters = integrationsIn(category.id)
          if (!adapters.length) return null
          const text = labels.category(category.id)
          return (
            <div key={category.id} className="flex min-w-0 flex-col gap-2">
              <div>
                <h4 className="text-xs font-medium text-foreground">{text.label}</h4>
                <p className="text-xs text-muted-foreground">{text.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {adapters.map((adapter) => (
                  <IntegrationCard key={adapter.id} adapter={adapter} pending={pendingId === adapter.id} onConnect={() => void connect(adapter)} />
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <ConnectDialog
        attempt={attempt}
        onClose={() => setAttempt(null)}
        onImportCsv={goToImport}
        onLogPost={() => {
          setAttempt(null)
          uiActions.openDialog({ type: "log-post" })
        }}
      />
    </div>
  )
}
