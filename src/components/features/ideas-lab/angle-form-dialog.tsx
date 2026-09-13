"use client"

import { Plus } from "lucide-react"
import { useId, useState } from "react"
import { FormField } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { dataActions, useTable } from "@/lib/store"
import type { ContentAngle } from "@/lib/types"
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
  const angles = useTable("angles")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [example, setExample] = useState("")
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const problem = validateAngleName(name, angles)
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
      <LabDialogHeader title="New angle" description="A lens you'll reuse — the Idea Generator can build whole batches around it." />
      <LabDialogBody className="flex flex-col gap-4">
        <FormField label="Name" htmlFor={`${id}-name`} required error={error ?? undefined} description={`Short and specific, e.g. “Ad teardown”. Up to ${ANGLE_NAME_MAX} characters.`}>
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
        <FormField label="Description" htmlFor={`${id}-description`}>
          <Textarea
            id={`${id}-description`}
            rows={3}
            maxLength={500}
            value={description}
            placeholder="What this angle does to a topic, and when to use it."
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
        <FormField label="Example" htmlFor={`${id}-example`}>
          <Input
            id={`${id}-example`}
            value={example}
            maxLength={300}
            placeholder="A title written in this angle"
            onChange={(event) => setExample(event.target.value)}
          />
        </FormField>
      </LabDialogBody>
      <LabDialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          <Plus aria-hidden />
          Add angle
        </Button>
      </LabDialogFooter>
    </form>
  )
}
