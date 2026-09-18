"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { useTable } from "@/lib/store"
import { formatNumber } from "@/lib/utils"
import { createContentFromAngle, saveAngleAsIdea, type AngleDraft, type AngleOrigin } from "./angle-model"
import { updateAngleDraft, useAngleSession } from "./angle-store"
import { angleMessages } from "./experience-messages"

/** Save angles as ideas (one or many) or turn one into content and open it in the Content Studio. */
export function useAngleActions(sessionKey: string, origin: AngleOrigin) {
  const router = useRouter()
  const formats = useTable("content_formats")
  const provider = useAngleSession(sessionKey).provider
  const t = useT(angleMessages)
  const c = useT(commonMessages)

  function save(draft: AngleDraft) {
    const idea = saveAngleAsIdea(draft, origin, formats)
    updateAngleDraft(sessionKey, draft.key, { ideaId: idea.id })
    toast.success(t("saved_to_bank"), {
      description: idea.title,
      action: { label: c("open"), onClick: () => router.push(`/ideas?open=${idea.id}`) },
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
    toast.success(t.plural("saved_many", ideas.length, { count: formatNumber(ideas.length) }), {
      description: from ? t("from", { title: from }) : undefined,
      action: { label: t("open_bank"), onClick: () => router.push("/ideas") },
    })
  }

  function create(draft: AngleDraft) {
    try {
      const { idea, item } = createContentFromAngle(draft, origin, formats, draft.edited ? "manual" : (provider ?? "offline"))
      updateAngleDraft(sessionKey, draft.key, { ideaId: idea.id, itemId: item.id })
      toast.success(t("content_created"), { description: t("created_description", { title: item.title }) })
      router.push(`/studio/${item.id}`)
    } catch (error) {
      toast.error(t("create_failed"), { description: error instanceof Error ? error.message : String(error) })
    }
  }

  return { save, saveMany, create }
}
