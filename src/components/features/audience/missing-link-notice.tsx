"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { audienceMessages } from "./messages"

/** Shown when `?open=<id>` points at a row that no longer exists. */
export function MissingLinkNotice({ entity, onDismiss }: { entity: string; onDismiss: () => void }) {
  const t = useT(audienceMessages)
  return (
    <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <span className="min-w-0 flex-1">{t("missing_link", { entity })}</span>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={t("dismiss")} onClick={onDismiss}>
        <X aria-hidden />
      </Button>
    </div>
  )
}
