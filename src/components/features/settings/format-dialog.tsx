"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChipToggleGroup, FORMAT_CATEGORY_ICONS, FormField, OptionSelect, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FORMAT_CATEGORIES, SCRIPT_FORMAT_IDS, SCRIPT_FORMATS } from "@/lib/constants"
import { dataActions, useTable } from "@/lib/store"
import type { ContentFormat, FormatCategory, ScriptFormat } from "@/lib/types"

const NAME_MAX = 60

const CATEGORY_OPTIONS = FORMAT_CATEGORIES.map((c) => ({ value: c.id, label: c.label, icon: FORMAT_CATEGORY_ICONS[c.id] }))
const SCRIPT_OPTIONS = SCRIPT_FORMAT_IDS.map((id) => ({ value: id, label: SCRIPT_FORMATS[id].label }))

interface FormatValues {
  name: string
  category: FormatCategory
  description: string
  script_format: ScriptFormat
}

/** Create / edit a content format. The form remounts per format so it starts from saved values. */
export function FormatDialog({
  open,
  onOpenChange,
  format,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  format: ContentFormat | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg">
        <FormatForm key={format?.id ?? "new"} format={format} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function FormatForm({ format, onDone }: { format: ContentFormat | null; onDone: () => void }) {
  const formats = useTable("content_formats")
  const [values, setValues] = useState<FormatValues>(() => ({
    name: format?.name ?? "",
    category: format?.category ?? "video",
    description: format?.description ?? "",
    script_format: format?.script_format ?? "short_video",
  }))
  const [touched, setTouched] = useState(false)

  const name = values.name.trim()
  const duplicate = formats.some((f) => f.id !== format?.id && f.name.trim().toLowerCase() === name.toLowerCase())
  const nameError = !name
    ? "Give the format a name."
    : name.length > NAME_MAX
      ? `Keep it under ${NAME_MAX} characters.`
      : duplicate
        ? "A format with this name already exists."
        : undefined
  const spec = SCRIPT_FORMATS[values.script_format]
  const set = <K extends keyof FormatValues>(key: K, value: FormatValues[K]) => setValues((v) => ({ ...v, [key]: value }))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (nameError) return
    const payload = {
      name,
      category: values.category,
      description: values.description.trim(),
      script_format: values.script_format,
    }
    if (format) {
      dataActions.update("content_formats", format.id, payload)
      toast.success("Format updated", { description: name })
    } else {
      const sortOrder = formats.reduce((max, f) => Math.max(max, f.sort_order), -1) + 1
      dataActions.insert("content_formats", { ...payload, is_default: false, sort_order: sortOrder })
      toast.success("Format added", { description: name })
    }
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{format ? "Edit format" : "New format"}</DialogTitle>
        <DialogDescription className="text-xs">
          Formats describe what you produce. The script structure is where Content Studio starts a new script.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label="Name" htmlFor="format-name" required error={touched ? nameError : undefined}>
            <Input
              id="format-name"
              value={values.name}
              autoFocus
              maxLength={NAME_MAX + 20}
              placeholder="e.g. Talking-head Reel"
              aria-invalid={Boolean(touched && nameError) || undefined}
              onChange={(event) => set("name", event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </FormField>

          <FormField label="Category">
            <ChipToggleGroup
              required
              options={CATEGORY_OPTIONS}
              value={values.category}
              onChange={(next) => {
                if (next) set("category", next)
              }}
              aria-label="Format category"
            />
          </FormField>

          <FormField label="Description" htmlFor="format-description">
            <Textarea
              id="format-description"
              rows={2}
              className="min-h-14"
              value={values.description}
              placeholder="When you use it and what makes it work."
              onChange={(event) => set("description", event.target.value)}
            />
          </FormField>

          <FormField
            label="Default script structure"
            htmlFor="format-script"
            description={format ? "Existing scripts keep their structure; new scripts start with this one." : spec.description}
          >
            <OptionSelect
              id="format-script"
              options={SCRIPT_OPTIONS}
              value={values.script_format}
              onChange={(next) => {
                if (next) set("script_format", next)
              }}
            />
            <div className="flex flex-wrap gap-1 pt-1" aria-label={`${spec.label} sections`}>
              {spec.sections.map((section) => (
                <Token key={section.key} className="font-normal text-muted-foreground">
                  {section.label}
                </Token>
              ))}
            </div>
          </FormField>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={Boolean(touched && nameError)}>
          {format ? "Save changes" : "Add format"}
        </Button>
      </DialogFooter>
    </form>
  )
}
