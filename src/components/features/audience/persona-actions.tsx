"use client"

import { toast } from "sonner"
import { useConfirm } from "@/components/common"
import { translate, useT, type Translator, type UiLang } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { AudiencePersona, ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { duplicatePersonaValues, sortPersonas } from "./audience-model"
import { audienceMessages } from "./messages"
import { personaMessages } from "./persona-messages"

export const personaName = (persona: Pick<AudiencePersona, "name">, lang: UiLang = "en") =>
  persona.name.trim() || translate(audienceMessages, lang, "untitled_persona")

type PersonaT = Translator<(typeof personaMessages)["en"]>

/** "3 problems and 2 questions" — only the non-zero counts. */
function bankCounts(t: PersonaT, problems: number, questions: number): string {
  const parts = [
    problems > 0 && t.plural("problems_count", problems, { count: formatNumber(problems) }),
    questions > 0 && t.plural("questions_count", questions, { count: formatNumber(questions) }),
  ].filter((p): p is string => Boolean(p))
  return parts.length > 1 ? t("join_and", { first: parts[0], second: parts[1] }) : (parts[0] ?? "")
}

function DeleteDescription({ problems, questions, linked }: { problems: number; questions: number; linked: number }) {
  const t = useT(personaMessages)
  const bank = bankCounts(t, problems, questions)
  const where = problems && questions ? t("both_banks") : problems ? "Problem Bank" : "Question Bank"
  return (
    <span className="flex flex-col gap-2">
      {bank ? <span>{t("delete_bank", { bank, where })}</span> : null}
      {linked ? <span>{t.plural("delete_linked", linked, { count: formatNumber(linked) })}</span> : null}
      <span>{bank || linked ? t("delete_profile_gone") : t("delete_nothing_linked")}</span>
    </span>
  )
}

/**
 * Set primary, duplicate, copy link and delete (with confirmation) for personas.
 * Render `confirmDialog` once in the page.
 */
export function usePersonaActions({ onOpen, onDeleted }: { onOpen: (id: ID) => void; onDeleted?: (id: ID) => void }) {
  const [confirm, confirmDialog] = useConfirm()
  const t = useT(personaMessages)
  const a = useT(audienceMessages)
  const nameOf = (persona: Pick<AudiencePersona, "name">) => persona.name.trim() || a("untitled_persona")

  function setPrimary(persona: AudiencePersona) {
    const updates = dataActions
      .getDb()
      .audience_personas.filter((p) => (p.id === persona.id ? !p.is_primary : p.is_primary))
      .map((p) => ({ id: p.id, patch: { is_primary: p.id === persona.id } }))
    if (!updates.length) return
    dataActions.updateMany("audience_personas", updates)
    toast.success(t("now_primary", { name: nameOf(persona) }), {
      description: t("now_primary_description"),
    })
  }

  function duplicate(persona: AudiencePersona) {
    const row = dataActions.insert("audience_personas", duplicatePersonaValues(persona, dataActions.getDb().audience_personas))
    toast.success(t("duplicated"), {
      description: row.name,
      action: { label: a("open"), onClick: () => onOpen(row.id) },
    })
    return row
  }

  async function copyLink(persona: AudiencePersona) {
    const url = `${window.location.origin}/audience?open=${persona.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(a("link_copied"), { description: url })
    } catch {
      toast.error(a("copy_failed"), { description: url })
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
      title: t("delete_title", { name: nameOf(persona) }),
      description: <DeleteDescription problems={problems} questions={questions} linked={linked} />,
      confirmLabel: t("delete_confirm"),
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
      problems + questions ? t("now_unassigned", { counts: bankCounts(t, problems, questions) }) : "",
      promoted ? t("now_primary", { name: nameOf(promoted) }) : "",
    ].filter(Boolean)
    toast.success(t("deleted"), { description: details.join(" · ") || nameOf(persona) })
    return true
  }

  return { setPrimary, duplicate, copyLink, remove, confirmDialog }
}

export type PersonaActions = Omit<ReturnType<typeof usePersonaActions>, "confirmDialog">
