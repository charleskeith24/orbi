"use client"

import { ArrowUp, MessageSquareText, Square } from "lucide-react"
import { useEffect, useRef } from "react"
import { useIsMac } from "@/components/app-shell/keyboard-shortcuts"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { Textarea } from "@/components/ui/textarea"
import { useT, useUiLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { suggestedPrompts } from "./prompts"
import { strategistSession, useStrategistSession } from "./session"
import { strategistMessages } from "./strategist-messages"
import { MAX_QUESTION_CHARS } from "./turns"

function PromptMenu({ disabled, inputRef }: { disabled: boolean; inputRef: React.RefObject<HTMLTextAreaElement | null> }) {
  // Prompts that need details land in the composer — keep focus there instead of on the trigger.
  const focusComposer = useRef(false)
  const t = useT(strategistMessages)
  const prompts = suggestedPrompts(useUiLang())
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="xs" disabled={disabled} className="text-muted-foreground">
          <MessageSquareText aria-hidden />
          {t("prompts")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-72"
        onCloseAutoFocus={(event) => {
          if (!focusComposer.current) return
          focusComposer.current = false
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("suggested_prompts")}</DropdownMenuLabel>
        {prompts.map((prompt) => {
          const Icon = prompt.icon
          return (
            <DropdownMenuItem
              key={prompt.text}
              onSelect={() => {
                focusComposer.current = Boolean(prompt.prefill)
                strategistSession.pick(prompt)
              }}
            >
              <Icon aria-hidden />
              <span className="min-w-0 flex-1">{prompt.label ?? prompt.text}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Question box shared by the panel and the page: ⌘/Ctrl+Enter sends, Stop cancels a slow answer. */
export function Composer({
  variant,
  disabled = false,
  inputRef,
  onClosePanel,
}: {
  variant: "panel" | "page"
  disabled?: boolean
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  onClosePanel?: () => void
}) {
  const draft = useStrategistSession((s) => s.draft)
  const sending = useStrategistSession((s) => s.pending?.status === "sending")
  const focusRequest = useStrategistSession((s) => s.focusRequest)
  const localRef = useRef<HTMLTextAreaElement>(null)
  const fieldRef = inputRef ?? localRef
  const handledFocus = useRef(focusRequest)
  const isMac = useIsMac()
  const t = useT(strategistMessages)

  useEffect(() => {
    if (focusRequest === handledFocus.current) return
    handledFocus.current = focusRequest
    const field = fieldRef.current
    if (!field) return
    const { caret } = useStrategistSession.getState()
    const at = caret === null ? field.value.length : Math.min(caret, field.value.length)
    field.focus()
    field.setSelectionRange(at, at)
    if (caret !== null) useStrategistSession.setState({ caret: null })
  }, [focusRequest, fieldRef])

  const canSend = !disabled && !sending && draft.trim().length > 0
  const remaining = MAX_QUESTION_CHARS - draft.length

  function submit() {
    if (canSend && strategistSession.send(draft)) strategistSession.setDraft("")
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = event.metaKey || event.ctrlKey
    if (mod && event.key === "Enter") {
      event.preventDefault()
      submit()
    } else if (variant === "panel" && mod && !event.altKey && !event.shiftKey && event.code === "KeyJ") {
      // ⌘J toggles the panel everywhere else; the global shortcut yields to text fields.
      event.preventDefault()
      onClosePanel?.()
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className={cn(
        "shrink-0 border-t p-3",
        variant === "panel" ? "bg-popover" : "sticky bottom-[var(--bottom-bar,0px)] z-10 rounded-b-lg bg-card lg:static"
      )}
    >
      <div className="flex flex-col rounded-lg border bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        <Textarea
          ref={fieldRef}
          value={draft}
          onChange={(event) => strategistSession.setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_QUESTION_CHARS}
          disabled={disabled}
          placeholder={t("placeholder")}
          aria-label={t("composer_label")}
          className="max-h-40 min-h-11 resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <PromptMenu disabled={disabled} inputRef={fieldRef} />
          <div className="ml-auto flex items-center gap-2">
            {remaining < 400 ? (
              <span className="text-xs text-muted-foreground tabular-nums">{t("chars_left", { count: remaining })}</span>
            ) : null}
            <span className="hidden items-center gap-0.5 sm:inline-flex" aria-hidden>
              <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>↵</Kbd>
            </span>
            {sending ? (
              <Button type="button" variant="outline" size="icon-sm" onClick={() => strategistSession.stop()} aria-label={t("stop")}>
                <Square className="size-3 fill-current" aria-hidden />
              </Button>
            ) : (
              <Button type="submit" size="icon-sm" disabled={!canSend} aria-label={t("send")}>
                <ArrowUp aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
