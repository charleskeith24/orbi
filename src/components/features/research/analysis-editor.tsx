"use client"

import { useId } from "react"
import { FormField, ListEditor } from "@/components/common"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { researchMessages } from "./messages"
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
  const t = useT(researchMessages)
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const set = (patch: Partial<AnalysisFields>) => onChange({ ...value, ...patch })

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FormField label={t("hook")} htmlFor={field("hook")} description={t("hook_kind")}>
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
      <FormField label={t("structure")} description={t("structure_description")}>
        <ListEditor
          variant="lines"
          value={value.structure}
          onChange={(structure) => set({ structure })}
          maxItems={12}
          addLabel={t("add_beat")}
          placeholder={t("beat_placeholder")}
          aria-label={t("structure")}
          disabled={disabled}
        />
      </FormField>
      <FormField label={t("analysis_angle")} htmlFor={field("angle")}>
        <Input id={field("angle")} value={value.angle} maxLength={300} disabled={disabled} onChange={(event) => set({ angle: event.target.value })} />
      </FormField>
      <FormField label={t("psychology")} htmlFor={field("psychology")} description={t("psychology_description")}>
        <Textarea
          id={field("psychology")}
          rows={3}
          value={value.psychology}
          maxLength={1500}
          disabled={disabled}
          onChange={(event) => set({ psychology: event.target.value })}
        />
      </FormField>
      <FormField label={t("why_it_works")} htmlFor={field("why")}>
        <Textarea
          id={field("why")}
          rows={3}
          value={value.why_it_works}
          maxLength={1500}
          disabled={disabled}
          onChange={(event) => set({ why_it_works: event.target.value })}
        />
      </FormField>
      <FormField label={t("patterns")} description={t("patterns_description")}>
        <ListEditor
          variant="lines"
          value={value.patterns}
          onChange={(patterns) => set({ patterns })}
          maxItems={10}
          addLabel={t("add_pattern")}
          placeholder={t("pattern_placeholder")}
          aria-label={t("patterns")}
          disabled={disabled}
        />
      </FormField>
    </div>
  )
}
