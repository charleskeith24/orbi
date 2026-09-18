"use client"

import { ExternalLink } from "lucide-react"
import { useId } from "react"
import { FormField } from "@/components/common"
import { AutosaveInput, AutosaveTextarea } from "@/components/features/stories/autosave-field"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { ResearchItem, UpdateRow } from "@/lib/types"
import { researchMessages } from "./messages"
import { isHttpUrl } from "./research-model"

/** The reference's §36 fields, each saved on blur. */
export function ResearchFields({ item }: { item: ResearchItem }) {
  const t = useT(researchMessages)
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const set = (patch: UpdateRow<"research_items">) => dataActions.update("research_items", item.id, patch)
  const url = item.url.trim()
  const urlError = url && !isHttpUrl(url) ? t("url_error") : undefined

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <FormField label={t("source")} htmlFor={field("source")}>
          <AutosaveInput id={field("source")} value={item.source} maxLength={120} placeholder={t("source_placeholder_long")} onCommit={(source) => set({ source })} />
        </FormField>
        <FormField label={t("creator")} htmlFor={field("creator")}>
          <AutosaveInput
            id={field("creator")}
            value={item.creator}
            maxLength={120}
            placeholder={t("creator_placeholder")}
            onCommit={(creator) => set({ creator })}
          />
        </FormField>
      </div>
      <FormField label={t("url")} htmlFor={field("url")} error={urlError}>
        <div className="flex min-w-0 items-center gap-1.5">
          <AutosaveInput
            id={field("url")}
            type="url"
            inputMode="url"
            value={item.url}
            maxLength={2000}
            placeholder="https://…"
            aria-invalid={Boolean(urlError) || undefined}
            onCommit={(next) => set({ url: next })}
          />
          {url && !urlError ? (
            <Button type="button" variant="outline" size="icon" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer" aria-label={t("open_source_aria")} title={t("open_source_title")}>
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
      </FormField>
      <FormField label={t("topic")} htmlFor={field("topic")}>
        <AutosaveInput id={field("topic")} value={item.topic} maxLength={200} placeholder={t("topic_placeholder")} onCommit={(topic) => set({ topic })} />
      </FormField>
      <FormField label={t("hook")} htmlFor={field("hook")} description={t("hook_description")}>
        <AutosaveTextarea id={field("hook")} rows={2} className="min-h-14" value={item.hook} onCommit={(hook) => set({ hook })} />
      </FormField>
      <FormField label={t("why_attention")} htmlFor={field("why")}>
        <AutosaveTextarea id={field("why")} rows={2} className="min-h-14" value={item.why_attention} onCommit={(why_attention) => set({ why_attention })} />
      </FormField>
      <FormField label={t("learnings")} htmlFor={field("learnings")}>
        <AutosaveTextarea id={field("learnings")} rows={2} className="min-h-14" value={item.learnings} onCommit={(learnings) => set({ learnings })} />
      </FormField>
      <FormField label={t("adaptation")} htmlFor={field("adaptation")} description={t("adaptation_description")}>
        <AutosaveTextarea id={field("adaptation")} rows={2} className="min-h-14" value={item.adaptation} onCommit={(adaptation) => set({ adaptation })} />
      </FormField>
      <FormField
        label={t("pasted_content")}
        htmlFor={field("content")}
        description={t("content_description")}
      >
        <AutosaveTextarea id={field("content")} rows={6} className="min-h-32" maxLength={15000} value={item.content} onCommit={(content) => set({ content })} />
      </FormField>
    </div>
  )
}
