"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { PlatformSelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PIPELINE_STAGE_MAP } from "@/lib/constants"
import { createContentItem, useBrand } from "@/lib/store"
import type { InsertRow, PipelineStage, PlatformId } from "@/lib/types"
import { cn, truncate } from "@/lib/utils"
import type { QuickAddDefaults } from "./board-model"

const INHERITED: [keyof QuickAddDefaults, string][] = [
  ["pillar_id", "pillar"],
  ["campaign_id", "campaign"],
  ["format_id", "format"],
  ["owner", "owner"],
  ["priority", "priority"],
]

/** Working title + platform → a new content item (with its brief) straight into this stage. */
export function QuickAddForm({
  stage,
  defaults,
  onClose,
  className,
}: {
  stage: PipelineStage
  defaults: QuickAddDefaults
  onClose: () => void
  className?: string
}) {
  const router = useRouter()
  const brand = useBrand()
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [platform, setPlatform] = useState<PlatformId>(defaults.platform ?? brand.main_platforms[0] ?? "facebook")
  const label = PIPELINE_STAGE_MAP[stage]?.label ?? stage
  const clean = title.trim()
  const inherited = INHERITED.filter(([key]) => defaults[key]).map(([, name]) => name)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clean) return
    const values: InsertRow<"content_items"> = { title: clean, platform, stage }
    if (defaults.pillar_id) values.pillar_id = defaults.pillar_id
    if (defaults.campaign_id) values.campaign_id = defaults.campaign_id
    if (defaults.format_id) values.format_id = defaults.format_id
    if (defaults.owner) values.owner = defaults.owner
    if (defaults.priority) values.priority = defaults.priority
    const item = createContentItem(values)
    toast.success(`Added to ${label}`, {
      description: truncate(clean, 64),
      action: { label: "Open", onClick: () => router.push(`/studio/${item.id}`) },
    })
    setTitle("")
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={submit}
      aria-label={`Add to ${label}`}
      className={cn("flex shrink-0 flex-col gap-2 rounded-lg border bg-card p-2 shadow-xs", className)}
    >
      <Input
        ref={inputRef}
        autoFocus
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }
        }}
        placeholder="Working title…"
        aria-label={`Title of the new ${label} item`}
        className="h-7"
      />
      <div className="flex items-center gap-1.5">
        <PlatformSelect
          size="sm"
          value={platform}
          onChange={(next) => {
            if (next) setPlatform(next)
          }}
          aria-label="Platform"
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!clean}>
          Add
        </Button>
      </div>
      {inherited.length ? (
        <p className="px-0.5 text-[11px] leading-4 text-muted-foreground">Uses your {inherited.join(", ")} filter</p>
      ) : null}
    </form>
  )
}
