"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTable } from "@/lib/store"
import { pluralize } from "@/lib/utils"
import { createContentFromAngle, saveAngleAsIdea, type AngleDraft, type AngleOrigin } from "./angle-model"
import { updateAngleDraft, useAngleSession } from "./angle-store"

/** Save angles as ideas (one or many) or turn one into content and open it in the Content Studio. */
export function useAngleActions(sessionKey: string, origin: AngleOrigin) {
  const router = useRouter()
  const formats = useTable("content_formats")
  const provider = useAngleSession(sessionKey).provider

  function save(draft: AngleDraft) {
    const idea = saveAngleAsIdea(draft, origin, formats)
    updateAngleDraft(sessionKey, draft.key, { ideaId: idea.id })
    toast.success("Saved to your Idea Bank", {
      description: idea.title,
      action: { label: "Open", onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
  }

  function saveMany(drafts: AngleDraft[]) {
    const ideas = drafts.map((draft) => {
      const idea = saveAngleAsIdea(draft, origin, formats)
      updateAngleDraft(sessionKey, draft.key, { ideaId: idea.id })
      return idea
    })
    if (!ideas.length) return
    const from = origin.storyTitle.trim()
    toast.success(`${pluralize(ideas.length, "idea")} saved to your Idea Bank`, {
      description: from ? `From “${from}”` : undefined,
      action: { label: "Open Idea Bank", onClick: () => router.push("/ideas") },
    })
  }

  function create(draft: AngleDraft) {
    try {
      const { idea, item } = createContentFromAngle(draft, origin, formats, draft.edited ? "manual" : (provider ?? "offline"))
      updateAngleDraft(sessionKey, draft.key, { ideaId: idea.id, itemId: item.id })
      toast.success("Content created", { description: `${item.title} — opening the Content Studio` })
      router.push(`/studio/${item.id}`)
    } catch (error) {
      toast.error("Couldn't create the content", { description: error instanceof Error ? error.message : String(error) })
    }
  }

  return { save, saveMany, create }
}
