"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { strategistSession, useStrategistConversation } from "./session"

/**
 * "Clear conversation" behind a confirmation. `count` is the answered questions plus a failed one,
 * so the control can be disabled when there is nothing to clear. Render `dialog` once.
 */
export function useClearConversation() {
  const [confirm, dialog] = useConfirm()
  const { total, pending } = useStrategistConversation()
  const count = total + (pending ? 1 : 0)

  const clear = useCallback(async () => {
    const what =
      total === 0 ? "the unanswered question" : total === 1 ? "1 question and its answer" : `${total} questions and their answers`
    const ok = await confirm({
      title: "Clear the conversation?",
      description: `This deletes ${what} from this workspace. Ideas you saved stay in the Idea Bank.`,
      confirmLabel: "Clear conversation",
    })
    if (!ok) return
    strategistSession.clear()
    toast.success("Conversation cleared")
  }, [confirm, total])

  return { clear, dialog, count }
}
