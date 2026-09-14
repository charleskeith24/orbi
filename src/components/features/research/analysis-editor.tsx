"use client"

import { useId } from "react"
import { FormField, ListEditor } from "@/components/common"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { AnalysisFields } from "./research-model"

/** Edit an analysis before saving or adapting it: hook, structure, angle, psychology, why it works, patterns. */
export function AnalysisEditor({
  value,
  onChange,
  disabled,
}: {
  value: AnalysisFields
  onChange: (next: AnalysisFields) => void
  disabled?: boolean
}) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const set = (patch: Partial<AnalysisFields>) => onChange({ ...value, ...patch })

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FormField label="Hook" htmlFor={field("hook")} description="The opening, and what kind of hook it is.">
        <Textarea
          id={field("hook")}
          rows={2}
          className="min-h-14"
          value={value.hook}
          maxLength={500}
          disabled={disabled}
          onChange={(event) => set({ hook: event.target.value })}
        />
      </FormField>
      <FormField label="Structure" description="The beats, in order.">
        <ListEditor
          variant="lines"
          value={value.structure}
          onChange={(structure) => set({ structure })}
          maxItems={12}
          addLabel="Add beat"
          placeholder="e.g. Proof: a before/after number"
          aria-label="Structure"
          disabled={disabled}
        />
      </FormField>
      <FormField label="Angle" htmlFor={field("angle")}>
        <Input id={field("angle")} value={value.angle} maxLength={300} disabled={disabled} onChange={(event) => set({ angle: event.target.value })} />
      </FormField>
      <FormField label="Psychology" htmlFor={field("psychology")} description="Which levers it pulls, and how.">
        <Textarea
          id={field("psychology")}
          rows={3}
          value={value.psychology}
          maxLength={1500}
          disabled={disabled}
          onChange={(event) => set({ psychology: event.target.value })}
        />
      </FormField>
      <FormField label="Why it works" htmlFor={field("why")}>
        <Textarea
          id={field("why")}
          rows={3}
          value={value.why_it_works}
          maxLength={1500}
          disabled={disabled}
          onChange={(event) => set({ why_it_works: event.target.value })}
        />
      </FormField>
      <FormField label="Patterns to borrow" description="Structure, not words — reusable with your own substance.">
        <ListEditor
          variant="lines"
          value={value.patterns}
          onChange={(patterns) => set({ patterns })}
          maxItems={10}
          addLabel="Add pattern"
          placeholder="e.g. Put a specific moment before the advice"
          aria-label="Patterns to borrow"
          disabled={disabled}
        />
      </FormField>
    </div>
  )
}
