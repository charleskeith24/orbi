/**
 * Batching queue for usage events. Pure factory (no browser globals) so it is unit-testable;
 * `src/lib/telemetry/index.ts` wires the browser instance.
 *
 * - `track` is a no-op unless `isEnabled()` (online version + opted in on this device).
 * - Events are sanitised on the way in (`sanitizeProps`, `normalizePath`).
 * - Flushes when `batchSize` events are waiting, after `flushDelayMs`, or on demand (page hide).
 * - Network/server failures keep the events and retry with backoff; rejected batches (4xx) are dropped.
 * - If the user opts out, queued events are dropped before anything else is sent.
 */
import { normalizePath, sanitizeProps, VIEW_EVENTS, type UsageEventName, type UsageEventRow, type UsageProps } from "./events"

export type SendResult = "ok" | "retry" | "drop"

export interface TelemetryOptions {
  send: (events: UsageEventRow[], options: { keepalive: boolean }) => Promise<SendResult>
  isEnabled: () => boolean
  getPath: () => string
  getSessionId: () => string
  now?: () => Date
  /** Events per request (default 20). */
  batchSize?: number
  /** Wait before sending a partial batch (default 5 s). */
  flushDelayMs?: number
  /** Oldest events are dropped beyond this (default 200). */
  maxQueue?: number
  /** Identical view events within this window count once (default 1.5 s). */
  dedupeMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface Telemetry {
  track: (name: UsageEventName, props?: UsageProps, context?: { path?: string }) => boolean
  flush: (options?: { keepalive?: boolean }) => Promise<void>
  /** Drops everything queued (used when the user opts out). */
  clear: () => void
  pending: () => number
  isEnabled: () => boolean
}

const MAX_BACKOFF_MS = 60_000

export function createTelemetry(options: TelemetryOptions): Telemetry {
  const now = options.now ?? (() => new Date())
  const batchSize = options.batchSize ?? 20
  const flushDelayMs = options.flushDelayMs ?? 5000
  const maxQueue = options.maxQueue ?? 200
  const dedupeMs = options.dedupeMs ?? 1500
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))

  let queue: UsageEventRow[] = []
  let timer: unknown = null
  let failures = 0
  let lastView: { key: string; at: number } | null = null
  let chain: Promise<void> = Promise.resolve()

  function cancelTimer() {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  function schedule(ms: number) {
    if (timer !== null) return
    timer = setTimer(() => {
      timer = null
      void flush()
    }, ms)
  }

  function track(name: UsageEventName, props: UsageProps = {}, context: { path?: string } = {}): boolean {
    if (!options.isEnabled()) return false
    const at = now()
    const path = normalizePath(context.path ?? options.getPath())
    const clean = sanitizeProps(name, props)
    if (VIEW_EVENTS.has(name)) {
      const key = `${name}|${path}|${JSON.stringify(clean)}`
      if (lastView && lastView.key === key && at.getTime() - lastView.at < dedupeMs) return false
      lastView = { key, at: at.getTime() }
    }
    queue.push({ name, props: clean, path, session_id: options.getSessionId(), occurred_at: at.toISOString() })
    if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue)
    if (queue.length >= batchSize && failures === 0) void flush()
    else schedule(flushDelayMs)
    return true
  }

  async function drain(keepalive: boolean) {
    while (queue.length) {
      if (!options.isEnabled()) {
        queue = []
        return
      }
      const batch = queue.slice(0, batchSize)
      let result: SendResult
      try {
        result = await options.send(batch, { keepalive })
      } catch {
        result = "retry"
      }
      if (result === "retry") {
        failures += 1
        schedule(Math.min(MAX_BACKOFF_MS, flushDelayMs * 2 ** failures))
        return
      }
      failures = 0
      const done = new Set(batch)
      queue = queue.filter((event) => !done.has(event))
    }
  }

  function flush({ keepalive = false }: { keepalive?: boolean } = {}): Promise<void> {
    cancelTimer()
    chain = chain.then(() => drain(keepalive))
    return chain
  }

  function clear() {
    queue = []
    failures = 0
    cancelTimer()
  }

  return { track, flush, clear, pending: () => queue.length, isEnabled: options.isEnabled }
}
