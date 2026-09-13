"use client"

import { Maximize2, Sparkles, Trash2, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAiStatus } from "@/lib/ai"
import { useDataStore, useUIStore } from "@/lib/store"
import { useClearConversation } from "./clear-conversation"
import { Conversation } from "./conversation"
import { strategistSession } from "./session"

const FULL_PAGE = "/strategist"

function PanelHeader({ onClose }: { onClose: () => void }) {
  const ai = useAiStatus()
  const { clear, dialog, count } = useClearConversation()
  return (
    <header className="flex shrink-0 items-start gap-3 border-b px-4 py-3">
      <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SheetTitle className="text-sm leading-5 font-semibold">Content Strategist</SheetTitle>
          {ai.loading ? null : <ProviderBadge provider={ai.provider} model={ai.model || undefined} />}
        </div>
        <SheetDescription className="mt-0.5 truncate text-xs">Uses your Brand HQ and live analytics</SheetDescription>
      </div>
      <div className="-mr-1 flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={FULL_PAGE} onClick={onClose} aria-label="Open full page">
                <Maximize2 aria-hidden />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open full page</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Clear conversation" disabled={!count} onClick={() => void clear()}>
              <Trash2 aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear conversation</TooltipContent>
        </Tooltip>
        <SheetClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close">
            <X aria-hidden />
          </Button>
        </SheetClose>
      </div>
      {dialog}
    </header>
  )
}

/**
 * The Content Strategist panel (spec §56–57), mounted once by the app shell. It opens from the top bar,
 * ⌘/Ctrl+J, ⌘K and `uiActions.askStrategist(prompt)`; a queued prompt is sent as soon as it opens.
 * On /strategist the page hosts the conversation, so prompts go there and the panel stays closed.
 */
export function StrategistPanel() {
  const open = useUIStore((s) => s.strategistOpen)
  const queued = useUIStore((s) => s.strategistPrompt)
  const setOpen = useUIStore((s) => s.setStrategistOpen)
  const ready = useDataStore((s) => s.status === "ready")
  const onFullPage = usePathname() === FULL_PAGE
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open || !ready) return
    const prompt = useUIStore.getState().consumeStrategistPrompt()
    if (onFullPage) {
      setOpen(false)
      if (!prompt || !strategistSession.send(prompt)) strategistSession.requestFocus()
      return
    }
    if (prompt) strategistSession.send(prompt)
  }, [open, ready, queued, onFullPage, setOpen])

  const close = () => setOpen(false)

  return (
    <Sheet open={open && !onFullPage} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]"
        onOpenAutoFocus={(event) => {
          // Keyboard and mouse users land in the composer; touch devices keep the on-screen keyboard closed.
          if (window.matchMedia("(pointer: coarse)").matches) return
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <PanelHeader onClose={close} />
        <Conversation variant="panel" inputRef={inputRef} onNavigate={close} onClosePanel={close} />
      </SheetContent>
    </Sheet>
  )
}
