"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { FormField, FormRow, OptionSelect, PillarSelect, PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { ID, PlatformId, ResearchItem, ResearchType } from "@/lib/types"
import { researchMessages } from "./messages"
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
  const t = useT(researchMessages)
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
    title: values.title.trim() ? undefined : t("error_title"),
    url: values.url.trim() && !isHttpUrl(values.url) ? t("error_url") : undefined,
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
    toast.success(t("saved_to_library"), { description: item.title })
    onCreated(item)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{t("add_reference")}</DialogTitle>
        <DialogDescription className="text-xs">{t("dialog_description")}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label={t("title")} htmlFor={field("title")} required error={touched.title ? errors.title : undefined}>
            <Input
              id={field("title")}
              value={values.title}
              autoFocus
              maxLength={300}
              placeholder={t("title_placeholder")}
              aria-invalid={(touched.title && Boolean(errors.title)) || undefined}
              onChange={(event) => set({ title: event.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            />
          </FormField>
          <FormRow>
            <FormField label={t("type")} htmlFor={field("type")}>
              <OptionSelect
                id={field("type")}
                options={RESEARCH_TYPE_OPTIONS}
                value={values.type}
                onChange={(type) => {
                  if (type) set({ type })
                }}
              />
            </FormField>
            <FormField label={t("platform")} htmlFor={field("platform")}>
              <PlatformSelect id={field("platform")} allowNone value={values.platform} onChange={(platform) => set({ platform })} />
            </FormField>
          </FormRow>
          <FormField label={t("url")} htmlFor={field("url")} error={touched.url ? errors.url : undefined}>
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
            <FormField label={t("source")} htmlFor={field("source")}>
              <Input id={field("source")} value={values.source} maxLength={120} placeholder={t("source_placeholder")} onChange={(event) => set({ source: event.target.value })} />
            </FormField>
            <FormField label={t("creator")} htmlFor={field("creator")}>
              <Input
                id={field("creator")}
                value={values.creator}
                maxLength={120}
                placeholder={t("creator_placeholder")}
                onChange={(event) => set({ creator: event.target.value })}
              />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label={t("topic")} htmlFor={field("topic")}>
              <Input id={field("topic")} value={values.topic} maxLength={200} onChange={(event) => set({ topic: event.target.value })} />
            </FormField>
            <FormField label={t("content_pillar")} htmlFor={field("pillar")}>
              <PillarSelect id={field("pillar")} allowNone value={values.pillarId} onChange={(pillarId) => set({ pillarId })} />
            </FormField>
          </FormRow>
          <FormField label={t("pasted_content")} htmlFor={field("content")} description={t("pasted_description")}>
            <Textarea id={field("content")} rows={5} value={values.content} maxLength={15000} onChange={(event) => set({ content: event.target.value })} />
          </FormField>
          <FormField label={t("why_attention")} htmlFor={field("why")}>
            <Textarea id={field("why")} rows={2} className="min-h-14" value={values.why} onChange={(event) => set({ why: event.target.value })} />
          </FormField>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t("save_reference")}
        </Button>
      </DialogFooter>
    </form>
  )
}
