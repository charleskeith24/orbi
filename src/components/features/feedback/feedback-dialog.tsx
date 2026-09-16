"use client"

import { Bug, CircleAlert, CircleHelp, Copy, HardDrive, Heart, Lightbulb, MapPin, Send, type LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { useIsMac } from "@/components/app-shell/keyboard-shortcuts"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useT, useUiLang } from "@/lib/i18n"
import { FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH, feedbackPage, viewportFor, type FeedbackKind } from "@/lib/telemetry/feedback"
import { copyText, formatFeedbackText, sendFeedback, type FeedbackMessages } from "./feedback-model"
import { m } from "./messages"
import { UsageConsentSwitch } from "./usage-consent-switch"
import { useIsOnlineVersion } from "./use-beta"

type MessageKey = keyof FeedbackMessages

const KINDS: Record<FeedbackKind, { icon: LucideIcon; label: MessageKey; placeholder: MessageKey }> = {
  bug: { icon: Bug, label: "kind_bug", placeholder: "placeholder_bug" },
  idea: { icon: Lightbulb, label: "kind_idea", placeholder: "placeholder_idea" },
  confusing: { icon: CircleHelp, label: "kind_confusing", placeholder: "placeholder_confusing" },
  praise: { icon: Heart, label: "kind_praise", placeholder: "placeholder_praise" },
}

const COUNTER_FROM = FEEDBACK_MAX_LENGTH - 500

/**
 * Feedback dialog. Online version → POST /api/feedback (with the current page). Local mode → an
 * honest note and "Copy feedback". The usage-analytics opt-in lives here too (online only).
 */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so every open starts blank. */}
        <FeedbackForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const t = useT(m)
  const lang = useUiLang()
  const online = useIsOnlineVersion()
  const isMac = useIsMac()
  const page = feedbackPage(usePathname())
  const id = useId()
  const kindRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const [kind, setKind] = useState<FeedbackKind | null>(null)
  const [message, setMessage] = useState("")
  const [errors, setErrors] = useState<{ kind?: string; message?: string }>({})
  const [pending, setPending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const trimmed = message.trim()

  /** Shows inline errors and focuses the first one. Returns the kind when the form is complete. */
  function validated(): FeedbackKind | null {
    const next = { kind: kind ? undefined : t("kind_error"), message: trimmed ? undefined : t("message_error") }
    setErrors(next)
    if (next.kind) kindRef.current?.querySelector<HTMLElement>("button")?.focus()
    else if (next.message) messageRef.current?.focus()
    return next.kind || next.message ? null : kind
  }

  async function copy() {
    const chosen = validated()
    if (!chosen) return
    const text = formatFeedbackText(
      { kindLabel: t(KINDS[chosen].label), message: trimmed, page, lang, viewport: viewportFor(window.innerWidth), date: new Date() },
      t
    )
    if (await copyText(text)) {
      toast.success(t("copied_toast"), { description: t("copied_toast_body") })
      onClose()
    } else {
      toast.error(t("copy_failed"))
    }
  }

  async function send() {
    if (pending) return
    const chosen = validated()
    if (!chosen) return
    setPending(true)
    setSendError(null)
    const result = await sendFeedback({ kind: chosen, message: trimmed, page, ui_language: lang, viewport: viewportFor(window.innerWidth) })
    setPending(false)
    if (result === "ok") {
      toast.success(t("sent_toast"), { description: t("sent_toast_body") })
      onClose()
      return
    }
    setSendError(t(result === "signed_out" ? "error_signed_out" : result === "offline" ? "error_offline" : "error_generic"))
  }

  const submit = () => void (online ? send() : copy())

  return (
    <form
      noValidate
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          submit()
        }
      }}
    >
      <DialogHeader className="pr-8">
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription className="text-pretty">{online ? t("description_online") : t("description_local")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <span id={`${id}-kind-label`} className="text-sm font-medium">
          {t("kind_label")}
        </span>
        <ToggleGroup
          ref={kindRef}
          type="single"
          variant="outline"
          value={kind ?? ""}
          onValueChange={(value) => {
            if (!value) return
            setKind(value as FeedbackKind)
            setErrors((current) => ({ ...current, kind: undefined }))
          }}
          aria-labelledby={`${id}-kind-label`}
          aria-describedby={errors.kind ? `${id}-kind-error` : undefined}
          className="grid w-full grid-cols-2 sm:grid-cols-4"
        >
          {FEEDBACK_KINDS.map((value) => {
            const Icon = KINDS[value].icon
            return (
              <ToggleGroupItem
                key={value}
                value={value}
                className="w-full aria-pressed:bg-brand-soft data-[state=on]:border-brand/60 data-[state=on]:bg-brand-soft"
              >
                <Icon aria-hidden />
                {t(KINDS[value].label)}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        {errors.kind ? (
          <p id={`${id}-kind-error`} role="alert" className="text-xs text-destructive">
            {errors.kind}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-message`} className="text-sm font-medium">
          {t("message_label")}
        </label>
        <Textarea
          ref={messageRef}
          id={`${id}-message`}
          value={message}
          maxLength={FEEDBACK_MAX_LENGTH}
          rows={5}
          placeholder={t(kind ? KINDS[kind].placeholder : "placeholder_default")}
          aria-invalid={Boolean(errors.message) || undefined}
          aria-describedby={`${id}-message-help`}
          className="min-h-28 resize-y"
          onChange={(event) => {
            setMessage(event.target.value)
            if (errors.message) setErrors((current) => ({ ...current, message: undefined }))
          }}
        />
        {errors.message ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.message}
          </p>
        ) : null}
        <div id={`${id}-message-help`} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {t("page_label", { page })} · {t("page_attached")}
            </span>
          </span>
          {message.length >= COUNTER_FROM ? (
            <span className="shrink-0 num">
              {message.length.toLocaleString("en-US")} / {FEEDBACK_MAX_LENGTH.toLocaleString("en-US")}
            </span>
          ) : null}
        </div>
      </div>

      {online ? (
        <UsageConsentSwitch />
      ) : (
        <Alert role="note">
          <HardDrive aria-hidden />
          <AlertTitle>{t("local_title")}</AlertTitle>
          <AlertDescription className="text-pretty">{t("local_body")}</AlertDescription>
        </Alert>
      )}

      {sendError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{sendError}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter className="sm:items-center">
        <span className="mr-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          <KbdGroup>
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>↵</Kbd>
          </KbdGroup>
          {t("shortcut")}
        </span>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        {online && sendError ? (
          <Button type="button" variant="outline" onClick={() => void copy()}>
            <Copy aria-hidden />
            {t("copy_instead")}
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : online ? <Send aria-hidden /> : <Copy aria-hidden />}
          {pending ? t("sending") : online ? t("send") : t("copy")}
        </Button>
      </DialogFooter>
    </form>
  )
}
