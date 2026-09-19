"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, CopyButton, ProviderBadge } from "@/components/common"
import { Textarea } from "@/components/ui/textarea"
import { useAiTask } from "@/lib/ai"
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { AiProviderId, Collab } from "@/lib/types"
import { AiErrorNotice } from "./collab-ui"
import { collabPitchMessages } from "./messages"

const clip = (text: string, max: number) => text.trim().slice(0, max)

/**
 * Outreach message: an editable DM saved on blur, "Write my pitch" (collab_pitch, in Brand HQ's writing
 * language) and Copy. The current draft stays visible while a new one is written; Undo brings it back.
 */
export function CollabPitch({ collab }: { collab: Collab }) {
  const t = useT(collabPitchMessages)
  const ai = useAiTask("collab_pitch")
  const [draft, setDraft] = useState(collab.outreach_message)
  const [engine, setEngine] = useState<{ provider: AiProviderId; model: string } | null>(null)

  function save(message: string) {
    if (message !== collab.outreach_message) dataActions.update("collabs", collab.id, { outreach_message: message })
  }

  async function write() {
    const previous = draft.trim()
    const result = await ai.run(
      {
        type: collab.type,
        title: clip(collab.title, 200),
        partner_name: clip(collab.partner_name, 120),
        partner_handle: clip(collab.partner_handle, 120),
        partner_platform: collab.partner_platform,
        partner_niche: clip(collab.partner_niche, 160),
        partner_followers: collab.partner_followers,
        collab_date: collab.collab_date,
        notes: clip(collab.notes, 1000),
        previous: clip(previous, 2000),
      },
      { entityType: "collabs", entityId: collab.id }
    )
    if (!result) return
    const message = result.output.message
    setDraft(message)
    save(message)
    setEngine({ provider: result.provider, model: result.model })
    toast.success(previous ? t("rewritten") : t("written"), {
      description: t("written_description"),
      action: previous
        ? {
            label: t("undo"),
            onClick: () => {
              setDraft(previous)
              dataActions.update("collabs", collab.id, { outreach_message: previous })
            },
          }
        : undefined,
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-2" aria-busy={ai.isPending || undefined}>
      <Textarea
        value={draft}
        rows={6}
        className="min-h-28 text-sm"
        readOnly={ai.isPending}
        placeholder={t("placeholder")}
        aria-label={t("label")}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => save(draft)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <AiButton size="sm" pending={ai.isPending} pendingLabel={t("writing")} onClick={write}>
          {draft.trim() ? t("rewrite") : t("write")}
        </AiButton>
        <CopyButton text={draft} label={t("copy")} variant="outline" size="sm" disabled={!draft.trim()} successMessage={t("copied")} />
        {engine ? <ProviderBadge provider={engine.provider} model={engine.model} /> : null}
      </div>
      <AiErrorNotice error={ai.error} onRetry={write} pending={ai.isPending} />
      <AiNotice>{t("notice")}</AiNotice>
    </div>
  )
}
