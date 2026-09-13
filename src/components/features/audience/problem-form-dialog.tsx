"use client"

import { useId, useMemo, useState } from "react"
import { FormField, FormRow, PersonaSelect, PillarSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { dataActions, useTable } from "@/lib/store"
import type { AudienceProblem, ID, ProblemCategory } from "@/lib/types"
import { clampSeverity, normalizeQuestion } from "./audience-model"
import { ProblemCategorySelect } from "./problem-category-select"
import { SeverityPicker } from "./severity"

export interface ProblemDefaults {
  category: ProblemCategory
  persona_id: ID | null
  pillar_id: ID | null
}

/** Add a problem to the bank. ⌘/Ctrl+Enter submits. */
export function ProblemFormDialog({
  open,
  defaults,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  defaults: ProblemDefaults
  onOpenChange: (open: boolean) => void
  onCreated: (problem: AudienceProblem) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <ProblemForm defaults={defaults} onCancel={() => onOpenChange(false)} onCreated={onCreated} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ProblemForm({
  defaults,
  onCancel,
  onCreated,
}: {
  defaults: ProblemDefaults
  onCancel: () => void
  onCreated: (problem: AudienceProblem) => void
}) {
  const id = useId()
  const problems = useTable("audience_problems")
  const [text, setText] = useState("")
  const [category, setCategory] = useState<ProblemCategory>(defaults.category)
  const [severity, setSeverity] = useState(3)
  const [personaId, setPersonaId] = useState<ID | null>(defaults.persona_id)
  const [pillarId, setPillarId] = useState<ID | null>(defaults.pillar_id)
  const [notes, setNotes] = useState("")
  const [touched, setTouched] = useState(false)

  const clean = text.replace(/\s+/g, " ").trim()
  const duplicate = useMemo(() => {
    const key = normalizeQuestion(clean)
    return key ? problems.find((p) => normalizeQuestion(p.problem) === key) : undefined
  }, [problems, clean])
  const error = duplicate ? "This problem is already in the Problem Bank." : touched && !clean ? "Describe the problem." : null

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!clean || duplicate) return
    const row = dataActions.insert("audience_problems", {
      problem: clean,
      category,
      severity: clampSeverity(severity),
      persona_id: personaId,
      pillar_id: pillarId,
      notes: notes.trim(),
    })
    onCreated(row)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add a problem</DialogTitle>
        <DialogDescription>Something your audience struggles with, in their words. Each problem can become a content idea.</DialogDescription>
      </DialogHeader>
      <FormField label="Problem" htmlFor={`${id}-problem`} required error={error}>
        <Textarea
          id={`${id}-problem`}
          autoFocus
          rows={3}
          maxLength={500}
          value={text}
          placeholder="e.g. Doesn't know the minimum daily budget to test an ad properly"
          aria-invalid={Boolean(error) || undefined}
          onChange={(event) => {
            setText(event.target.value)
            setTouched(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
      </FormField>
      <FormRow>
        <FormField label="Category" htmlFor={`${id}-category`}>
          <ProblemCategorySelect id={`${id}-category`} value={category} onChange={setCategory} />
        </FormField>
        <FormField label="Severity">
          <SeverityPicker value={severity} onChange={setSeverity} />
        </FormField>
        <FormField label="Persona" htmlFor={`${id}-persona`}>
          <PersonaSelect id={`${id}-persona`} allowNone value={personaId} onChange={setPersonaId} />
        </FormField>
        <FormField label="Pillar" htmlFor={`${id}-pillar`}>
          <PillarSelect id={`${id}-pillar`} allowNone value={pillarId} onChange={setPillarId} />
        </FormField>
      </FormRow>
      <FormField label="Notes" htmlFor={`${id}-notes`}>
        <Textarea
          id={`${id}-notes`}
          rows={2}
          maxLength={2000}
          value={notes}
          placeholder="Where you heard it, examples, how often it comes up"
          onChange={(event) => setNotes(event.target.value)}
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!clean || Boolean(duplicate)}>
          Add problem
        </Button>
      </DialogFooter>
    </form>
  )
}
