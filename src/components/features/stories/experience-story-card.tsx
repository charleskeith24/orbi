"use client"

import { BookmarkPlus, CircleCheck, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import { FormField, ListEditor, OptionSelect, PillarSelect, ProviderBadge, SectionCard, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { todayISO } from "@/lib/dates"
import { dataActions } from "@/lib/store"
import type { AiProviderId, ID, Story, StoryType } from "@/lib/types"
import type { ExtractedStory } from "./angle-model"
import { STORY_TYPE_OPTIONS, StoryTypeBadge } from "./story-badges"

type StarKey = "situation" | "problem" | "action" | "result" | "lesson"

const FIELDS: { key: StarKey; label: string }[] = [
  { key: "situation", label: "Situation" },
  { key: "problem", label: "Problem" },
  { key: "action", label: "Action" },
  { key: "result", label: "Result" },
  { key: "lesson", label: "Lesson" },
]

/** The Story Vault entry extracted from an experience — editable, then saved to the vault. */
export function ExperienceStoryCard({
  story,
  provider,
  model,
  savedStory,
  defaultPillarId,
  onChange,
  onSaved,
}: {
  story: ExtractedStory
  provider: AiProviderId | null
  model: string | null
  savedStory: Story | undefined
  defaultPillarId: ID | null
  onChange: (patch: Partial<ExtractedStory>) => void
  onSaved: (story: Story) => void
}) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const [type, setType] = useState<StoryType>("experience")
  const [pillarId, setPillarId] = useState<ID | null>(defaultPillarId)
  const titleError = story.title.trim() ? undefined : "Give the story a title."

  if (savedStory) {
    return (
      <SectionCard
        title="Story Vault entry"
        action={
          <StatusPill tone="good" icon={CircleCheck}>
            Saved
          </StatusPill>
        }
      >
        <div className="flex min-w-0 flex-col gap-2">
          <StoryTypeBadge type={savedStory.type} />
          <p className="text-sm font-medium text-pretty">{savedStory.title}</p>
          {savedStory.lesson ? <p className="text-sm text-pretty text-muted-foreground">{savedStory.lesson}</p> : null}
          <p className="text-xs text-pretty text-muted-foreground">Ideas you save from these angles link back to this story.</p>
          <Button type="button" size="sm" variant="outline" className="mt-1 w-fit" asChild>
            <Link href={`/stories?open=${savedStory.id}`}>
              <ExternalLink aria-hidden />
              Open in Story Vault
            </Link>
          </Button>
        </div>
      </SectionCard>
    )
  }

  function setField(key: StarKey | "emotion", value: string) {
    const patch: Partial<ExtractedStory> = {}
    patch[key] = value
    onChange(patch)
  }

  function save() {
    if (titleError) return
    const row = dataActions.insert("stories", {
      type,
      title: story.title.replace(/\s+/g, " ").trim(),
      situation: story.situation.trim(),
      problem: story.problem.trim(),
      action: story.action.trim(),
      result: story.result.trim(),
      lesson: story.lesson.trim(),
      emotion: story.emotion.trim(),
      keywords: story.keywords,
      pillar_id: pillarId,
      occurred_on: todayISO(),
    })
    onSaved(row)
  }

  return (
    <SectionCard
      title="Story Vault entry"
      description="Pulled from what you wrote — nothing invented. Edit it, then keep it."
      action={provider ? <ProviderBadge provider={provider} model={model ?? undefined} /> : null}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <FormField label="Story title" htmlFor={field("title")} required error={titleError}>
          <Input
            id={field("title")}
            value={story.title}
            maxLength={200}
            aria-invalid={Boolean(titleError) || undefined}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </FormField>
        <div className="grid min-w-0 grid-cols-2 gap-3">
          <FormField label="Type" htmlFor={field("type")}>
            <OptionSelect
              id={field("type")}
              size="sm"
              options={STORY_TYPE_OPTIONS}
              value={type}
              onChange={(next) => {
                if (next) setType(next)
              }}
            />
          </FormField>
          <FormField label="Content Pillar" htmlFor={field("pillar")}>
            <PillarSelect id={field("pillar")} size="sm" allowNone value={pillarId} onChange={setPillarId} />
          </FormField>
        </div>
        {FIELDS.map((f) => (
          <FormField key={f.key} label={f.label} htmlFor={field(f.key)}>
            <Textarea
              id={field(f.key)}
              rows={2}
              className="min-h-14"
              value={story[f.key]}
              placeholder="Not mentioned — add it if it matters"
              onChange={(event) => setField(f.key, event.target.value)}
            />
          </FormField>
        ))}
        <FormField label="Emotion" htmlFor={field("emotion")}>
          <Input id={field("emotion")} value={story.emotion} maxLength={200} placeholder="How it felt" onChange={(event) => setField("emotion", event.target.value)} />
        </FormField>
        <FormField label="Keywords" htmlFor={field("keywords")}>
          <ListEditor
            id={field("keywords")}
            value={story.keywords}
            onChange={(keywords) => onChange({ keywords: keywords.map((k) => k.toLowerCase()) })}
            maxItems={12}
            placeholder="Add a keyword and press Enter"
            aria-label="Keywords"
          />
        </FormField>
        <Button type="button" size="sm" className="w-full sm:w-fit" disabled={Boolean(titleError)} onClick={save}>
          <BookmarkPlus aria-hidden />
          Save to Story Vault
        </Button>
      </div>
    </SectionCard>
  )
}
