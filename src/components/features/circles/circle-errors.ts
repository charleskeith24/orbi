"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { toCircleError } from "@/lib/circles/types"
import { useT } from "@/lib/i18n"
import { circleErrorMessages } from "./messages"

/** A translated, actionable sentence for any Circles failure. */
export function useDescribeError(): (error: unknown) => string {
  const t = useT(circleErrorMessages)
  return useCallback((error: unknown) => t(toCircleError(error).code), [t])
}

/**
 * Runs one Circles mutation at a time per component: `pending` is the running action's key (for the
 * button's spinner), failures become an error toast. `run` resolves true when the action succeeded.
 */
export function useCircleAction() {
  const t = useT(circleErrorMessages)
  const describe = useDescribeError()
  const [pending, setPending] = useState<string | null>(null)
  const run = useCallback(
    async (key: string, action: () => Promise<unknown>): Promise<boolean> => {
      setPending(key)
      try {
        await action()
        return true
      } catch (error) {
        toast.error(t("error_title"), { description: describe(error) })
        return false
      } finally {
        setPending(null)
      }
    },
    [t, describe]
  )
  return { pending, run }
}
