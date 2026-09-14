"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { FormatSelect, FormField, FormRow, FunnelSelect, PillarSelect, PlatformToggleGroup } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createIdea, useBrand } from "@/lib/store"
import type { FunnelStage, ID, PlatformId, Story } from "@/lib/types"
import { storyTalkingPoints, upperFirst } from "./story-model"

/** "Create idea" by hand from a story — the idea keeps a link to it (source `story`). */
export function StoryIdeaDialog({
  story,
  open,
  onOpenChange,
}: {
  story: Story | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        {story ? <IdeaForm key={story.id} story={story} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

interface FormValues {
  title: string
  hook: string
  message: string
  platforms: PlatformId[]
  pillarId: ID | null
  formatId: ID | null
  funnel: FunnelStage | null
}

function IdeaForm({ story, onClose }: { story: Story; onClose: () => void }) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const brand = useBrand()
  const router = useRouter()
  const [values, setValues] = useState<FormValues>(() => ({
    title: story.title,
    hook: "",
    message: story.lesson,
    platforms: brand.main_platforms.slice(0, 1),
    pillarId: story.pillar_id,
    formatId: null,
    funnel: null,
  }))
  const [touched, setTouched] = useState<{ title?: boolean; platforms?: boolean }>({})
  const errors = {
    title: values.title.trim() ? undefined : "Give the idea a title.",
    platforms: values.platforms.length ? undefined : "Pick at least one platform.",
  }
  const valid = !errors.title && !errors.platforms
  const set = (patch: Partial<FormValues>) => setValues((current) => ({ ...current, ...patch }))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ title: true, platforms: true })
    if (!valid) return
    const idea = createIdea({
      title: values.title.replace(/\s+/g, " ").trim(),
      hook: values.hook.replace(/\s+/g, " ").trim(),
      description: values.message.trim(),
      platforms: values.platforms,
      pillar_id: values.pillarId,
      format_id: values.formatId,
      funnel_stage: values.funnel,
      core_topic: upperFirst(story.keywords[0] ?? ""),
      talking_points: storyTalkingPoints(story),
      inspiration: `Story Vault: “${story.title.trim() || "Untitled story"}”`,
      source: "story",
      source_ref_id: story.id,
    })
    toast.success("Idea saved to your Idea Bank", {
      description: idea.title,
      action: { label: "Open", onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>Create an idea from this story</DialogTitle>
        <DialogDescription className="text-xs">
          Linked to “{story.title.trim() || "Untitled story"}”, so you can always see where it came from.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label="Idea title" htmlFor={field("title")} required error={touched.title ? errors.title : undefined}>
            <Input
              id={field("title")}
              value={values.title}
              autoFocus
              maxLength={300}
              aria-invalid={(touched.title && Boolean(errors.title)) || undefined}
              onChange={(event) => set({ title: event.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            />
          </FormField>
          <FormField label="Hook" htmlFor={field("hook")}>
            <Textarea
              id={field("hook")}
              rows={2}
              className="min-h-14"
              value={values.hook}
              placeholder="The first line that makes your audience stop scrolling"
              onChange={(event) => set({ hook: event.target.value })}
            />
          </FormField>
          <FormField label="Main message" htmlFor={field("message")} description="What should people take away?">
            <Textarea id={field("message")} rows={2} className="min-h-14" value={values.message} onChange={(event) => set({ message: event.target.value })} />
          </FormField>
          <FormField label="Platforms" required error={touched.platforms ? errors.platforms : undefined}>
            <PlatformToggleGroup
              value={values.platforms}
              onChange={(platforms) => {
                set({ platforms })
                setTouched((t) => ({ ...t, platforms: true }))
              }}
              aria-label="Idea platforms"
            />
          </FormField>
          <FormRow columns={3}>
            <FormField label="Content Pillar" htmlFor={field("pillar")}>
              <PillarSelect id={field("pillar")} allowNone value={values.pillarId} onChange={(pillarId) => set({ pillarId })} />
            </FormField>
            <FormField label="Format" htmlFor={field("format")}>
              <FormatSelect id={field("format")} allowNone value={values.formatId} onChange={(formatId) => set({ formatId })} />
            </FormField>
            <FormField label="Funnel stage" htmlFor={field("funnel")}>
              <FunnelSelect id={field("funnel")} allowNone value={values.funnel} onChange={(funnel) => set({ funnel })} />
            </FormField>
          </FormRow>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Save idea
        </Button>
      </DialogFooter>
    </form>
  )
}
