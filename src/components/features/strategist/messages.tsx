"use client"

import { CircleAlert, CornerDownRight, Pencil, RotateCcw, Sparkles } from "lucide-react"
import { CopyButton, Markdown, ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatTime, isSameDay } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { ContextChips } from "./context-chips"
import { strategistSession, type PendingTurn } from "./session"
import { strategistMessages } from "./strategist-messages"
import { SuggestedIdeas } from "./suggested-ideas"
import type { StrategistTurn } from "./turns"

/** Answers may italicise with _underscores_; the shared Markdown renderer only knows *asterisks*. */
function normalizeEmphasis(markdown: string): string {
  return markdown.replace(/(^|[\s(“"])_([^_\n]+?)_(?=$|[\s).,;:!?”"])/gm, "$1*$2*")
}

export function StrategistAvatar({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand", className)}>
      <Sparkles className="size-3.5" />
    </span>
  )
}

function UserBubble({ text }: { text: string }) {
  const t = useT(strategistMessages)
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
        <span className="sr-only">{t("you")}</span>
        {text}
      </p>
    </div>
  )
}

function FollowUps({ questions, disabled }: { questions: string[]; disabled: boolean }) {
  const t = useT(strategistMessages)
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t("ask_next")}</p>
      <div className="flex flex-wrap gap-1.5">
        {questions.map((question) => (
          <Button
            key={question}
            type="button"
            variant="outline"
            size="xs"
            disabled={disabled}
            onClick={() => strategistSession.send(question)}
            className="h-auto min-h-6 max-w-full justify-start py-1 text-left whitespace-normal"
          >
            <CornerDownRight className="text-muted-foreground" aria-hidden />
            <span className="min-w-0">{question}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

/** One question and its answer: Markdown reply, context chips, suggested ideas, engine, follow-ups. */
export function TurnView({
  turn,
  latest,
  busy,
  chipLimit,
  now,
  onNavigate,
}: {
  turn: StrategistTurn
  /** Follow-up chips only make sense on the newest answer. */
  latest: boolean
  busy: boolean
  chipLimit: number
  now: Date
  onNavigate?: () => void
}) {
  const t = useT(strategistMessages)
  return (
    <li data-turn={turn.id} className="flex scroll-mt-16 flex-col gap-3">
      {turn.question ? <UserBubble text={turn.question} /> : null}
      <div className="flex gap-2.5">
        <StrategistAvatar className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span className="sr-only">Content Strategist:</span>
          <Markdown content={normalizeEmphasis(turn.reply)} />
          <ContextChips chips={turn.context} visible={chipLimit} />
          {turn.ideas.length ? <SuggestedIdeas turn={turn} onNavigate={onNavigate} /> : null}
          <div className="flex items-center gap-1.5">
            <ProviderBadge provider={turn.provider} model={turn.model || undefined} />
            <time dateTime={turn.createdAt} className="text-xs text-muted-foreground">
              {isSameDay(turn.createdAt, now) ? formatTime(turn.createdAt) : formatDateTime(turn.createdAt)}
            </time>
            <CopyButton text={turn.reply} size="icon-xs" successMessage={t("answer_copied")} className="ml-auto" />
          </div>
          {latest && turn.followUps.length ? <FollowUps questions={turn.followUps} disabled={busy} /> : null}
        </div>
      </div>
    </li>
  )
}

function TypingIndicator() {
  const t = useT(strategistMessages)
  return (
    <div role="status" className="flex h-6 items-center gap-1">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          aria-hidden
          className="size-1.5 rounded-full bg-muted-foreground/70 motion-safe:animate-pulse"
          style={{ animationDelay: `${dot * 200}ms` }}
        />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground">{t("thinking")}</span>
    </div>
  )
}

function FailedAnswer({ message }: { message: string | null }) {
  const t = useT(strategistMessages)
  return (
    <div role="alert" className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border border-critical/30 bg-critical/5 p-3 dark:bg-critical/10">
      <p className="flex items-center gap-1.5 text-sm font-medium text-critical-fg">
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        {t("failed")}
      </p>
      {message ? <p className="text-xs text-pretty text-muted-foreground">{message}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="xs" onClick={() => strategistSession.retry()}>
          <RotateCcw aria-hidden />
          {t("retry")}
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={() => strategistSession.edit()}>
          <Pencil aria-hidden />
          {t("edit_question")}
        </Button>
      </div>
    </div>
  )
}

/** The question in flight: typing indicator, or the error with Retry / Edit question. */
export function PendingView({ pending }: { pending: PendingTurn }) {
  return (
    <li className="flex flex-col gap-3">
      <UserBubble text={pending.question} />
      <div className="flex gap-2.5">
        <StrategistAvatar className="mt-0.5" />
        {pending.status === "sending" ? <TypingIndicator /> : <FailedAnswer message={pending.error} />}
      </div>
    </li>
  )
}
