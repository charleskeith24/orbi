"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { dataActions } from "@/lib/store"
import type { ContentPillar } from "@/lib/types"
import { describeUsage, pillarUsage } from "./pillar-math"

/**
 * Confirmed pillar delete. Linked content, ideas and library rows keep their data —
 * the store sets their pillar to none. Render the returned element once.
 */
export function usePillarDelete(
  onBeforeDelete?: (pillar: ContentPillar) => void
): [(pillar: ContentPillar) => Promise<boolean>, React.ReactElement] {
  const [confirm, element] = useConfirm()

  const request = useCallback(
    async (pillar: ContentPillar) => {
      const usage = pillarUsage(dataActions.getDb(), pillar.id)
      const linked = describeUsage(usage)
      const name = pillar.name || "Untitled pillar"
      const ok = await confirm({
        title: `Delete the “${name}” pillar?`,
        description: usage.total
          ? `Linked records (${linked}) keep all their data but lose this pillar. To keep its history in analytics, pause the pillar instead. This can't be undone.`
          : "Nothing is linked to this pillar yet. This can't be undone.",
        confirmLabel: "Delete pillar",
      })
      if (!ok) return false
      onBeforeDelete?.(pillar)
      dataActions.remove("content_pillars", pillar.id)
      toast.success(`${name} deleted`, {
        description: usage.total ? `${linked} ${usage.total === 1 ? "no longer has" : "no longer have"} a pillar.` : undefined,
      })
      return true
    },
    [confirm, onBeforeDelete]
  )

  return [request, element]
}
