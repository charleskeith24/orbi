"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChipToggleGroup, FORMAT_CATEGORY_ICONS, FormField, OptionSelect, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FORMAT_CATEGORIES, SCRIPT_FORMAT_IDS, SCRIPT_FORMATS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { ContentFormat, FormatCategory, ScriptFormat } from "@/lib/types"
import { formatsMessages } from "./formats-messages"

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
  const t = useT(formatsMessages)
  const c = useT(commonMessages)
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
    ? t("name_required")
    : name.length > NAME_MAX
      ? t("name_too_long", { max: NAME_MAX })
      : duplicate
        ? t("name_taken")
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
      toast.success(t("updated"), { description: name })
    } else {
      const sortOrder = formats.reduce((max, f) => Math.max(max, f.sort_order), -1) + 1
      dataActions.insert("content_formats", { ...payload, is_default: false, sort_order: sortOrder })
      toast.success(t("added"), { description: name })
    }
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{format ? t("edit_title") : t("new_format")}</DialogTitle>
        <DialogDescription className="text-xs">
          {t("dialog_description")}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label={t("name")} htmlFor="format-name" required error={touched ? nameError : undefined}>
            <Input
              id="format-name"
              value={values.name}
              autoFocus
              maxLength={NAME_MAX + 20}
              placeholder={t("name_placeholder")}
              aria-invalid={Boolean(touched && nameError) || undefined}
              onChange={(event) => set("name", event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </FormField>

          <FormField label={t("category")}>
            <ChipToggleGroup
              required
              options={CATEGORY_OPTIONS}
              value={values.category}
              onChange={(next) => {
                if (next) set("category", next)
              }}
              aria-label={t("category_aria")}
            />
          </FormField>

          <FormField label={t("description")} htmlFor="format-description">
            <Textarea
              id="format-description"
              rows={2}
              className="min-h-14"
              value={values.description}
              placeholder={t("description_placeholder")}
              onChange={(event) => set("description", event.target.value)}
            />
          </FormField>

          <FormField
            label={t("script_label")}
            htmlFor="format-script"
            description={format ? t("script_existing") : spec.description}
          >
            <OptionSelect
              id="format-script"
              options={SCRIPT_OPTIONS}
              value={values.script_format}
              onChange={(next) => {
                if (next) set("script_format", next)
              }}
            />
            <div className="flex flex-wrap gap-1 pt-1" aria-label={t("script_sections_aria", { label: spec.label })}>
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
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={Boolean(touched && nameError)}>
          {format ? c("save_changes") : t("add_format")}
        </Button>
      </DialogFooter>
    </form>
  )
}
