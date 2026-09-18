"use client"

import { createContext, useContext, useMemo } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { copyText } from "@/components/features/stories/clipboard"
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { ID, ResearchItem, ResearchStatus } from "@/lib/types"
import { canAnalyze, runReferenceAnalysis } from "./analysis-store"
import { researchMessages } from "./messages"
import { MIN_REFERENCE_CHARS, researchStatusLabel, type ResearchSheetTab } from "./research-model"

export interface ResearchActions {
  open: (id: ID | null, tab?: ResearchSheetTab) => void
  analyze: (item: ResearchItem) => void
  setStatus: (item: ResearchItem, status: ResearchStatus) => void
  copyLink: (item: ResearchItem) => void
  remove: (item: ResearchItem) => Promise<void>
}

const ResearchActionsContext = createContext<ResearchActions | null>(null)

export function useResearchActions(): ResearchActions {
  const actions = useContext(ResearchActionsContext)
  if (!actions) throw new Error("useResearchActions must be used inside <ResearchActionsProvider>")
  return actions
}

/** Reference actions shared by rows, cards, menus and the detail sheet (+ the delete confirmation). */
export function ResearchActionsProvider({
  onOpen,
  onRemoved,
  children,
}: {
  onOpen: (id: ID | null, tab?: ResearchSheetTab) => void
  onRemoved: (id: ID) => void
  children: React.ReactNode
}) {
  const t = useT(researchMessages)
  const [confirm, confirmDialog] = useConfirm()

  const actions = useMemo<ResearchActions>(
    () => ({
      open: onOpen,
      analyze(item) {
        if (!canAnalyze(item)) {
          toast.info(t("paste_first"), {
            description: t("paste_first_description", { min: MIN_REFERENCE_CHARS }),
          })
          onOpen(item.id, "details")
          return
        }
        void runReferenceAnalysis(item)
        onOpen(item.id, "analysis")
      },
      setStatus(item, status) {
        if (status === item.status) return
        const previous = item.status
        dataActions.update("research_items", item.id, { status })
        toast.success(status === "archived" ? t("archived_toast") : t("marked_as", { status: researchStatusLabel(status).toLowerCase() }), {
          description: item.title || undefined,
          action: { label: t("undo"), onClick: () => dataActions.update("research_items", item.id, { status: previous }) },
        })
      },
      copyLink(item) {
        void copyText(`${window.location.origin}/research?open=${item.id}`, t("link_copied"))
      },
      async remove(item) {
        const title = item.title.trim() || t("untitled")
        const cited = dataActions.getDb().content_ideas.filter((i) => i.source_ref_id === item.id).length
        const ok = await confirm({
          title: t("delete_title"),
          description:
            cited === 0
              ? t("delete_none", { title })
              : cited === 1
                ? t("delete_single", { title })
                : t("delete_many", { title, count: cited }),
        })
        if (!ok) return
        // Ideas keep their content but stop pointing at a reference that no longer exists.
        const linked = dataActions.getDb().content_ideas.filter((i) => i.source_ref_id === item.id)
        if (linked.length) dataActions.updateMany("content_ideas", linked.map((i) => ({ id: i.id, patch: { source_ref_id: null } })))
        dataActions.remove("research_items", item.id)
        onRemoved(item.id)
        toast.success(t("deleted"), { description: title })
      },
    }),
    [confirm, onOpen, onRemoved, t]
  )

  return (
    <ResearchActionsContext.Provider value={actions}>
      {children}
      {confirmDialog}
    </ResearchActionsContext.Provider>
  )
}
