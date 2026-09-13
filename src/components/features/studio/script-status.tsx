"use client"

import { CircleDot, Save, Sparkles, TriangleAlert } from "lucide-react"
import { ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { SCRIPT_FORMATS } from "@/lib/constants"
import { formatDateTime } from "@/lib/dates"
import type { ContentScript, ScriptFormat } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import type { ScriptDraft } from "./studio-store"
import { spokenLabel, spokenSeconds } from "./studio-utils"

/** Formats read aloud; the rest also get a reading-time estimate. */
const SPOKEN_FORMATS = new Set<ScriptFormat>(["short_video", "long_video", "video_brief", "podcast_outline", "story_sequence"])
const SHORT_VIDEO_MAX_SECONDS = 90
const READ_WPM = 230

/** What's in the editor right now (AI draft · unsaved edits · saved version) and the save action. */
export function ScriptStatusBar({
  draft,
  dirty,
  saved,
  format,
  canSave,
  nextVersion,
  onDiscard,
  onSave,
}: {
  draft: ScriptDraft | undefined
  dirty: boolean
  saved: ContentScript | undefined
  format: ScriptFormat
  canSave: boolean
  nextVersion: number
  onDiscard: () => void
  onSave: () => void
}) {
  const aiDraft = Boolean(draft && draft.source !== "manual")
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2" aria-live="polite">
      <div className="flex min-w-0 flex-1 basis-64 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {dirty && draft && aiDraft ? (
          <>
            <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
            <span className="font-medium">AI draft</span>
            <ProviderBadge provider={draft.source} model={draft.model || undefined} />
            <span className="text-xs text-muted-foreground">Not saved yet — review and edit it first.</span>
          </>
        ) : dirty ? (
          <>
            <CircleDot className="size-4 shrink-0 text-warning-fg" aria-hidden />
            <span className="font-medium">Unsaved changes</span>
            <span className="text-xs text-muted-foreground">{saved ? `Editing version ${saved.version}` : "New script"}</span>
          </>
        ) : saved ? (
          <>
            <span className="font-medium">Version {saved.version}</span>
            <span className="text-xs text-muted-foreground">Saved {formatDateTime(saved.created_at)}</span>
            <ProviderBadge provider={saved.generated_by} />
          </>
        ) : (
          <span className="text-xs text-pretty text-muted-foreground">
            New {SCRIPT_FORMATS[format].label} — write it section by section, or generate a first draft from your brief.
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {draft ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
            Discard
          </Button>
        ) : null}
        <Button type="button" size="sm" variant={dirty ? "default" : "outline"} disabled={!canSave} onClick={onSave}>
          <Save aria-hidden />
          Save version {nextVersion}
        </Button>
      </div>
    </div>
  )
}

/** Word count, spoken time (~150 wpm), reading time for text formats and a length warning for short video. */
export function ScriptStats({ format, words }: { format: ScriptFormat; words: number }) {
  const seconds = spokenSeconds(words)
  const long = format === "short_video" && seconds > SHORT_VIDEO_MAX_SECONDS
  return (
    <p className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground num">
      <span>{pluralize(words, "word")}</span>
      <span aria-hidden>·</span>
      <span title="At about 150 words per minute">{spokenLabel(words)} spoken</span>
      {!SPOKEN_FORMATS.has(format) && words ? (
        <>
          <span aria-hidden>·</span>
          <span>≈ {Math.max(1, Math.round(words / READ_WPM))} min read</span>
        </>
      ) : null}
      {long ? (
        <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
          <TriangleAlert className="size-3.5" aria-hidden />
          Over 90 seconds — tighten it for Reels, TikTok and Shorts
        </span>
      ) : null}
    </p>
  )
}
