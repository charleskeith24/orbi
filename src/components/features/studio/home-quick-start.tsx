"use client"

import { BriefcaseBusiness, Clapperboard, ClipboardList, FilePlus2, GalleryHorizontal, MessageSquareText, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import { FormField, FormRow, PillarSelect, PlatformIcon, PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PLATFORMS, SCRIPT_FORMATS } from "@/lib/constants"
import { createContentItem, dataActions, formatIdForScriptFormat, useBrand } from "@/lib/store"
import type { ID, PlatformId, ScriptFormat } from "@/lib/types"
import { cn } from "@/lib/utils"
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
  "group flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-left outline-none transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-input/20"

/** Format quick-starts (spec §16) plus "From scratch". */
export function QuickStartGrid({ onStart, onScratch }: { onStart: (format: ScriptFormat) => void; onScratch: () => void }) {
  const brand = useBrand()
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {QUICK_START_FORMATS.map((format) => {
        const spec = SCRIPT_FORMATS[format]
        const Icon = ICONS[format] ?? FilePlus2
        const platform = quickStartPlatform(format, brand.main_platforms)
        return (
          <button key={format} type="button" className={TILE} onClick={() => onStart(format)}>
            <span className="flex items-center justify-between gap-2">
              <span className="flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors group-hover:text-foreground dark:bg-input/30">
                <Icon className="size-4" aria-hidden />
              </span>
              <PlatformIcon platform={platform} label={`Starts on ${PLATFORMS[platform].label}`} className="size-3.5 text-muted-foreground" />
            </span>
            <span className="text-sm font-medium">{spec.label}</span>
            <span className="line-clamp-2 text-xs text-pretty text-muted-foreground">{spec.description}</span>
          </button>
        )
      })}
      <button type="button" className={cn(TILE, "border-dashed bg-transparent")} onClick={onScratch}>
        <span className="flex size-7 items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors group-hover:text-foreground">
          <FilePlus2 className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-medium">From scratch</span>
        <span className="line-clamp-2 text-xs text-pretty text-muted-foreground">Any platform and format, with full strategy details</span>
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
    toast.success("Content created", { description: `${spec.label} for ${PLATFORMS[platform].label} — the structure is ready to write.` })
    onOpenChange(false)
    router.push(`/studio/${item.id}?tab=script&format=${format}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>New {spec.label}</DialogTitle>
            <DialogDescription>
              {spec.description}. You&apos;ll land in the Script tab with {spec.sections.map((s) => s.label.replace(/^Slide \d+ — /, "")).slice(0, 4).join(", ")}
              {spec.sections.length > 4 ? "…" : ""} ready to write.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Working title" htmlFor={titleId} required error={touched && !clean ? "Give it a working title — you can change it later." : undefined}>
            <Input
              id={titleId}
              value={title}
              autoFocus
              maxLength={300}
              placeholder="e.g. 3 numbers to check before you touch ad budget"
              aria-invalid={(touched && !clean) || undefined}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>
          <FormRow>
            <FormField label="Platform">
              <PlatformSelect value={platform} onChange={(next) => next && setPlatform(next)} aria-label="Platform" />
            </FormField>
            <FormField label="Content pillar">
              <PillarSelect value={pillarId} onChange={setPillarId} allowNone aria-label="Content pillar" />
            </FormField>
          </FormRow>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!clean}>
              Create & open
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
