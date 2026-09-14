"use client"

import { ExternalLink } from "lucide-react"
import { useId } from "react"
import { FormField } from "@/components/common"
import { AutosaveInput, AutosaveTextarea } from "@/components/features/stories/autosave-field"
import { Button } from "@/components/ui/button"
import { dataActions } from "@/lib/store"
import type { ResearchItem, UpdateRow } from "@/lib/types"
import { isHttpUrl } from "./research-model"

/** The reference's §36 fields, each saved on blur. */
export function ResearchFields({ item }: { item: ResearchItem }) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const set = (patch: UpdateRow<"research_items">) => dataActions.update("research_items", item.id, patch)
  const url = item.url.trim()
  const urlError = url && !isHttpUrl(url) ? "That doesn't look like a web address — start it with https://" : undefined

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <FormField label="Source" htmlFor={field("source")}>
          <AutosaveInput id={field("source")} value={item.source} maxLength={120} placeholder="e.g. LinkedIn, a newsletter" onCommit={(source) => set({ source })} />
        </FormField>
        <FormField label="Creator" htmlFor={field("creator")}>
          <AutosaveInput
            id={field("creator")}
            value={item.creator}
            maxLength={120}
            placeholder="e.g. SaaS founder, ~90k followers"
            onCommit={(creator) => set({ creator })}
          />
        </FormField>
      </div>
      <FormField label="URL" htmlFor={field("url")} error={urlError}>
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
              <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open the source in a new tab" title="Open the source">
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
      </FormField>
      <FormField label="Topic" htmlFor={field("topic")}>
        <AutosaveInput id={field("topic")} value={item.topic} maxLength={200} placeholder="What it's about" onCommit={(topic) => set({ topic })} />
      </FormField>
      <FormField label="Hook" htmlFor={field("hook")} description="The opening line or visual, described in a few words.">
        <AutosaveTextarea id={field("hook")} rows={2} className="min-h-14" value={item.hook} onCommit={(hook) => set({ hook })} />
      </FormField>
      <FormField label="Why it caught attention" htmlFor={field("why")}>
        <AutosaveTextarea id={field("why")} rows={2} className="min-h-14" value={item.why_attention} onCommit={(why_attention) => set({ why_attention })} />
      </FormField>
      <FormField label="What can be learned" htmlFor={field("learnings")}>
        <AutosaveTextarea id={field("learnings")} rows={2} className="min-h-14" value={item.learnings} onCommit={(learnings) => set({ learnings })} />
      </FormField>
      <FormField label="Potential adaptation" htmlFor={field("adaptation")} description="How you could use the structure with your own story or data.">
        <AutosaveTextarea id={field("adaptation")} rows={2} className="min-h-14" value={item.adaptation} onCommit={(adaptation) => set({ adaptation })} />
      </FormField>
      <FormField
        label="Pasted content"
        htmlFor={field("content")}
        description="The reference text, a transcript or your notes. Used for analysis only — never republished."
      >
        <AutosaveTextarea id={field("content")} rows={6} className="min-h-32" maxLength={15000} value={item.content} onCommit={(content) => set({ content })} />
      </FormField>
    </div>
  )
}
