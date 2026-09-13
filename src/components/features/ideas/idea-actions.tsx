"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { IDEA_STATUS_MAP, PRIORITY_MAP } from "@/lib/constants"
import { createIdea, dataActions, getEntityTagIds, setEntityTags, useRow } from "@/lib/store"
import type { ContentIdea, ID, IdeaStatus, Priority, UpdateRow } from "@/lib/types"
import { pluralize, truncate } from "@/lib/utils"
import { IdeaConvertDialog } from "./idea-convert-dialog"
import { duplicateIdeaValues, restoreStatus } from "./idea-model"

export interface IdeaActions {
  /** Open the detail sheet. */
  open(id: ID): void
  /** Start the convert-to-content flow (platforms + due date). */
  convert(id: ID): void
  /** `converted` starts the convert flow for ideas without content; `archived` archives. */
  setStatus(ids: ID[], status: IdeaStatus, options?: { quiet?: boolean }): void
  setPriority(ids: ID[], priority: Priority): void
  setPillar(ids: ID[], pillarId: ID | null): void
  archive(ids: ID[], options?: { quiet?: boolean }): void
  restore(ids: ID[]): void
  duplicate(id: ID): void
  /** Asks for confirmation; resolves true when the ideas were deleted. */
  remove(ids: ID[]): Promise<boolean>
}

const IdeaActionsContext = createContext<IdeaActions | null>(null)

export function useIdeaActions(): IdeaActions {
  const value = useContext(IdeaActionsContext)
  if (!value) throw new Error("useIdeaActions must be used inside <IdeaActionsProvider>")
  return value
}

function ideasByIds(ids: ID[]): ContentIdea[] {
  const set = new Set(ids)
  return dataActions.getDb().content_ideas.filter((i) => set.has(i.id))
}

const subject = (ideas: ContentIdea[]) =>
  ideas.length === 1 ? `“${truncate(ideas[0].title || "Untitled idea", 60)}”` : pluralize(ideas.length, "idea")

type UndoField = "status" | "priority" | "pillar_id"

/** Sets one field on each idea that differs and offers an Undo restoring exactly those values. */
function updateField<K extends UndoField>(
  ideas: ContentIdea[],
  field: K,
  valueFor: (idea: ContentIdea) => ContentIdea[K],
  message: (changed: ContentIdea[]) => string,
  quiet = false
) {
  const changes = ideas.map((idea) => ({ idea, value: valueFor(idea) })).filter(({ idea, value }) => idea[field] !== value)
  if (!changes.length) return
  dataActions.updateMany(
    "content_ideas",
    changes.map(({ idea, value }) => ({ id: idea.id, patch: { [field]: value } as UpdateRow<"content_ideas"> }))
  )
  if (quiet) return
  const previous = changes.map(({ idea }) => ({ id: idea.id, patch: { [field]: idea[field] } as UpdateRow<"content_ideas"> }))
  toast.success(message(changes.map((c) => c.idea)), {
    action: { label: "Undo", onClick: () => dataActions.updateMany("content_ideas", previous) },
  })
}

/**
 * Idea mutations shared by the table, cards, Kanban, bulk bar and detail sheet. Owns the delete
 * confirmation and the convert dialog so every entry point behaves the same.
 */
