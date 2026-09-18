"use client"

import { Plus } from "lucide-react"
import { useId, useState } from "react"
import { FormField } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { ContentAngle } from "@/lib/types"
import { angleMessages } from "./angle-messages"
import { ANGLE_NAME_MAX, validateAngleName } from "./angle-model"
import { LabDialog, LabDialogBody, LabDialogFooter, LabDialogHeader } from "./lab-dialog"

/** "New angle": a custom lens with a description and an example. */
export function AngleFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (angle: ContentAngle) => void
}) {
  return (
    <LabDialog open={open} onOpenChange={onOpenChange} size="md">
      <AngleForm
        onClose={() => onOpenChange(false)}
        onCreated={(angle) => {
          onCreated(angle)
          onOpenChange(false)
        }}
      />
    </LabDialog>
  )
}

function AngleForm({ onClose, onCreated }: { onClose: () => void; onCreated: (angle: ContentAngle) => void }) {
  const id = useId()
  const t = useT(angleMessages)
  const c = useT(commonMessages)
  const lang = useUiLang()
  const angles = useTable("angles")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [example, setExample] = useState("")
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const problem = validateAngleName(name, angles, undefined, lang)
    if (problem) {
      setError(problem)
      return
    }
    onCreated(
      dataActions.insert("angles", {
        name: name.replace(/\s+/g, " ").trim(),
        description: description.trim(),
        example: example.replace(/\s+/g, " ").trim(),
        is_default: false,
      })
    )
  }

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <LabDialogHeader title={t("new_angle")} description={t("new_description")} />
      <LabDialogBody className="flex flex-col gap-4">
        <FormField label={t("name")} htmlFor={`${id}-name`} required error={error ?? undefined} description={t("name_help", { max: ANGLE_NAME_MAX })}>
          <Input
            id={`${id}-name`}
            autoFocus
            value={name}
            maxLength={ANGLE_NAME_MAX}
            autoComplete="off"
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
          />
        </FormField>
        <FormField label={t("description_label")} htmlFor={`${id}-description`}>
          <Textarea
            id={`${id}-description`}
            rows={3}
            maxLength={500}
            value={description}
            placeholder={t("description_placeholder_form")}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
        <FormField label={t("example")} htmlFor={`${id}-example`}>
          <Input
            id={`${id}-example`}
            value={example}
            maxLength={300}
            placeholder={t("example_placeholder_form")}
            onChange={(event) => setExample(event.target.value)}
          />
        </FormField>
      </LabDialogBody>
      <LabDialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          <Plus aria-hidden />
          {t("add_angle")}
        </Button>
      </LabDialogFooter>
    </form>
  )
}
