"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { useT, useUiLang } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { ContentPillar } from "@/lib/types"
import { describeUsage, pillarUsage } from "./pillar-math"
import { pillarMessages } from "./pillar-messages"

/**
 * Confirmed pillar delete. Linked content, ideas and library rows keep their data —
 * the store sets their pillar to none. Render the returned element once.
 */
export function usePillarDelete(
  onBeforeDelete?: (pillar: ContentPillar) => void
): [(pillar: ContentPillar) => Promise<boolean>, React.ReactElement] {
  const [confirm, element] = useConfirm()
  const t = useT(pillarMessages)
  const lang = useUiLang()

  const request = useCallback(
    async (pillar: ContentPillar) => {
      const usage = pillarUsage(dataActions.getDb(), pillar.id)
      const linked = describeUsage(usage, lang)
      const name = pillar.name || t("untitled_pillar")
      const ok = await confirm({
        title: t("delete_title", { name }),
        description: usage.total ? t("delete_description_linked", { linked }) : t("delete_description"),
        confirmLabel: t("delete_pillar"),
      })
      if (!ok) return false
      onBeforeDelete?.(pillar)
      dataActions.remove("content_pillars", pillar.id)
      toast.success(t("deleted", { name }), {
        description: usage.total ? t.plural("deleted_linked", usage.total, { linked }) : undefined,
      })
      return true
    },
    [confirm, onBeforeDelete, t, lang]
  )

  return [request, element]
}
