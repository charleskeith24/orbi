"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { AiProviderId } from "@/lib/types"
import { runAiTask, type AiRunResult, type RunAiTaskOptions } from "./client"
import { toAiError, type AiError } from "./errors"
import type { AiTaskInput, AiTaskName, AiTaskOutput } from "./tasks"

interface TaskState<N extends AiTaskName> {
  data: AiTaskOutput<N> | null
  error: AiError | null
  isPending: boolean
  provider: AiProviderId | null
  model: string | null
}

const IDLE = { data: null, error: null, isPending: false, provider: null, model: null }

/**
 * Run one AI task from a component. `run` resolves with the result, or null when it failed or was
 * superseded (the error is in `error`). Latest call wins; nothing updates after unmount; previous
 * `data` stays visible while regenerating.
 */
export function useAiTask<N extends AiTaskName>(task: N) {
  const [state, setState] = useState<TaskState<N>>(IDLE)
  const mounted = useRef(true)
  const callId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
    }
  }, [])

  const run = useCallback(
    async (input: AiTaskInput<N>, options: Omit<RunAiTaskOptions, "signal"> = {}): Promise<AiRunResult<N> | null> => {
      const id = ++callId.current
      controller.current?.abort()
      const abort = new AbortController()
      controller.current = abort
      setState((s) => ({ ...s, isPending: true, error: null }))
      try {
        const result = await runAiTask(task, input, { ...options, signal: abort.signal })
        if (id !== callId.current) return null
        if (mounted.current) setState({ data: result.output, error: null, isPending: false, provider: result.provider, model: result.model })
        return result
      } catch (err) {
        const error = toAiError(err)
        if (mounted.current && id === callId.current && error.code !== "aborted") setState((s) => ({ ...s, isPending: false, error }))
        return null
      } finally {
        if (controller.current === abort) controller.current = null
      }
    },
    [task]
  )

  const reset = useCallback(() => {
    callId.current++
    controller.current?.abort()
    controller.current = null
    setState(IDLE)
  }, [])

  return { ...state, run, reset }
}

export interface AiStatus {
  provider: AiProviderId
  model: string
  /** A live model (API key) is configured on the server. */
  configured: boolean
  reason: string
}

let statusCache: AiStatus | null = null
let statusRequest: Promise<AiStatus | null> | null = null

/** GET /api/ai/status once per session (successful results are cached; failures retry next time). */
export function fetchAiStatus(): Promise<AiStatus | null> {
  if (statusCache) return Promise.resolve(statusCache)
  statusRequest ??= fetch("/api/ai/status", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Partial<AiStatus>>) : null))
    .then((s) => {
      if (!s || typeof s.provider !== "string") return null
      statusCache = { provider: s.provider as AiProviderId, model: s.model ?? "", configured: Boolean(s.configured), reason: s.reason ?? "" }
      return statusCache
    })
    .catch(() => null)
    .finally(() => {
      statusRequest = null
    })
  return statusRequest
}

/** Which engine the gateway will use — for ProviderBadge and "Offline mode" notices. */
export function useAiStatus(): AiStatus & { loading: boolean } {
  const [status, setStatus] = useState<AiStatus | null>(statusCache)
  const [loading, setLoading] = useState(statusCache === null)

  useEffect(() => {
    if (statusCache) return
    let active = true
    void fetchAiStatus().then((s) => {
      if (!active) return
      setStatus(s)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  if (status) return { ...status, loading: false }
  return { provider: "offline", model: "offline-templates", configured: false, reason: loading ? "" : "Couldn't reach the AI service.", loading }
}
