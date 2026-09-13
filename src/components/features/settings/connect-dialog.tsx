"use client"

import { FileSpreadsheet, Send } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { IntegrationAdapter, IntegrationConnectResult } from "@/lib/integrations"

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
  const adapter = attempt?.adapter
  const imports = adapter?.capabilities.includes("import_analytics") ?? false
  const publishes = adapter ? adapter.capabilities.some((c) => c === "publish" || c === "schedule") : false

  return (
    <Dialog open={Boolean(attempt)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {attempt && adapter ? (
          <>
            <DialogHeader>
              <DialogTitle>{adapter.name} isn&apos;t connected</DialogTitle>
              <DialogDescription>{attempt.result.message}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">What a real connection needs</p>
                <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-pretty">
                  {attempt.result.requirements.map((requirement) => (
                    <li key={requirement}>{requirement}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">What works today</p>
                <p className="mt-1 text-pretty">{adapter.manualPath}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              {imports ? (
                <Button type="button" onClick={onImportCsv}>
                  <FileSpreadsheet aria-hidden />
                  Import a CSV
                </Button>
              ) : publishes ? (
                <Button type="button" onClick={onLogPost}>
                  <Send aria-hidden />
                  Log a published post
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/studio" onClick={onClose}>
                    Open Content Studio
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
