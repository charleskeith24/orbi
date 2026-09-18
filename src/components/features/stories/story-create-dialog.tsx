"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { DatePicker, FormField, FormRow, OptionSelect, PillarSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { todayISO } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions } from "@/lib/store"
import type { ID, ISODate, Story, StoryType } from "@/lib/types"
import { storyFormMessages } from "./messages"
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
  const t = useT(storyFormMessages)
  const c = useT(commonMessages)
  const titleError = title.trim() ? undefined : t("title_required")

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
    toast.success(t("added"), { description: story.title })
    onCreated(story)
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{t("new_title")}</DialogTitle>
        <DialogDescription className="text-xs">{t("new_description")}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label={t("story_title")} htmlFor={field("title")} required error={touched ? titleError : undefined}>
            <Input
              id={field("title")}
              value={title}
              autoFocus
              maxLength={200}
              placeholder={t("story_title_placeholder")}
              aria-invalid={(touched && Boolean(titleError)) || undefined}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </FormField>
          <FormRow>
            <FormField label={t("type")} htmlFor={field("type")}>
              <OptionSelect
                id={field("type")}
                options={STORY_TYPE_OPTIONS}
                value={type}
                onChange={(next) => {
                  if (next) setType(next)
                }}
              />
            </FormField>
            <FormField label={t("potential_pillar")} htmlFor={field("pillar")}>
              <PillarSelect id={field("pillar")} allowNone value={pillarId} onChange={setPillarId} />
            </FormField>
          </FormRow>
          <FormField label={t("date")} htmlFor={field("date")} description={t("date_description")}>
            <DatePicker id={field("date")} value={date} maxDate={today} onChange={setDate} />
          </FormField>
          <FormField label={t("what_happened")} htmlFor={field("situation")}>
            <Textarea
              id={field("situation")}
              rows={3}
              value={situation}
              placeholder={t("what_happened_placeholder")}
              onChange={(event) => setSituation(event.target.value)}
            />
          </FormField>
          <FormField label={t("lesson")} htmlFor={field("lesson")} description={t("lesson_description")}>
            <Textarea
              id={field("lesson")}
              rows={2}
              className="min-h-14"
              value={lesson}
              placeholder={t("lesson_placeholder")}
              onChange={(event) => setLesson(event.target.value)}
            />
          </FormField>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={Boolean(titleError)}>
          {t("add_story")}
        </Button>
      </DialogFooter>
    </form>
  )
}
