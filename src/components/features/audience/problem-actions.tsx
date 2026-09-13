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
import { createIdea, dataActions } from "@/lib/store"
import type { AudienceProblem, ContentIdea, ID } from "@/lib/types"
import { cn, pluralize, truncate } from "@/lib/utils"
import { generatorHref, problemIdeaValues } from "./audience-model"

/**
 * Create idea, generate ideas, copy link and delete (with confirmation) for Problem Bank rows.
 * Render `confirmDialog` once in the page.
 */
export function useProblemActions({ onOpen, onDeleted }: { onOpen: (id: ID) => void; onDeleted?: (id: ID) => void }) {
  const router = useRouter()
  const [confirm, confirmDialog] = useConfirm()

  function createIdeaFrom(problem: AudienceProblem): ContentIdea {
    const persona = problem.persona_id
      ? dataActions.getDb().audience_personas.find((p) => p.id === problem.persona_id)
      : undefined
    const idea = createIdea(problemIdeaValues(problem, persona))
    toast.success("Idea added to the Idea Bank", {
      description: idea.title,
      action: { label: "Open idea", onClick: () => router.push(`/ideas?open=${idea.id}`) },
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
      toast.success("Link copied", { description: url })
    } catch {
      toast.error("Couldn't copy the link", { description: url })
    }
  }

  async function remove(problem: AudienceProblem): Promise<boolean> {
    const db = dataActions.getDb()
    const ideas = db.content_ideas.filter((i) => i.problem_id === problem.id).length
    const items = db.content_items.filter((i) => i.problem_id === problem.id).length
    const linked = [ideas > 0 && pluralize(ideas, "idea"), items > 0 && pluralize(items, "content piece")].filter(Boolean).join(" and ")
    const ok = await confirm({
      title: "Delete this problem?",
      description: `“${truncate(problem.problem || "Untitled problem", 140)}” leaves the Problem Bank.${
        linked ? ` The ${linked} made from it stay — only the link to this problem is removed.` : ""
      } This can't be undone.`,
      confirmLabel: "Delete problem",
    })
    if (!ok) return false
    dataActions.remove("audience_problems", problem.id)
    onDeleted?.(problem.id)
    toast.success("Problem deleted", { description: truncate(problem.problem, 80) })
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Actions for problem: ${truncate(problem.problem || "Untitled problem", 60)}`}
          className={cn("text-muted-foreground", className)}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {showOpen ? (
          <DropdownMenuItem onSelect={() => actions.open(problem.id)}>
            <PanelRightOpen aria-hidden />
            Open details
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => actions.createIdea(problem)}>
          <Lightbulb aria-hidden />
          Create idea
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.generateIdeas(problem)}>
          <Sparkles aria-hidden />
          Generate ideas
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.copyLink(problem)}>
          <Link2 aria-hidden />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void actions.remove(problem)}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
