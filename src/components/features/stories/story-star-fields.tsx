"use client"

import { useId } from "react"
import { FormField } from "@/components/common"
import { dataActions } from "@/lib/store"
import type { Story, UpdateRow } from "@/lib/types"
import { AutosaveTextarea } from "./autosave-field"

type StarKey = "situation" | "problem" | "action" | "result" | "lesson"

const STAR_FIELDS: { key: StarKey; label: string; description: string; placeholder: string }[] = [
  { key: "situation", label: "Situation", description: "Where you were and what was at stake.", placeholder: "What was going on…" },
  { key: "problem", label: "Problem", description: "What went wrong, or what you had to solve.", placeholder: "What made it hard…" },
  { key: "action", label: "Action", description: "What you actually did — the decisions and the steps.", placeholder: "What you did…" },
  { key: "result", label: "Result", description: "How it turned out. Numbers make it believable.", placeholder: "What happened next…" },
  { key: "lesson", label: "Lesson", description: "The transferable lesson your audience can use.", placeholder: "What you'd tell someone in the same spot…" },
]

/** The STAR fields (+ lesson) of a story, each saved on blur. */
export function StoryStarFields({ story }: { story: Story }) {
  const id = useId()

  function commit(key: StarKey, value: string) {
    const patch: UpdateRow<"stories"> = {}
    patch[key] = value
    dataActions.update("stories", story.id, patch)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {STAR_FIELDS.map((field) => (
        <FormField key={field.key} label={field.label} htmlFor={`${id}-${field.key}`} description={field.description}>
          <AutosaveTextarea
            id={`${id}-${field.key}`}
            rows={3}
            className="min-h-16"
            value={story[field.key]}
            placeholder={field.placeholder}
            onCommit={(value) => commit(field.key, value)}
          />
        </FormField>
      ))}
    </div>
  )
}
