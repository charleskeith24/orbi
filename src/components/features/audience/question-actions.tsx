"use client"

import {
  CircleCheck,
  CircleMinus,
  Ellipsis,
  ExternalLink,
  Lightbulb,
  Link2,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PRIORITY_MAP } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import { createIdea, dataActions } from "@/lib/store"
import type { AudienceQuestion, ContentIdea, ID, QuestionStatus } from "@/lib/types"
import { cn, formatNumber, truncate } from "@/lib/utils"
import { askedAgainPatch, questionIdeaValues, questionPriority } from "./audience-model"

/**
 * +1 asked again, convert to idea, mark answered, dismiss/restore, copy link and delete for
 * Question Bank rows. `onAnswer` opens the content picker. Render `confirmDialog` once.
 */
export function useQuestionActions({
  onOpen,
  onAnswer,
  onDeleted,
}: {
  onOpen: (id: ID) => void
  onAnswer: (question: AudienceQuestion) => void
  onDeleted?: (id: ID) => void
}) {
  const router = useRouter()
  const [confirm, confirmDialog] = useConfirm()

  function askedAgain(question: AudienceQuestion) {
    const patch = askedAgainPatch(question, toISODate(new Date()))
    dataActions.update("audience_questions", question.id, patch)
    const frequency = patch.frequency ?? question.frequency
    const before = questionPriority(question.frequency)
    const after = questionPriority(frequency)
    toast.success(`Asked again — now ${formatNumber(frequency)}×`, {
      description:
        after !== before
          ? `Now ${PRIORITY_MAP[after].label.toLowerCase()} priority · ${truncate(question.question, 60)}`
          : truncate(question.question, 80),
    })
  }

  function convertToIdea(question: AudienceQuestion): ContentIdea | undefined {
    const existing = question.idea_id ? dataActions.getDb().content_ideas.find((i) => i.id === question.idea_id) : undefined
    if (existing) {
      router.push(`/ideas?open=${existing.id}`)
      return existing
    }
    const idea = createIdea(questionIdeaValues(question))
    dataActions.update("audience_questions", question.id, {
      idea_id: idea.id,
      // An answered question keeps its answer; the idea is an extra piece.
      ...(question.status === "answered" ? {} : { status: "idea_created" as const }),
    })
    toast.success("Idea added to the Idea Bank", {
      description: idea.title,
      action: { label: "Open idea", onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
    return idea
  }

  function answer(question: AudienceQuestion, itemId: ID) {
    dataActions.update("audience_questions", question.id, { content_item_id: itemId, status: "answered" })
    const item = dataActions.getDb().content_items.find((i) => i.id === itemId)
    toast.success("Marked as answered", {
      description: item ? truncate(item.title, 80) : undefined,
      action: { label: "Open content", onClick: () => router.push(`/studio/${itemId}`) },
    })
  }

  function dismiss(question: AudienceQuestion) {
    const previous: QuestionStatus = question.status
    dataActions.update("audience_questions", question.id, { status: "dismissed" })
    toast.success("Question dismissed", {
      description: truncate(question.question, 80),
      action: { label: "Undo", onClick: () => dataActions.update("audience_questions", question.id, { status: previous }) },
    })
  }

  function restore(question: AudienceQuestion) {
    const status: QuestionStatus = question.content_item_id ? "answered" : question.idea_id ? "idea_created" : "new"
    dataActions.update("audience_questions", question.id, { status })
    toast.success("Question restored", { description: truncate(question.question, 80) })
  }

  async function copyLink(question: AudienceQuestion) {
    const url = `${window.location.origin}/audience/questions?open=${question.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied", { description: url })
    } catch {
      toast.error("Couldn't copy the link", { description: url })
    }
  }

  async function remove(question: AudienceQuestion): Promise<boolean> {
    const linked = question.idea_id || question.content_item_id
    const ok = await confirm({
      title: "Delete this question?",
      description: `“${truncate(question.question || "Untitled question", 140)}” and its count (${formatNumber(
        question.frequency
      )}×) leave the Question Bank.${linked ? " The linked idea and content stay." : ""} This can't be undone.`,
      confirmLabel: "Delete question",
    })
    if (!ok) return false
    dataActions.remove("audience_questions", question.id)
    onDeleted?.(question.id)
    toast.success("Question deleted", { description: truncate(question.question, 80) })
    return true
  }

  return {
    open: onOpen,
    askedAgain,
    convertToIdea,
    markAnswered: onAnswer,
    answer,
    dismiss,
    restore,
    copyLink,
    remove,
    confirmDialog,
  }
}

export type QuestionActions = Omit<ReturnType<typeof useQuestionActions>, "confirmDialog">

/** "⋯" menu for one question. */
export function QuestionActionsMenu({
  question,
  actions,
  showOpen = true,
  className,
}: {
  question: AudienceQuestion
  actions: QuestionActions
  showOpen?: boolean
  className?: string
}) {
  const answered = question.status === "answered"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Actions for question: ${truncate(question.question || "Untitled question", 60)}`}
          className={cn("text-muted-foreground", className)}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {showOpen ? (
          <DropdownMenuItem onSelect={() => actions.open(question.id)}>
            <PanelRightOpen aria-hidden />
            Open details
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => actions.askedAgain(question)}>
          <Plus aria-hidden />
          Asked again (+1)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.convertToIdea(question)}>
          <Lightbulb aria-hidden />
          {question.idea_id ? "Open idea" : "Convert to idea"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.markAnswered(question)}>
          <CircleCheck aria-hidden />
          {answered ? "Change answer…" : "Mark answered…"}
        </DropdownMenuItem>
        {answered && question.content_item_id ? (
          <DropdownMenuItem asChild>
            <Link href={`/studio/${question.content_item_id}`}>
              <ExternalLink aria-hidden />
              Open answer
            </Link>
          </DropdownMenuItem>
        ) : null}
        {question.status === "dismissed" ? (
          <DropdownMenuItem onSelect={() => actions.restore(question)}>
            <RotateCcw aria-hidden />
            Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => actions.dismiss(question)}>
            <CircleMinus aria-hidden />
            Dismiss
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void actions.copyLink(question)}>
          <Link2 aria-hidden />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove(question)}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
