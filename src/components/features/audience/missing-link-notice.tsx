"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Shown when `?open=<id>` points at a row that no longer exists. */
export function MissingLinkNotice({ entity, onDismiss }: { entity: string; onDismiss: () => void }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <span className="min-w-0 flex-1">The {entity} in this link no longer exists — it may have been deleted.</span>
      <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={onDismiss}>
        <X aria-hidden />
      </Button>
    </div>
  )
}
