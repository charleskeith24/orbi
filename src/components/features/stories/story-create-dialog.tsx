"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { DatePicker, FormField, FormRow, OptionSelect, PillarSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { todayISO } from "@/lib/dates"
import { dataActions } from "@/lib/store"
import type { ID, ISODate, Story, StoryType } from "@/lib/types"
import { STORY_TYPE_OPTIONS } from "./story-badges"

/** "New story": the essentials, then the detail sheet opens for the rest of the STAR fields. */
export function StoryCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (story: Story) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <StoryForm
          onCancel={() => onOpenChange(false)}
          onCreated={(story) => {
            onOpenChange(false)
            onCreated(story)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function StoryForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (story: Story) => void }) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const [today] = useState(() => todayISO())
  const [title, setTitle] = useState("")
  const [type, setType] = useState<StoryType>("story")
  const [pillarId, setPillarId] = useState<ID | null>(null)
  const [date, setDate] = useState<ISODate | null>(today)
  const [situation, setSituation] = useState("")
  const [lesson, setLesson] = useState("")
  const [touched, setTouched] = useState(false)
  const titleError = title.trim() ? undefined : "Give the story a title."

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (titleError) return
    const story = dataActions.insert("stories", {
      title: title.replace(/\s+/g, " ").trim(),
      type,
      pillar_id: pillarId,
      occurred_on: date,
      situation: situation.trim(),
      lesson: lesson.trim(),
    })
    toast.success("Story added to your vault", { description: story.title })
    onCreated(story)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>New story</DialogTitle>
        <DialogDescription className="text-xs">
          Capture the moment while it&apos;s fresh. You can add the problem, action and result in the story after saving.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label="Story title" htmlFor={field("title")} required error={touched ? titleError : undefined}>
            <Input
              id={field("title")}
              value={title}
              autoFocus
              maxLength={200}
              placeholder="e.g. The client who taught me to say no"
              aria-invalid={(touched && Boolean(titleError)) || undefined}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </FormField>
          <FormRow>
            <FormField label="Type" htmlFor={field("type")}>
              <OptionSelect
                id={field("type")}
                options={STORY_TYPE_OPTIONS}
                value={type}
                onChange={(next) => {
                  if (next) setType(next)
                }}
              />
            </FormField>
            <FormField label="Potential Content Pillar" htmlFor={field("pillar")}>
              <PillarSelect id={field("pillar")} allowNone value={pillarId} onChange={setPillarId} />
            </FormField>
          </FormRow>
          <FormField label="Date" htmlFor={field("date")} description="When it happened.">
            <DatePicker id={field("date")} value={date} maxDate={today} onChange={setDate} />
          </FormField>
          <FormField label="What happened?" htmlFor={field("situation")}>
            <Textarea
              id={field("situation")}
              rows={3}
              value={situation}
              placeholder="The situation, in a few honest sentences."
              onChange={(event) => setSituation(event.target.value)}
            />
          </FormField>
          <FormField label="Lesson" htmlFor={field("lesson")} description="The part your audience can reuse.">
            <Textarea
              id={field("lesson")}
              rows={2}
              className="min-h-14"
              value={lesson}
              placeholder="What would you tell someone in the same spot?"
              onChange={(event) => setLesson(event.target.value)}
            />
          </FormField>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={Boolean(titleError)}>
          Add story
        </Button>
      </DialogFooter>
    </form>
  )
}
