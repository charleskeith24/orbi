"use client"

import { useEffect, useRef } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useDataStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Composer } from "./composer"
import { EmptyConversation } from "./empty-conversation"
import { PendingView, TurnView } from "./messages"
import { useStrategistConversation } from "./session"
import { useNow } from "./use-now"

/** Scroll inside the log when it scrolls itself (panel, desktop page); otherwise move the page (mobile page). */
function reveal(list: HTMLElement, target: Element | null | undefined, block: "start" | "end") {
  if (!(target instanceof HTMLElement)) return
  if (list.scrollHeight > list.clientHeight + 1 && getComputedStyle(list).overflowY !== "visible") {
    list.scrollTo({ top: block === "start" ? target.offsetTop - 16 : list.scrollHeight, behavior: "smooth" })
  } else {
    target.scrollIntoView({ block, behavior: "smooth" })
  }
}

function ConversationSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading conversation">
      <Skeleton className="ml-auto h-9 w-3/5 rounded-2xl" />
      <div className="flex gap-2.5">
        <Skeleton className="size-6 rounded-md" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}

/**
 * The strategist conversation (message log + composer), shared by the panel and /strategist.
 * `page` lets the page scroll on small screens with the composer pinned to the bottom.
 */
export function Conversation({
  variant,
  inputRef,
  onNavigate,
  onClosePanel,
  className,
}: {
  variant: "panel" | "page"
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  /** Called before an in-app link navigates away (the panel closes itself). */
  onNavigate?: () => void
  onClosePanel?: () => void
  className?: string
}) {
  const ready = useDataStore((s) => s.status === "ready")
  const { turns, pending } = useStrategistConversation()
  const now = useNow()
  const listRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const seen = useRef<number | null>(null)
  const busy = pending?.status === "sending"
  const page = variant === "page"
  const lastTurnId = turns[turns.length - 1]?.id ?? null

  // Start at the newest message; then follow a new question to the bottom and an answer to its start.
  useEffect(() => {
    if (!ready) return
    const list = listRef.current
    const previous = seen.current
    seen.current = turns.length
    if (previous === null) {
      if (list) list.scrollTop = list.scrollHeight
      return
    }
    const frame = requestAnimationFrame(() => {
      if (!list) return
      if (pending) reveal(list, endRef.current, "end")
      else if (turns.length > previous && lastTurnId) reveal(list, list.querySelector(`[data-turn="${lastTurnId}"]`), "start")
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, turns.length, lastTurnId, pending])

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={listRef}
        role="log"
        aria-label="Conversation with the Content Strategist"
        aria-busy={busy || undefined}
        // `relative` keeps absolutely positioned descendants (sr-only labels) inside the scroller, so they
        // can't stretch the page below it.
        className={cn(
          "relative px-4 py-4",
          page ? "lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:scrollbar-thin" : "min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin"
        )}
      >
        {!ready ? (
          <ConversationSkeleton />
        ) : turns.length || pending ? (
          <ol className="flex flex-col gap-6">
            {turns.map((turn, index) => (
              <TurnView
                key={turn.id}
                turn={turn}
                latest={!pending && index === turns.length - 1}
                busy={busy}
                chipLimit={page ? 6 : 4}
                now={now}
                onNavigate={onNavigate}
              />
            ))}
            {pending ? <PendingView pending={pending} /> : null}
          </ol>
        ) : (
          <EmptyConversation variant={variant} />
        )}
        <div ref={endRef} aria-hidden className={cn("h-px", page && "scroll-mb-28 lg:scroll-mb-0")} />
      </div>
      <Composer variant={variant} disabled={!ready} inputRef={inputRef} onClosePanel={onClosePanel} />
    </div>
  )
}
