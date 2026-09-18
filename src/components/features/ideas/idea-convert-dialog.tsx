"use client"

import { addDays } from "date-fns"
import { FilePlus2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  chipVariants,
  DatePicker,
  FormField,
  FormRow,
  OptionSelect,
  PlatformToggleGroup,
  StageIcon,
  type SelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PIPELINE_STAGE_MAP } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { convertIdeaToContent, useBrand, useTable } from "@/lib/store"
import type { ContentIdea, ContentItem, ISODate, PipelineStage, PlatformId } from "@/lib/types"
import { formatNumber, truncate } from "@/lib/utils"
import { ideaConvertMessages } from "./idea-detail-messages"

const START_STAGES: PipelineStage[] = ["selected", "brief", "scripting", "ready_for_production"]
const STAGE_OPTIONS: SelectOption<PipelineStage>[] = START_STAGES.map((id) => ({
  value: id,
  label: PIPELINE_STAGE_MAP[id].label,
  icon: <StageIcon stage={id} />,
}))

const DUE_SHORTCUTS = [
  { label: "tomorrow", days: 1 },
  { label: "in_3_days", days: 3 },
  { label: "next_week", days: 7 },
] as const

/**
 * Idea → content: one content item per platform, each with a Content Brief pre-filled from the
 * idea (`convertIdeaToContent`). The idea moves to Converted to Content.
 */
export function IdeaConvertDialog({
  idea,
  open,
  onOpenChange,
  onConverted,
}: {
  idea: ContentIdea | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConverted?: (items: ContentItem[]) => void
}) {
  const t = useT(ideaConvertMessages)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {idea ? (
          <ConvertForm
            key={idea.id}
            idea={idea}
            onCancel={() => onOpenChange(false)}
            onConverted={(items) => {
              onConverted?.(items)
              onOpenChange(false)
            }}
          />
        ) : (
          <DialogHeader>
            <DialogTitle>{t("title_convert")}</DialogTitle>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ConvertForm({
  idea,
  onCancel,
  onConverted,
}: {
  idea: ContentIdea
  onCancel: () => void
  onConverted: (items: ContentItem[]) => void
}) {
  const router = useRouter()
  const t = useT(ideaConvertMessages)
  const c = useT(commonMessages)
  const brand = useBrand()
  const items = useTable("content_items")
  const ids = useId()
  const existing = useMemo(() => items.filter((i) => i.idea_id === idea.id).length, [items, idea.id])
  const [platforms, setPlatforms] = useState<PlatformId[]>(() =>
    idea.platforms.length ? idea.platforms : [brand.main_platforms[0] ?? "facebook"]
  )
  const [stage, setStage] = useState<PipelineStage>("brief")
  const [due, setDue] = useState<ISODate | null>(null)
  const [today] = useState(() => new Date())
  const todayIso = toISODate(today)

  const platformError = platforms.length ? null : t("platform_error")
  const titleError = idea.title.trim() ? null : t("title_error")
  const invalid = Boolean(platformError || titleError)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (invalid) return
    let created: ContentItem[]
    try {
      created = convertIdeaToContent(idea.id, { platforms, stage, due_date: due })
    } catch (error) {
      toast.error(t("failed"), { description: error instanceof Error ? error.message : String(error) })
      return
    }
    const first = created[0]
    toast.success(t.plural("created", created.length, { count: formatNumber(created.length) }), {
      description: `${truncate(idea.title, 80)} · ${PIPELINE_STAGE_MAP[stage].label}`,
      action: first ? { label: t("open_in_studio"), onClick: () => router.push(`/studio/${first.id}`) } : undefined,
    })
    onConverted(created)
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-4">
      <DialogHeader>
        <DialogTitle>{existing ? t("title_more") : t("title_convert")}</DialogTitle>
        <DialogDescription className="text-pretty">{t("description", { title: truncate(idea.title || t("untitled_idea"), 90) })}</DialogDescription>
      </DialogHeader>

      <FormField
        label={t("platforms")}
        required
        error={platformError}
        description={platforms.length ? t.plural("will_create", platforms.length, { count: formatNumber(platforms.length) }) : undefined}
      >
        <PlatformToggleGroup value={platforms} onChange={setPlatforms} aria-label={t("platforms_label")} />
      </FormField>

      <FormRow>
        <FormField label={t("start_in")} htmlFor={`${ids}-stage`}>
          <OptionSelect
            id={`${ids}-stage`}
            options={STAGE_OPTIONS}
            value={stage}
            onChange={(next) => next && setStage(next)}
            aria-label={t("stage_label")}
          />
        </FormField>
        <FormField label={t("due_date")} htmlFor={`${ids}-due`}>
          <DatePicker id={`${ids}-due`} value={due} onChange={setDue} placeholder={t("no_due_date")} minDate={todayIso} />
        </FormField>
      </FormRow>

      <div className="-mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t("shortcuts_label")}>
        {DUE_SHORTCUTS.map((shortcut) => {
          const value = toISODate(addDays(today, shortcut.days))
          return (
            <button
              key={shortcut.label}
              type="button"
              aria-pressed={due === value}
              onClick={() => setDue(due === value ? null : value)}
              className={chipVariants({ size: "xs", selected: due === value })}
            >
              {t(shortcut.label)}
            </button>
          )
        })}
      </div>

      {existing ? (
        <p className="text-xs text-pretty text-muted-foreground">
          {t.plural("existing", existing, { count: formatNumber(existing) })}
        </p>
      ) : null}
      {titleError ? <p className="text-xs text-destructive">{titleError}</p> : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={invalid}>
          <FilePlus2 aria-hidden />
          {t.plural("submit", Math.max(platforms.length, 1), { count: formatNumber(Math.max(platforms.length, 1)) })}
        </Button>
      </DialogFooter>
    </form>
  )
}
