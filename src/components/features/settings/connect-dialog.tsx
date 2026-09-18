"use client"

import { FileSpreadsheet, Send } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { integrationText, localizeConnectResult, type IntegrationAdapter, type IntegrationConnectResult } from "@/lib/integrations"
import { integrationsMessages } from "./integrations-messages"

export interface ConnectAttempt {
  adapter: IntegrationAdapter
  result: IntegrationConnectResult
}

/** The honest outcome of `adapter.connect()`: what's missing and the manual path that works today. */
export function ConnectDialog({
  attempt,
  onClose,
  onImportCsv,
  onLogPost,
}: {
  attempt: ConnectAttempt | null
  onClose: () => void
  onImportCsv: () => void
  onLogPost: () => void
}) {
  const t = useT(integrationsMessages)
  const c = useT(commonMessages)
  const lang = useUiLang()
  const adapter = attempt?.adapter
  const result = attempt ? localizeConnectResult(attempt.adapter, attempt.result, lang) : null
  const imports = adapter?.capabilities.includes("import_analytics") ?? false
  const publishes = adapter ? adapter.capabilities.some((c) => c === "publish" || c === "schedule") : false

  return (
    <Dialog open={Boolean(attempt)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {attempt && adapter && result ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("not_connected_title", { name: adapter.name })}</DialogTitle>
              <DialogDescription>{result.message}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("needs")}</p>
                <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-pretty">
                  {result.requirements.map((requirement) => (
                    <li key={requirement}>{requirement}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("works_today")}</p>
                <p className="mt-1 text-pretty">{integrationText(adapter, lang).manualPath}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {c("close")}
              </Button>
              {imports ? (
                <Button type="button" onClick={onImportCsv}>
                  <FileSpreadsheet aria-hidden />
                  {t("import_csv")}
                </Button>
              ) : publishes ? (
                <Button type="button" onClick={onLogPost}>
                  <Send aria-hidden />
                  {t("log_post")}
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/studio" onClick={onClose}>
                    {t("open_studio")}
                  </Link>
                </Button>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
