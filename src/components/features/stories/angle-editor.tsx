"use client"

import { Check } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { FormatSelect, FormField, ListEditor, PillarSelect, PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTable } from "@/lib/store"
import { formatIdByName, type AngleDraft } from "./angle-model"

export type AngleEditableFields = Pick<AngleDraft, "title" | "hook" | "format" | "platform" | "pillar_id" | "outline" | "draft">

/** Edit a generated angle before saving it: title, hook, platform, format, pillar, outline and draft. */
export function AngleEditor({
  draft,
  onDone,
  onCancel,
}: {
  draft: AngleDraft
  onDone: (patch: AngleEditableFields) => void
  onCancel: () => void
}) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const formats = useTable("content_formats")
  const [form, setForm] = useState<AngleEditableFields>({
    title: draft.title,
    hook: draft.hook,
    format: draft.format,
    platform: draft.platform,
    pillar_id: draft.pillar_id,
    outline: draft.outline,
    draft: draft.draft,
  })
  const set = (patch: Partial<AngleEditableFields>) => setForm((current) => ({ ...current, ...patch }))
  const formatId = useMemo(() => formatIdByName(formats, form.format), [formats, form.format])
  const titleError = form.title.trim() ? undefined : "Give the angle a title."

  function done() {
    if (titleError) return
    onDone({
      title: form.title.replace(/\s+/g, " ").trim(),
      hook: form.hook.replace(/\s+/g, " ").trim(),
      format: form.format,
      platform: form.platform,
      pillar_id: form.pillar_id,
      outline: form.outline.map((step) => step.trim()).filter(Boolean),
      draft: form.draft.trim(),
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 px-4 pt-3 pb-4">
      <FormField label="Title" htmlFor={field("title")} required error={titleError}>
        <Input
          id={field("title")}
          autoFocus
          value={form.title}
          maxLength={200}
          aria-invalid={Boolean(titleError) || undefined}
          onChange={(event) => set({ title: event.target.value })}
        />
      </FormField>
      <FormField label="Hook" htmlFor={field("hook")}>
        <Textarea id={field("hook")} rows={2} className="min-h-14" value={form.hook} onChange={(event) => set({ hook: event.target.value })} />
      </FormField>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <FormField label="Platform" htmlFor={field("platform")}>
          <PlatformSelect
            id={field("platform")}
            size="sm"
            value={form.platform}
            onChange={(platform) => {
              if (platform) set({ platform })
            }}
          />
        </FormField>
        <FormField label="Format" htmlFor={field("format")}>
          <FormatSelect
            id={field("format")}
            size="sm"
            allowNone
            value={formatId}
            onChange={(next) => set({ format: next ? (formats.find((f) => f.id === next)?.name ?? "") : "" })}
          />
        </FormField>
        <FormField label="Content Pillar" htmlFor={field("pillar")}>
          <PillarSelect id={field("pillar")} size="sm" allowNone value={form.pillar_id} onChange={(pillar_id) => set({ pillar_id })} />
        </FormField>
      </div>
      <FormField label="Outline">
        <ListEditor
          variant="lines"
          value={form.outline}
          onChange={(outline) => set({ outline })}
          addLabel="Add step"
          placeholder="A beat of the piece"
          maxItems={8}
          aria-label="Outline"
        />
      </FormField>
      <FormField label="Draft" htmlFor={field("draft")}>
        <Textarea id={field("draft")} rows={10} className="min-h-40" value={form.draft} onChange={(event) => set({ draft: event.target.value })} />
      </FormField>
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={Boolean(titleError)} onClick={done}>
          <Check aria-hidden />
          Done
        </Button>
      </div>
    </div>
  )
}
