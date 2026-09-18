"use client"

import { CircleDot, Save, Sparkles, TriangleAlert } from "lucide-react"
import { ProviderBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { SCRIPT_FORMATS } from "@/lib/constants"
import { formatDateTime } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import type { ContentScript, ScriptFormat } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { scriptMessages } from "./script-messages"
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
  const t = useT(scriptMessages)
  const aiDraft = Boolean(draft && draft.source !== "manual")
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2" aria-live="polite">
      <div className="flex min-w-0 flex-1 basis-64 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {dirty && draft && aiDraft ? (
          <>
            <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
            <span className="font-medium">{t("ai_draft")}</span>
            <ProviderBadge provider={draft.source} model={draft.model || undefined} />
            <span className="text-xs text-muted-foreground">{t("not_saved_yet")}</span>
          </>
        ) : dirty ? (
          <>
            <CircleDot className="size-4 shrink-0 text-warning-fg" aria-hidden />
            <span className="font-medium">{t("unsaved_changes")}</span>
            <span className="text-xs text-muted-foreground">{saved ? t("editing_version", { version: saved.version }) : t("new_script")}</span>
          </>
        ) : saved ? (
          <>
            <span className="font-medium">{t("version", { version: saved.version })}</span>
            <span className="text-xs text-muted-foreground">{t("saved_at", { when: formatDateTime(saved.created_at) })}</span>
            <ProviderBadge provider={saved.generated_by} />
          </>
        ) : (
          <span className="text-xs text-pretty text-muted-foreground">
            {t("new_format_hint", { format: SCRIPT_FORMATS[format].label })}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {draft ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
            {t("discard")}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant={dirty ? "default" : "outline"} disabled={!canSave} onClick={onSave}>
          <Save aria-hidden />
          {t("save_version", { version: nextVersion })}
        </Button>
      </div>
    </div>
  )
}

/** Word count, spoken time (~150 wpm), reading time for text formats and a length warning for short video. */
export function ScriptStats({ format, words }: { format: ScriptFormat; words: number }) {
  const t = useT(scriptMessages)
  const seconds = spokenSeconds(words)
  const long = format === "short_video" && seconds > SHORT_VIDEO_MAX_SECONDS
  return (
    <p className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground num">
      <span>{t.plural("words", words, { count: formatNumber(words) })}</span>
      <span aria-hidden>·</span>
      <span title={t("wpm_title")}>{t("spoken", { time: spokenLabel(words) })}</span>
      {!SPOKEN_FORMATS.has(format) && words ? (
        <>
          <span aria-hidden>·</span>
          <span>{t("min_read", { minutes: Math.max(1, Math.round(words / READ_WPM)) })}</span>
        </>
      ) : null}
      {long ? (
        <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
          <TriangleAlert className="size-3.5" aria-hidden />
          {t("too_long")}
        </span>
      ) : null}
    </p>
  )
}
