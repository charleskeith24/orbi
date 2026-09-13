"use client"

import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { dataActions } from "@/lib/store"
import type { AudiencePersona, ID } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { duplicatePersonaValues, sortPersonas } from "./audience-model"

export const personaName = (persona: Pick<AudiencePersona, "name">) => persona.name.trim() || "Untitled persona"

function joinCounts(parts: (string | false)[]): string {
  const list = parts.filter((p): p is string => Boolean(p))
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : (list[0] ?? "")
}

function DeleteDescription({ problems, questions, linked }: { problems: number; questions: number; linked: number }) {
  const bank = joinCounts([problems > 0 && pluralize(problems, "problem"), questions > 0 && pluralize(questions, "question")])
  return (
    <span className="flex flex-col gap-2">
      {bank ? (
        <span>
          Its {bank} stay in the {problems && questions ? "Problem Bank and Question Bank" : problems ? "Problem Bank" : "Question Bank"}{" "}
          as unassigned — nothing in the banks is deleted.
        </span>
      ) : null}
      {linked ? (
        <span>
          {pluralize(linked, "idea or content piece", "ideas and content pieces")} keep everything except this target persona.
        </span>
      ) : null}
      <span>{bank || linked ? "The persona profile itself can't be restored." : "Nothing else is linked to this persona. This can't be undone."}</span>
    </span>
  )
}

/**
 * Set primary, duplicate, copy link and delete (with confirmation) for personas.
 * Render `confirmDialog` once in the page.
 */
export function usePersonaActions({ onOpen, onDeleted }: { onOpen: (id: ID) => void; onDeleted?: (id: ID) => void }) {
  const [confirm, confirmDialog] = useConfirm()

  function setPrimary(persona: AudiencePersona) {
    const updates = dataActions
      .getDb()
      .audience_personas.filter((p) => (p.id === persona.id ? !p.is_primary : p.is_primary))
      .map((p) => ({ id: p.id, patch: { is_primary: p.id === persona.id } }))
    if (!updates.length) return
    dataActions.updateMany("audience_personas", updates)
    toast.success(`${personaName(persona)} is now your primary persona`, {
      description: "Ideas and AI drafts aim at this persona first.",
    })
  }

  function duplicate(persona: AudiencePersona) {
    const row = dataActions.insert("audience_personas", duplicatePersonaValues(persona, dataActions.getDb().audience_personas))
    toast.success("Persona duplicated", {
      description: row.name,
      action: { label: "Open", onClick: () => onOpen(row.id) },
    })
    return row
  }

  async function copyLink(persona: AudiencePersona) {
    const url = `${window.location.origin}/audience?open=${persona.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied", { description: url })
    } catch {
      toast.error("Couldn't copy the link", { description: url })
    }
  }

  async function remove(persona: AudiencePersona): Promise<boolean> {
    const db = dataActions.getDb()
    const problems = db.audience_problems.filter((p) => p.persona_id === persona.id).length
    const questions = db.audience_questions.filter((q) => q.persona_id === persona.id).length
    const linked =
      db.content_ideas.filter((i) => i.persona_id === persona.id).length +
      db.content_items.filter((i) => i.persona_id === persona.id).length
    const ok = await confirm({
      title: `Delete “${personaName(persona)}”?`,
      description: <DeleteDescription problems={problems} questions={questions} linked={linked} />,
      confirmLabel: "Delete persona",
    })
    if (!ok) return false

    // The store applies SET NULL to problems, questions, ideas, items and campaigns.
    dataActions.remove("audience_personas", persona.id)
    let promoted: AudiencePersona | undefined
    if (persona.is_primary) {
      promoted = sortPersonas(dataActions.getDb().audience_personas)[0]
      if (promoted) dataActions.update("audience_personas", promoted.id, { is_primary: true })
    }
    onDeleted?.(persona.id)
    const details = [
      problems + questions ? `${joinCounts([problems > 0 && pluralize(problems, "problem"), questions > 0 && pluralize(questions, "question")])} now unassigned` : "",
      promoted ? `${personaName(promoted)} is now your primary persona` : "",
    ].filter(Boolean)
    toast.success("Persona deleted", { description: details.join(" · ") || personaName(persona) })
    return true
  }

  return { setPrimary, duplicate, copyLink, remove, confirmDialog }
}

export type PersonaActions = Omit<ReturnType<typeof usePersonaActions>, "confirmDialog">