export function IdeaActionsProvider({
  openId,
  onOpen,
  children,
}: {
  openId: ID | null
  onOpen: (id: ID | null) => void
  children: React.ReactNode
}) {
  const [confirm, confirmDialog] = useConfirm()
  const [convertId, setConvertId] = useState<ID | null>(null)
  // Keep the last idea mounted while the dialog animates out.
  const [shownConvertId, setShownConvertId] = useState<ID | null>(null)
  if (convertId && convertId !== shownConvertId) setShownConvertId(convertId)
  const convertIdea = useRow("content_ideas", shownConvertId)

  const open = useCallback((id: ID) => onOpen(id), [onOpen])
  const convert = useCallback((id: ID) => setConvertId(id), [])

  const archive = useCallback((ids: ID[], options: { quiet?: boolean } = {}) => {
    updateField(ideasByIds(ids), "status", () => "archived", (changed) => `Archived ${subject(changed)}`, options.quiet)
  }, [])

  const restore = useCallback((ids: ID[]) => {
    const ideas = ideasByIds(ids).filter((i) => i.status === "archived")
    updateField(ideas, "status", restoreStatus, (changed) =>
      changed.length === 1 ? `Restored to ${IDEA_STATUS_MAP[restoreStatus(changed[0])].label}` : `Restored ${subject(changed)}`
    )
  }, [])

  const setStatus = useCallback(
    (ids: ID[], status: IdeaStatus, options: { quiet?: boolean } = {}) => {
      if (status === "archived") {
        archive(ids, options)
        return
      }
      const ideas = ideasByIds(ids)
      if (status === "converted") {
        const withoutContent = ideas.filter((i) => !i.converted_item_id)
        if (ideas.length === 1 && withoutContent.length === 1) {
          setConvertId(withoutContent[0].id)
          return
        }
        const withContent = ideas.filter((i) => i.converted_item_id)
        updateField(withContent, "status", () => "converted", (changed) => `Moved ${subject(changed)} to Converted to Content`, options.quiet)
        return
      }
      updateField(ideas, "status", () => status, (changed) => `Moved ${subject(changed)} to ${IDEA_STATUS_MAP[status].label}`, options.quiet)
    },
    [archive]
  )

  const setPriority = useCallback((ids: ID[], priority: Priority) => {
    updateField(ideasByIds(ids), "priority", () => priority, (changed) => `${PRIORITY_MAP[priority].label} priority · ${subject(changed)}`)
  }, [])

  const setPillar = useCallback((ids: ID[], pillarId: ID | null) => {
    const pillar = pillarId ? dataActions.getDb().content_pillars.find((p) => p.id === pillarId) : null
    updateField(ideasByIds(ids), "pillar_id", () => pillarId, (changed) =>
      pillar ? `Moved ${subject(changed)} to ${pillar.name || "the pillar"}` : `Removed the pillar from ${subject(changed)}`
    )
  }, [])

  const duplicate = useCallback(
    (id: ID) => {
      const db = dataActions.getDb()
      const source = db.content_ideas.find((i) => i.id === id)
      if (!source) return
      const copy = createIdea(duplicateIdeaValues(source))
      const tagIds = getEntityTagIds(db, "content_ideas", id)
      if (tagIds.length) setEntityTags("content_ideas", copy.id, tagIds)
      onOpen(copy.id)
      toast.success("Idea duplicated", { description: copy.title })
    },
    [onOpen]
  )

  const remove = useCallback(
    async (ids: ID[]) => {
      const ideas = ideasByIds(ids)
      if (!ideas.length) return false
      const set = new Set(ideas.map((i) => i.id))
      const linked = dataActions.getDb().content_items.filter((item) => item.idea_id && set.has(item.idea_id)).length
      const one = ideas.length === 1
      const ok = await confirm({
        title: one ? "Delete this idea?" : `Delete ${pluralize(ideas.length, "idea")}?`,
        description: `${one ? `${subject(ideas)} is` : "They're"} removed from the Idea Bank permanently.${
          linked ? ` The ${pluralize(linked, "content piece")} made from ${one ? "it" : "them"} stay in the pipeline.` : ""
        }`,
        confirmLabel: one ? "Delete idea" : `Delete ${pluralize(ideas.length, "idea")}`,
      })
      if (!ok) return false
      if (openId && set.has(openId)) onOpen(null)
      dataActions.remove("content_ideas", [...set])
      toast.success(one ? "Idea deleted" : `${pluralize(ideas.length, "idea")} deleted`)
      return true
    },
    [confirm, openId, onOpen]
  )

  const value = useMemo<IdeaActions>(
    () => ({ open, convert, setStatus, setPriority, setPillar, archive, restore, duplicate, remove }),
    [open, convert, setStatus, setPriority, setPillar, archive, restore, duplicate, remove]
  )

  return (
    <IdeaActionsContext value={value}>
      {children}
      {confirmDialog}
      <IdeaConvertDialog
        idea={convertIdea ?? null}
        open={Boolean(convertId && convertIdea)}
        onOpenChange={(next) => {
          if (!next) setConvertId(null)
        }}
      />
    </IdeaActionsContext>
  )
}
