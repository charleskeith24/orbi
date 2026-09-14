"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { FormField, FormRow, OptionSelect, PillarSelect, PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { dataActions } from "@/lib/store"
import type { ID, PlatformId, ResearchItem, ResearchType } from "@/lib/types"
import { RESEARCH_TYPE_OPTIONS } from "./research-badges"
import { isHttpUrl } from "./research-model"

/** "Add reference": save something that caught your attention; analyze it from the detail sheet. */
export function ResearchCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (item: ResearchItem) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <ReferenceForm
          onCancel={() => onOpenChange(false)}
          onCreated={(item) => {
            onOpenChange(false)
            onCreated(item)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

interface FormValues {
  title: string
  type: ResearchType
  platform: PlatformId | null
  url: string
  source: string
  creator: string
  topic: string
  pillarId: ID | null
  content: string
  why: string
}

function ReferenceForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (item: ResearchItem) => void }) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const [values, setValues] = useState<FormValues>({
    title: "",
    type: "post",
    platform: null,
    url: "",
    source: "",
    creator: "",
    topic: "",
    pillarId: null,
    content: "",
    why: "",
  })
  const [touched, setTouched] = useState<{ title?: boolean; url?: boolean }>({})
  const errors = {
    title: values.title.trim() ? undefined : "Give the reference a title.",
    url: values.url.trim() && !isHttpUrl(values.url) ? "Use a full web address, starting with https://" : undefined,
  }
  const valid = !errors.title && !errors.url
  const set = (patch: Partial<FormValues>) => setValues((current) => ({ ...current, ...patch }))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ title: true, url: true })
    if (!valid) return
    const item = dataActions.insert("research_items", {
      title: values.title.replace(/\s+/g, " ").trim(),
      type: values.type,
      platform: values.platform,
      url: values.url.trim(),
      source: values.source.trim(),
      creator: values.creator.trim(),
      topic: values.topic.trim(),
      pillar_id: values.pillarId,
      content: values.content.trim(),
      why_attention: values.why.trim(),
      status: "saved",
    })
    toast.success("Reference saved to your library", { description: item.title })
    onCreated(item)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>Add reference</DialogTitle>
        <DialogDescription className="text-xs">Save something that caught your attention, then analyze why it works.</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label="Title" htmlFor={field("title")} required error={touched.title ? errors.title : undefined}>
            <Input
              id={field("title")}
              value={values.title}
              autoFocus
              maxLength={300}
              placeholder="e.g. 'I stopped doing performance reviews' post"
              aria-invalid={(touched.title && Boolean(errors.title)) || undefined}
              onChange={(event) => set({ title: event.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            />
          </FormField>
          <FormRow>
            <FormField label="Type" htmlFor={field("type")}>
              <OptionSelect
                id={field("type")}
                options={RESEARCH_TYPE_OPTIONS}
                value={values.type}
                onChange={(type) => {
                  if (type) set({ type })
                }}
              />
            </FormField>
            <FormField label="Platform" htmlFor={field("platform")}>
              <PlatformSelect id={field("platform")} allowNone value={values.platform} onChange={(platform) => set({ platform })} />
            </FormField>
          </FormRow>
          <FormField label="URL" htmlFor={field("url")} error={touched.url ? errors.url : undefined}>
            <Input
              id={field("url")}
              type="url"
              inputMode="url"
              value={values.url}
              maxLength={2000}
              placeholder="https://…"
              aria-invalid={(touched.url && Boolean(errors.url)) || undefined}
              onChange={(event) => set({ url: event.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, url: true }))}
            />
          </FormField>
          <FormRow>
            <FormField label="Source" htmlFor={field("source")}>
              <Input id={field("source")} value={values.source} maxLength={120} placeholder="e.g. LinkedIn" onChange={(event) => set({ source: event.target.value })} />
            </FormField>
            <FormField label="Creator" htmlFor={field("creator")}>
              <Input
                id={field("creator")}
                value={values.creator}
                maxLength={120}
                placeholder="e.g. SaaS founder, ~90k followers"
                onChange={(event) => set({ creator: event.target.value })}
              />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Topic" htmlFor={field("topic")}>
              <Input id={field("topic")} value={values.topic} maxLength={200} onChange={(event) => set({ topic: event.target.value })} />
            </FormField>
            <FormField label="Content Pillar" htmlFor={field("pillar")}>
              <PillarSelect id={field("pillar")} allowNone value={values.pillarId} onChange={(pillarId) => set({ pillarId })} />
            </FormField>
          </FormRow>
          <FormField label="Pasted content" htmlFor={field("content")} description="The text, a transcript or your notes — used for analysis only, never republished.">
            <Textarea id={field("content")} rows={5} value={values.content} maxLength={15000} onChange={(event) => set({ content: event.target.value })} />
          </FormField>
          <FormField label="Why it caught attention" htmlFor={field("why")}>
            <Textarea id={field("why")} rows={2} className="min-h-14" value={values.why} onChange={(event) => set({ why: event.target.value })} />
          </FormField>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Save reference
        </Button>
      </DialogFooter>
    </form>
  )
}
