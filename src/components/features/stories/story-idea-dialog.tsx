"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { FormatSelect, FormField, FormRow, FunnelSelect, PillarSelect, PlatformToggleGroup } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { createIdea, useBrand } from "@/lib/store"
import type { FunnelStage, ID, PlatformId, Story } from "@/lib/types"
import { storyFormMessages, storyVaultMessages } from "./messages"
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
  const t = useT(storyFormMessages)
  const tv = useT(storyVaultMessages)
  const c = useT(commonMessages)
  const errors = {
    title: values.title.trim() ? undefined : t("idea_title_required"),
    platforms: values.platforms.length ? undefined : t("idea_platform_required"),
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
    toast.success(t("idea_saved"), {
      description: idea.title,
      action: { label: c("open"), onClick: () => router.push(`/ideas?open=${idea.id}`) },
    })
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{t("idea_dialog_title")}</DialogTitle>
        <DialogDescription className="text-xs">{t("idea_dialog_description", { title: story.title.trim() || tv("untitled") })}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label={t("idea_title")} htmlFor={field("title")} required error={touched.title ? errors.title : undefined}>
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
          <FormField label={t("hook")} htmlFor={field("hook")}>
            <Textarea
              id={field("hook")}
              rows={2}
              className="min-h-14"
              value={values.hook}
              placeholder={t("hook_placeholder")}
              onChange={(event) => set({ hook: event.target.value })}
            />
          </FormField>
          <FormField label={t("main_message")} htmlFor={field("message")} description={t("main_message_description")}>
            <Textarea id={field("message")} rows={2} className="min-h-14" value={values.message} onChange={(event) => set({ message: event.target.value })} />
          </FormField>
          <FormField label={t("platforms")} required error={touched.platforms ? errors.platforms : undefined}>
            <PlatformToggleGroup
              value={values.platforms}
              onChange={(platforms) => {
                set({ platforms })
                setTouched((t) => ({ ...t, platforms: true }))
              }}
              aria-label={t("platforms_label")}
            />
          </FormField>
          <FormRow columns={3}>
            <FormField label={t("content_pillar")} htmlFor={field("pillar")}>
              <PillarSelect id={field("pillar")} allowNone value={values.pillarId} onChange={(pillarId) => set({ pillarId })} />
            </FormField>
            <FormField label={t("format")} htmlFor={field("format")}>
              <FormatSelect id={field("format")} allowNone value={values.formatId} onChange={(formatId) => set({ formatId })} />
            </FormField>
            <FormField label={t("funnel_stage")} htmlFor={field("funnel")}>
              <FunnelSelect id={field("funnel")} allowNone value={values.funnel} onChange={(funnel) => set({ funnel })} />
            </FormField>
          </FormRow>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onClose}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t("save_idea")}
        </Button>
      </DialogFooter>
    </form>
  )
}
