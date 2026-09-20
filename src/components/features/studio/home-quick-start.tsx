"use client"

import { BriefcaseBusiness, Clapperboard, ClipboardList, FilePlus2, GalleryHorizontal, MessageSquareText, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { FormField, FormRow, PillarSelect, PlatformIcon, PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import { PLATFORMS, SCRIPT_FORMATS } from "@/lib/constants"
import { createContentItem, dataActions, formatIdForScriptFormat, useBrand } from "@/lib/store"
import type { ID, PlatformId, ScriptFormat } from "@/lib/types"
import { cn } from "@/lib/utils"
import { studioHomeMessages } from "./messages"
import { studioActions } from "./studio-store"
import { QUICK_START_FORMATS, quickStartPlatform } from "./studio-utils"

const ICONS: Partial<Record<ScriptFormat, LucideIcon>> = {
  short_video: Clapperboard,
  facebook_post: MessageSquareText,
  linkedin_post: BriefcaseBusiness,
  carousel: GalleryHorizontal,
  video_brief: ClipboardList,
}

const TILE =
  "group flex h-11 min-w-0 items-center gap-2 rounded-lg border bg-card px-2.5 text-left outline-none transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-input/20"

/**
 * Format quick-starts (spec §16) plus "From scratch", one compact tile each (Calm UI). What each format is
 * shows on hover and in the dialog that opens.
 */
export function QuickStartGrid({ onStart, onScratch }: { onStart: (format: ScriptFormat) => void; onScratch: () => void }) {
  const t = useT(studioHomeMessages)
  const brand = useBrand()
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {QUICK_START_FORMATS.map((format) => {
        const spec = SCRIPT_FORMATS[format]
        const Icon = ICONS[format] ?? FilePlus2
        const platform = quickStartPlatform(format, brand.main_platforms)
        return (
          <button key={format} type="button" className={TILE} title={spec.description} onClick={() => onStart(format)}>
            <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{spec.label}</span>
            <PlatformIcon platform={platform} label={t("starts_on", { platform: PLATFORMS[platform].label })} className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" />
          </button>
        )
      })}
      <button type="button" className={cn(TILE, "border-dashed bg-transparent")} title={t("from_scratch_description")} onClick={onScratch}>
        <FilePlus2 className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{t("from_scratch")}</span>
      </button>
    </div>
  )
}

/** Working title + platform + pillar → a Scripting item opened on the Script tab with the format's structure. */
export function QuickStartDialog({
  format,
  open,
  onOpenChange,
}: {
  format: ScriptFormat
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT(studioHomeMessages)
  const router = useRouter()
  const brand = useBrand()
  const titleId = useId()
  const spec = SCRIPT_FORMATS[format]
  const [title, setTitle] = useState("")
  const [platform, setPlatform] = useState<PlatformId>(() => quickStartPlatform(format, brand.main_platforms))
  const [pillarId, setPillarId] = useState<ID | null>(null)
  const [touched, setTouched] = useState(false)
  const clean = title.replace(/\s+/g, " ").trim()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!clean) return
    const item = createContentItem({
      title: clean,
      platform,
      pillar_id: pillarId,
      format_id: formatIdForScriptFormat(dataActions.getDb(), format),
      stage: "scripting",
    })
    studioActions.setFormat(item.id, format)
    toast.success(t("content_created"), { description: t("quick_created_description", { format: spec.label, platform: PLATFORMS[platform].label }) })
    onOpenChange(false)
    router.push(`/studio/${item.id}?tab=script&format=${format}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("new_format", { format: spec.label })}</DialogTitle>
            <DialogDescription>
              {t("quick_description", {
                description: spec.description,
                sections: spec.sections
                  .map((s) => s.label.replace(/^Slide \d+ — /, ""))
                  .slice(0, 4)
                  .join(", "),
                more: spec.sections.length > 4 ? "…" : "",
              })}
            </DialogDescription>
          </DialogHeader>
          <FormField label={t("working_title")} htmlFor={titleId} required error={touched && !clean ? t("working_title_error") : undefined}>
            <Input
              id={titleId}
              value={title}
              autoFocus
              maxLength={300}
              placeholder={t("working_title_placeholder")}
              aria-invalid={(touched && !clean) || undefined}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>
          <FormRow>
            <FormField label={t("platform")}>
              <PlatformSelect value={platform} onChange={(next) => next && setPlatform(next)} aria-label={t("platform")} />
            </FormField>
            <FormField label={t("content_pillar")}>
              <PillarSelect value={pillarId} onChange={setPillarId} allowNone aria-label={t("content_pillar")} />
            </FormField>
          </FormRow>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!clean}>
              {t("create_open")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
