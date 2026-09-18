"use client"

import { useId } from "react"
import { FormField } from "@/components/common"
import { useT } from "@/lib/i18n"
import { dataActions } from "@/lib/store"
import type { Story, UpdateRow } from "@/lib/types"
import { AutosaveTextarea } from "./autosave-field"
import { storyFormMessages } from "./messages"

type StarKey = "situation" | "problem" | "action" | "result" | "lesson"

const STAR_FIELDS = [
  { key: "situation", label: "situation", description: "situation_description", placeholder: "situation_placeholder" },
  { key: "problem", label: "problem", description: "problem_description", placeholder: "problem_placeholder" },
  { key: "action", label: "action", description: "action_description", placeholder: "action_placeholder" },
  { key: "result", label: "result", description: "result_description", placeholder: "result_placeholder" },
  { key: "lesson", label: "lesson", description: "lesson_star_description", placeholder: "lesson_star_placeholder" },
] as const satisfies readonly { key: StarKey; label: string; description: string; placeholder: string }[]

/** The STAR fields (+ lesson) of a story, each saved on blur. */
export function StoryStarFields({ story }: { story: Story }) {
  const id = useId()
  const t = useT(storyFormMessages)

  function commit(key: StarKey, value: string) {
    const patch: UpdateRow<"stories"> = {}
    patch[key] = value
    dataActions.update("stories", story.id, patch)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {STAR_FIELDS.map((field) => (
        <FormField key={field.key} label={t(field.label)} htmlFor={`${id}-${field.key}`} description={t(field.description)}>
          <AutosaveTextarea
            id={`${id}-${field.key}`}
            rows={3}
            className="min-h-16"
            value={story[field.key]}
            placeholder={t(field.placeholder)}
            onCommit={(value) => commit(field.key, value)}
          />
        </FormField>
      ))}
    </div>
  )
}
