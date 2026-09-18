"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { useT } from "@/lib/i18n"
import { strategistSession, useStrategistConversation } from "./session"
import { strategistMessages } from "./strategist-messages"

/**
 * "Clear conversation" behind a confirmation. `count` is the answered questions plus a failed one,
 * so the control can be disabled when there is nothing to clear. Render `dialog` once.
 */
export function useClearConversation() {
  const [confirm, dialog] = useConfirm()
  const { total, pending } = useStrategistConversation()
  const count = total + (pending ? 1 : 0)
  const t = useT(strategistMessages)

  const clear = useCallback(async () => {
    const what = total === 0 ? t("clear_what_pending") : total === 1 ? t("clear_what_single") : t("clear_what_many", { count: total })
    const ok = await confirm({
      title: t("clear_title"),
      description: t("clear_description", { what }),
      confirmLabel: t("clear"),
    })
    if (!ok) return
    strategistSession.clear()
    toast.success(t("cleared"))
  }, [confirm, total, t])

  return { clear, dialog, count }
}
