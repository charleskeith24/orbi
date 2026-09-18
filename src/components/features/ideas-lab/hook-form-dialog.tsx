"use client"

import { Plus } from "lucide-react"
import { useId, useState } from "react"
import { FormField, FormRow, HookCategorySelect, PillarSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { Hook, HookCategory, ID } from "@/lib/types"
import { hookMessages } from "./hook-messages"
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
  const t = useT(hookMessages)
  const c = useT(commonMessages)
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
      setError(t("write_first"))
      return
    }
    const key = normalizeHookText(clean)
    if (hooks.some((hook) => normalizeHookText(hook.text) === key)) {
      setError(t("already_exists"))
      return
    }
    onCreated(dataActions.insert("hooks", newHookValues({ text: clean, category, source: "user", pillar_id: pillarId, notes })))
  }

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <LabDialogHeader title={t("new_hook")} description={t("new_description")} />
      <LabDialogBody className="flex flex-col gap-4">
        <FormField label={t("hook")} htmlFor={`${id}-text`} required error={error ?? undefined} description={t("hook_example")}>
          <Textarea
            id={`${id}-text`}
            autoFocus
            rows={3}
            maxLength={MAX_LENGTH}
            value={text}
            placeholder={t("hook_placeholder")}
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
            {t("template_preview")} <HookText text={clean} className="text-foreground" />
          </p>
        ) : null}
        <FormRow>
          <FormField label={t("hook_style")} htmlFor={`${id}-style`}>
            <HookCategorySelect
              id={`${id}-style`}
              value={category}
              onChange={(next) => {
                if (next) setCategory(next)
              }}
            />
          </FormField>
          <FormField label={t("content_pillar")} htmlFor={`${id}-pillar`}>
            <PillarSelect id={`${id}-pillar`} allowNone value={pillarId} onChange={setPillarId} />
          </FormField>
        </FormRow>
        <FormField label={t("notes")} htmlFor={`${id}-notes`}>
          <Textarea
            id={`${id}-notes`}
            rows={2}
            maxLength={1000}
            value={notes}
            placeholder={t("notes_placeholder_form")}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </LabDialogBody>
      <LabDialogFooter status={<span className="num">{text.length} / {MAX_LENGTH}</span>}>
        <Button type="button" variant="ghost" onClick={onClose}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!clean}>
          <Plus aria-hidden />
          {t("add_hook")}
        </Button>
      </LabDialogFooter>
    </form>
  )
}
