"use client"

import { ChevronDown, ClipboardCopy, History } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { AiButton, AiNotice, OptionSelect, useConfirm, type SelectOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { buildScriptInput, useAiTask } from "@/lib/ai"
import { SCRIPT_FORMAT_IDS, SCRIPT_FORMATS } from "@/lib/constants"
import { dataActions, moveItemToStage, renderScriptBody, saveScriptVersion, useRow, useTable } from "@/lib/store"
import type { ContentItem, ContentScript, PipelineStage, ScriptFormat } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { CaptionCard, SectionEditor, SlidePreview } from "./script-editor"
import { ScriptHistorySheet } from "./script-history-sheet"
import { ScriptStats, ScriptStatusBar } from "./script-status"
import { AiErrorNotice } from "./studio-ai"
import { draftKey, studioActions, useDraftFormatsKey, useStudioStore, type ScriptDraft } from "./studio-store"
import {
  alignSections,
  captionWithHashtags,
  copyText,
  defaultScriptFormat,
  isScriptFormat,
  normalizeHashtag,
  relatedStories,
  sameList,
  sameSections,
  scriptWithLabels,
  starterSections,
  wordsIn,
} from "./studio-utils"
import { useSaveShortcut } from "./workspace-save"

const EARLY_STAGES = new Set<PipelineStage>(["idea", "selected", "brief"])

/** The Script (spec §16): format structures, section editor, AI drafts, versions, caption and slide preview. */
export function ScriptTab({ item }: { item: ContentItem }) {
  const scripts = useTable("content_scripts")
  const formatRows = useTable("content_formats")
  const briefs = useTable("content_briefs")
  const stories = useTable("stories")
  const pillar = useRow("content_pillars", item.pillar_id)
  const searchParams = useSearchParams()
  const [initialFormat] = useState<ScriptFormat>(() => {
    const param = searchParams.get("format")
    return isScriptFormat(param) ? param : defaultScriptFormat({ content_scripts: scripts, content_formats: formatRows }, item)
  })
  const format = useStudioStore((s) => s.formats[item.id]) ?? initialFormat
  const draft = useStudioStore((s) => s.drafts[draftKey(item.id, format)])
  const storyId = useStudioStore((s) => s.stories[item.id] ?? null)
  const draftFormats = useDraftFormatsKey(item.id)
  const ai = useAiTask("generate_script")
  const [confirm, confirmDialog] = useConfirm()
  const [historyOpen, setHistoryOpen] = useState(false)

  const brief = useMemo(() => briefs.find((b) => b.content_item_id === item.id), [briefs, item.id])
  const versions = useMemo(
    () => scripts.filter((s) => s.content_item_id === item.id && s.format === format).sort((a, b) => b.version - a.version),
    [scripts, item.id, format]
  )
  const saved = versions.find((v) => v.is_current) ?? versions[0]
  const savedSections = useMemo(() => (saved ? alignSections(format, saved.sections) : null), [saved, format])
  const starter = useMemo(() => starterSections(format, { hook: item.hook }, brief), [format, item.hook, brief])

  const sections = draft?.sections ?? savedSections ?? starter
  const caption = draft?.caption ?? saved?.caption ?? brief?.caption ?? ""
  const hashtags = draft?.hashtags ?? saved?.hashtags ?? []
  const words = wordsIn(sections)
  const dirty = Boolean(
    draft && (!saved || !savedSections || !sameSections(draft.sections, savedSections) || draft.caption !== saved.caption || !sameList(draft.hashtags, saved.hashtags))
  )
  const canSave = dirty && (words > 0 || Boolean(caption.trim()))
  const nextVersion = (versions[0]?.version ?? 0) + 1

  const formatOptions = useMemo<SelectOption<ScriptFormat>[]>(() => {
    const withScript = new Set(scripts.filter((s) => s.content_item_id === item.id).map((s) => s.format))
    const withDraft = new Set(draftFormats ? draftFormats.split(",") : [])
    const inPiece = SCRIPT_FORMAT_IDS.filter((f) => withScript.has(f) || withDraft.has(f))
    const option = (f: ScriptFormat, group: string) => ({
      value: f,
      label: `${SCRIPT_FORMATS[f].label}${withDraft.has(f) ? " · unsaved" : ""}`,
      group,
    })
    return [
      ...inPiece.map((f) => option(f, "In this piece")),
      ...SCRIPT_FORMAT_IDS.filter((f) => !inPiece.includes(f)).map((f) => option(f, inPiece.length ? "Other formats" : "Formats")),
    ]
  }, [scripts, item.id, draftFormats])

  const storyOptions = useMemo<SelectOption[]>(() => {
    const related = relatedStories(stories, item, brief, 5)
    const relatedIds = new Set(related.map((r) => r.story.id))
    return [
      ...related.map((r) => ({ value: r.story.id, label: r.story.title || "Untitled story", group: "Related to this piece" })),
      ...stories
        .filter((s) => !relatedIds.has(s.id))
        .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.title.localeCompare(b.title))
        .map((s) => ({ value: s.id, label: s.title || "Untitled story", group: "Story Vault" })),
    ]
  }, [stories, item, brief])

  function edit(patch: Partial<Pick<ScriptDraft, "sections" | "caption" | "hashtags">>) {
    const base: ScriptDraft = draft ?? {
      sections,
      caption,
      hashtags,
      baseId: saved?.id ?? null,
      source: "manual",
      model: "",
      title: saved?.title ?? "",
    }
    studioActions.setDraft(item.id, format, { ...base, ...patch })
  }

  function save() {
    if (!canSave) {
      toast.info(dirty ? "Add some copy before saving" : "No changes to save", {
        description: dirty ? undefined : saved ? `Version ${saved.version} is up to date.` : "Write a section or generate a draft first.",
      })
      return
    }
    const script = saveScriptVersion(item.id, {
      format,
      sections,
      title: draft?.title || saved?.title || SCRIPT_FORMATS[format].label,
      caption: caption.trim(),
      hashtags: hashtags.map(normalizeHashtag).filter(Boolean),
      generated_by: draft?.source ?? "manual",
    })
    studioActions.clearDraft(item.id, format)
    toast.success(
      `Saved as version ${script.version}`,
      EARLY_STAGES.has(item.stage)
        ? {
            description: "Ready to move this piece into Scripting?",
            action: { label: "Move to Scripting", onClick: () => moveItemToStage(item.id, "scripting") },
          }
        : { description: `${SCRIPT_FORMATS[format].label} · ${pluralize(wordsIn(script.sections), "word")}` }
    )
  }

  useSaveShortcut("script", save)

  async function discard() {
    if (!draft) return
    if (dirty) {
      const ok = await confirm({
        title: "Discard unsaved changes?",
        description: saved ? `The editor goes back to version ${saved.version}.` : "The editor goes back to a blank script.",
        confirmLabel: "Discard changes",
      })
      if (!ok) return
    }
    studioActions.clearDraft(item.id, format)
    toast.success("Changes discarded")
  }

  async function generate() {
    if (dirty) {
      const ok = await confirm({
        title: "Replace your unsaved edits?",
        description: "The AI draft replaces what's in the editor. Every saved version stays in the history.",
        confirmLabel: "Replace with AI draft",
        destructive: false,
      })
      if (!ok) return
    }
    const target = format
    const input = buildScriptInput(dataActions.getDb(), item.id, target, storyId ? [storyId] : [])
    if (!input) return
    const result = await ai.run(input, { entityType: "content_items", entityId: item.id })
    if (!result) return
    studioActions.setDraft(item.id, target, {
      sections: alignSections(target, result.output.sections),
      caption: result.output.caption,
      hashtags: result.output.hashtags.map(normalizeHashtag).filter(Boolean),
      baseId: saved?.id ?? null,
      source: result.provider,
      model: result.model,
      title: result.output.title,
    })
  }

  async function restore(version: ContentScript) {
    if (dirty) {
      const ok = await confirm({
        title: "Restore over your unsaved edits?",
        description: "Restoring saves the old version as the newest one and clears the edits in the editor.",
        confirmLabel: "Restore version",
        destructive: false,
      })
      if (!ok) return
    }
    const script = saveScriptVersion(item.id, {
      format,
      sections: version.sections,
      title: version.title,
      caption: version.caption,
      hashtags: version.hashtags,
      generated_by: version.generated_by,
    })
    studioActions.clearDraft(item.id, format)
    setHistoryOpen(false)
    toast.success(`Restored version ${version.version}`, { description: `Saved as version ${script.version} — the history keeps every version.` })
  }

  async function copy(text: string, message: string) {
    if (!text.trim()) return
    if (await copyText(text)) toast.success(message)
    else toast.error("Couldn't copy", { description: "Select the text and copy it manually." })
  }

  const body = renderScriptBody(sections)
  const postCaption = captionWithHashtags(caption, hashtags)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <OptionSelect
          value={format}
          onChange={(next) => next && studioActions.setFormat(item.id, next)}
          options={formatOptions}
          size="sm"
          aria-label="Script format"
          className="w-auto max-w-80 font-medium"
        />
        <span className="hidden text-xs text-muted-foreground lg:inline">{SCRIPT_FORMATS[format].description}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={!versions.length} onClick={() => setHistoryOpen(true)}>
            <History aria-hidden />
            History
            {versions.length ? <span className="text-muted-foreground num">{versions.length}</span> : null}
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={!words && !postCaption}>
                <ClipboardCopy aria-hidden />
                Copy
                <ChevronDown className="text-muted-foreground" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem disabled={!words} onSelect={() => void copy(body, "Script copied")}>
                Script — ready to post
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!words} onSelect={() => void copy(scriptWithLabels(sections), "Script with section labels copied")}>
                With section labels
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!postCaption} onSelect={() => void copy(postCaption, "Caption and hashtags copied")}>
                Caption + hashtags
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!words}
                onSelect={() => void copy([body, postCaption].filter(Boolean).join("\n\n"), "Script and caption copied")}
              >
                Everything
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2 dark:bg-input/10">
        <span className="pl-1 text-xs text-muted-foreground">Story</span>
        <OptionSelect
          value={storyId}
          onChange={(id) => studioActions.setStory(item.id, id)}
          options={storyOptions}
          allowNone
          noneLabel="No story — use a [placeholder]"
          placeholder="Choose a story"
          emptyText="Your Story Vault is empty."
          size="sm"
          aria-label="Story Vault story to weave into the AI draft"
          className="w-auto max-w-72 min-w-0 flex-1 bg-card sm:flex-none"
        />
        <AiButton type="button" size="sm" variant="default" pending={ai.isPending} className="ml-auto" onClick={() => void generate()}>
          {saved || draft ? "Regenerate with AI" : "Generate with AI"}
        </AiButton>
      </div>

      <AiErrorNotice error={ai.error} onRetry={() => void generate()} />

      <ScriptStatusBar
        draft={draft}
        dirty={dirty}
        saved={saved}
        format={format}
        canSave={canSave}
        nextVersion={nextVersion}
        onDiscard={() => void discard()}
        onSave={save}
      />

      <SectionEditor format={format} sections={sections} onChange={(key, content) => edit({ sections: sections.map((s) => (s.key === key ? { ...s, content } : s)) })} />
      <ScriptStats format={format} words={words} />
      {draft && draft.source !== "manual" ? <AiNotice>AI output is a first draft — edit it until it sounds like you, then save it as a version.</AiNotice> : null}

      {format === "carousel" || format === "story_sequence" ? <SlidePreview format={format} sections={sections} color={pillar?.color ?? null} /> : null}

      <CaptionCard
        platform={item.platform}
        caption={caption}
        hashtags={hashtags}
        briefCaption={brief?.caption ?? ""}
        onCaption={(value) => edit({ caption: value })}
        onHashtags={(value) => edit({ hashtags: value })}
      />

      <ScriptHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} format={format} versions={versions} onRestore={(v) => void restore(v)} />
      {confirmDialog}
    </div>
  )
}
