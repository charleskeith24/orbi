"use client"

import { Ellipsis, Lightbulb, Link2, PanelRightOpen, Sparkles, Trash2 } from "lucide-react"
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
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { createIdea, dataActions } from "@/lib/store"
import type { AudienceProblem, ContentIdea, ID } from "@/lib/types"
import { cn, formatNumber, truncate } from "@/lib/utils"
import { generatorHref, problemIdeaValues } from "./audience-model"
import { audienceMessages } from "./messages"
import { problemMessages } from "./problem-messages"

/**
 * Create idea, generate ideas, copy link and delete (with confirmation) for Problem Bank rows.
 * Render `confirmDialog` once in the page.
 */
export function useProblemActions({ onOpen, onDeleted }: { onOpen: (id: ID) => void; onDeleted?: (id: ID) => void }) {
  const router = useRouter()
  const [confirm, confirmDialog] = useConfirm()
  const t = useT(problemMessages)
  const a = useT(audienceMessages)

  function createIdeaFrom(problem: AudienceProblem): ContentIdea {
    const persona = problem.persona_id
      ? dataActions.getDb().audience_personas.find((p) => p.id === problem.persona_id)
      : undefined
    const idea = createIdea(problemIdeaValues(problem, persona))
    toast.success(a("idea_added"), {
      description: idea.title,
      action: { label: a("open_idea"), onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
    return idea
  }

  function generateIdeas(problem: AudienceProblem) {
    router.push(generatorHref(problem))
  }

  async function copyLink(problem: AudienceProblem) {
    const url = `${window.location.origin}/audience/problems?open=${problem.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(a("link_copied"), { description: url })
    } catch {
      toast.error(a("copy_failed"), { description: url })
    }
  }

  async function remove(problem: AudienceProblem): Promise<boolean> {
    const db = dataActions.getDb()
    const ideas = db.content_ideas.filter((i) => i.problem_id === problem.id).length
    const items = db.content_items.filter((i) => i.problem_id === problem.id).length
    const parts = [
      ideas > 0 && t.plural("ideas_count", ideas, { count: formatNumber(ideas) }),
      items > 0 && t.plural("content_pieces", items, { count: formatNumber(items) }),
    ].filter((part): part is string => Boolean(part))
    const linked = parts.length > 1 ? t("join_and", { first: parts[0], second: parts[1] }) : (parts[0] ?? "")
    const text = truncate(problem.problem || t("untitled"), 140)
    const ok = await confirm({
      title: t("delete_title"),
      description: linked ? t("delete_description_linked", { text, linked }) : t("delete_description", { text }),
      confirmLabel: t("delete_confirm"),
    })
    if (!ok) return false
    dataActions.remove("audience_problems", problem.id)
    onDeleted?.(problem.id)
    toast.success(t("deleted"), { description: truncate(problem.problem, 80) })
    return true
  }

  return { open: onOpen, createIdea: createIdeaFrom, generateIdeas, copyLink, remove, confirmDialog }
}

export type ProblemActions = Omit<ReturnType<typeof useProblemActions>, "confirmDialog">

/** "⋯" menu for one problem. */
export function ProblemActionsMenu({
  problem,
  actions,
  showOpen = true,
  className,
}: {
  problem: AudienceProblem
  actions: ProblemActions
  showOpen?: boolean
  className?: string
}) {
  const t = useT(problemMessages)
  const a = useT(audienceMessages)
  const c = useT(commonMessages)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("actions_for", { text: truncate(problem.problem || t("untitled"), 60) })}
          className={cn("text-muted-foreground", className)}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {showOpen ? (
          <DropdownMenuItem onSelect={() => actions.open(problem.id)}>
            <PanelRightOpen aria-hidden />
            {a("open_details")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => actions.createIdea(problem)}>
          <Lightbulb aria-hidden />
          {a("create_idea")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.generateIdeas(problem)}>
          <Sparkles aria-hidden />
          {a("generate_ideas")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.copyLink(problem)}>
          <Link2 aria-hidden />
          {a("copy_link")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove(problem)}>
          <Trash2 aria-hidden />
          {c("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
