"use client"

import { ChevronRight } from "lucide-react"
import { PlatformIcon } from "@/components/common"
import { useT } from "@/lib/i18n"
import { IMPORT_PRESETS } from "@/lib/integrations"
import { m } from "./csv-messages"

/** "Where do I get the file?" — how to download each export the importer recognises. */
export function CsvExportGuide() {
  const t = useT(m)
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 text-muted-foreground group-open:rotate-90" aria-hidden />
        {t("guide_summary")}
      </summary>
      <ul className="flex flex-col gap-2.5 border-t px-3 py-3">
        {IMPORT_PRESETS.map((preset) => (
          <li key={preset.id} className="flex min-w-0 gap-2.5">
            <PlatformIcon platform={preset.platform} colored className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium">
                {preset.app} · {t(`preset_${preset.id}` as const)}
              </p>
              <p className="text-xs text-pretty text-muted-foreground">{t(`guide_${preset.id}` as const)}</p>
            </div>
          </li>
        ))}
        <li className="text-xs text-pretty text-muted-foreground">{t("guide_other")}</li>
      </ul>
    </details>
  )
}
