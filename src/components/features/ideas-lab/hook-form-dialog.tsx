"use client"

import { Plus } from "lucide-react"
import { useId, useState } from "react"
import { FormField, FormRow, HookCategorySelect, PillarSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { dataActions, useTable } from "@/lib/store"
import type { Hook, HookCategory, ID } from "@/lib/types"
import { countBlanks, newHookValues, normalizeHookText } from "./hook-model"
import { HookText } from "./hook-text"
import { LabDialog, LabDialogBody, LabDialogFooter, LabDialogHeader } from "./lab-dialog"

const MAX_LENGTH = 300

/** "New hook": text (with optional ___ blanks), style, pillar, notes. */
export function HookFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (hook: Hook) => void
}) {
  return (
    <LabDialog open={open} onOpenChange={onOpenChange} size="md">
      <HookForm
        onClose={() => onOpenChange(false)}
        onCreated={(hook) => {
          onCreated(hook)
          onOpenChange(false)
        }}
      />
    </LabDialog>
  )
}

function HookForm({ onClose, onCreated }: { onClose: () => void; onCreated: (hook: Hook) => void }) {
  const id = useId()
  const hooks = useTable("hooks")
  const [text, setText] = useState("")
  const [category, setCategory] = useState<HookCategory>("custom")
  const [pillarId, setPillarId] = useState<ID | null>(null)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const clean = text.replace(/\s+/g, " ").trim()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!clean) {
      setError("Write the hook first.")
      return
    }
    const key = normalizeHookText(clean)
    if (hooks.some((hook) => normalizeHookText(hook.text) === key)) {
      setError("This hook is already in your library.")
      return
    }
    onCreated(dataActions.insert("hooks", newHookValues({ text: clean, category, source: "user", pillar_id: pillarId, notes })))
  }

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <LabDialogHeader title="New hook" description="Save an opening line you want to reuse. Use ___ for the parts you fill in each time." />
      <LabDialogBody className="flex flex-col gap-4">
        <FormField label="Hook" htmlFor={`${id}-text`} required error={error ?? undefined} description="e.g. “Stop doing ___ if you want ___.”">
          <Textarea
            id={`${id}-text`}
            autoFocus
            rows={3}
            maxLength={MAX_LENGTH}
            value={text}
            placeholder="The first line, or the first two seconds…"
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => {
              setText(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
        </FormField>
        {countBlanks(clean) ? (
          <p className="text-xs text-muted-foreground">
            Template preview: <HookText text={clean} className="text-foreground" />
          </p>
        ) : null}
        <FormRow>
          <FormField label="Hook style" htmlFor={`${id}-style`}>
            <HookCategorySelect
              id={`${id}-style`}
              value={category}
              onChange={(next) => {
                if (next) setCategory(next)
              }}
            />
          </FormField>
          <FormField label="Content Pillar" htmlFor={`${id}-pillar`}>
            <PillarSelect id={`${id}-pillar`} allowNone value={pillarId} onChange={setPillarId} />
          </FormField>
        </FormRow>
        <FormField label="Notes" htmlFor={`${id}-notes`}>
          <Textarea
            id={`${id}-notes`}
            rows={2}
            maxLength={1000}
            value={notes}
            placeholder="When to use it, why it works…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </LabDialogBody>
      <LabDialogFooter status={<span className="num">{text.length} / {MAX_LENGTH}</span>}>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!clean}>
          <Plus aria-hidden />
          Add hook
        </Button>
      </LabDialogFooter>
    </form>
  )
}
