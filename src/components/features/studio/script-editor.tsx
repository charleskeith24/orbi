"use client"

import { TriangleAlert } from "lucide-react"
import { useId } from "react"
import { catWash, FormField, ListEditor, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { PLATFORMS, SCRIPT_FORMATS } from "@/lib/constants"
import type { CategoricalColor, PlatformId, ScriptFormat, ScriptSection } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { CaptionCounter } from "./brief-fields"
import { scriptMessages } from "./script-messages"
import { captionWithHashtags, countWords, normalizeHashtag } from "./studio-utils"

/** The script as a document: one row per section — label and hint on the left, the copy on the right. */
export function SectionEditor({
  format,
  sections,
  onChange,
}: {
  format: ScriptFormat
  sections: ScriptSection[]
  onChange: (key: string, content: string) => void
}) {
  const hints = new Map(SCRIPT_FORMATS[format].sections.map((s) => [s.key, s.hint]))
  return (
    <div className="divide-y rounded-lg border bg-card">
      {sections.map((section) => (
        <SectionRow key={section.key} section={section} hint={hints.get(section.key)} onChange={onChange} />
      ))}
    </div>
  )
}

function SectionRow({
  section,
  hint,
  onChange,
}: {
  section: ScriptSection
  hint: string | undefined
  onChange: (key: string, content: string) => void
}) {
  const t = useT(scriptMessages)
  const id = useId()
  const words = countWords(section.content)
  return (
    <div className="grid min-w-0 gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <div className="flex min-w-0 items-baseline justify-between gap-2 sm:block sm:pt-1.5">
        <label htmlFor={id} className="block text-xs font-semibold tracking-wide text-foreground/80 uppercase">
          {section.label}
        </label>
        {hint ? <p className="mt-0.5 hidden text-xs text-pretty text-muted-foreground sm:block">{hint}</p> : null}
        <p className="shrink-0 text-[11px] text-muted-foreground num sm:mt-1">{words ? t.plural("words", words, { count: formatNumber(words) }) : ""}</p>
      </div>
      <textarea
        id={id}
        value={section.content}
        placeholder={hint ?? t("write_section")}
        onChange={(event) => onChange(section.key, event.target.value)}
        className="-mx-2 field-sizing-content min-h-[4.5rem] w-[calc(100%+1rem)] min-w-0 resize-none rounded-md bg-transparent px-2 py-1.5 text-base leading-relaxed outline-none placeholder:text-muted-foreground/70 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 md:text-sm dark:hover:bg-input/20 dark:focus-visible:bg-input/20"
      />
    </div>
  )
}

/** Words per slide before the copy stops reading as one slide. */
const SLIDE_WORD_LIMIT = 35

/** Carousel slides (4:5) or story frames (9:16) as they'll appear, washed in the pillar colour. */
export function SlidePreview({
  format,
  sections,
  color,
}: {
  format: "carousel" | "story_sequence"
  sections: ScriptSection[]
  color: CategoricalColor | null
}) {
  const t = useT(scriptMessages)
  const story = format === "story_sequence"
  const long = sections.filter((s) => countWords(s.content) > SLIDE_WORD_LIMIT).length
  return (
    <SectionCard
      title={story ? t("frame_preview") : t("slide_preview")}
      description={
        long
          ? t.plural(story ? "frames_long" : "slides_long", long, { count: formatNumber(long), limit: SLIDE_WORD_LIMIT })
          : story
            ? t("frames_hint")
            : t("slides_hint")
      }
      contentClassName="px-0 pb-4"
    >
      <ol className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-thin" aria-label={story ? t("story_frames") : t("carousel_slides")}>
        {sections.map((section, index) => {
          const words = countWords(section.content)
          const tooLong = words > SLIDE_WORD_LIMIT
          return (
            <li
              key={section.key}
              className={cn(
                "flex shrink-0 flex-col gap-2 overflow-hidden rounded-lg border p-3.5",
                story ? "aspect-[9/16] w-36" : "aspect-[4/5] w-48"
              )}
              style={{ backgroundColor: catWash(color, index === 0 ? 16 : 7) }}
            >
              <span className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground num">
                {index + 1} / {sections.length}
                {tooLong ? (
                  <span className="inline-flex items-center gap-0.5 font-medium text-warning-fg">
                    <TriangleAlert className="size-3" aria-hidden />
                    {t("slide_words", { count: words })}
                  </span>
                ) : null}
              </span>
              <p
                className={cn(
                  "min-h-0 flex-1 overflow-hidden text-pretty whitespace-pre-line",
                  index === 0 ? "text-base leading-snug font-semibold" : "text-[13px] leading-relaxed",
                  !section.content.trim() && "text-muted-foreground italic"
                )}
              >
                {section.content.trim() || t("empty")}
              </p>
              <span className="truncate text-[11px] text-muted-foreground">{section.label.replace(/^(Slide|Frame) \d+\s*—?\s*/, "")}</span>
            </li>
          )
        })}
      </ol>
    </SectionCard>
  )
}

/** Caption + hashtags for the post, with the platform's character limit. */
export function CaptionCard({
  platform,
  caption,
  hashtags,
  briefCaption,
  onCaption,
  onHashtags,
}: {
  platform: PlatformId
  caption: string
  hashtags: string[]
  briefCaption: string
  onCaption: (value: string) => void
  onHashtags: (value: string[]) => void
}) {
  const t = useT(scriptMessages)
  const captionId = useId()
  const tagsId = useId()
  const canUseBrief = Boolean(briefCaption.trim()) && briefCaption.trim() !== caption.trim()
  return (
    <SectionCard
      title={t("caption_hashtags")}
      description={t("posted_with", { platform: PLATFORMS[platform].label })}
      action={
        canUseBrief ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => onCaption(briefCaption)}>
            {t("use_brief_caption")}
          </Button>
        ) : undefined
      }
      contentClassName="flex flex-col gap-4"
    >
      <FormField label={t("caption")} htmlFor={captionId}>
        <Textarea
          id={captionId}
          value={caption}
          rows={3}
          placeholder={t("caption_placeholder")}
          onChange={(event) => onCaption(event.target.value)}
        />
        <CaptionCounter text={captionWithHashtags(caption, hashtags)} platform={platform} />
      </FormField>
      <FormField
        label={t("hashtags")}
        htmlFor={tagsId}
        description={platform === "linkedin" ? t("hashtags_linkedin") : t("hashtags_hint")}
      >
        <ListEditor
          id={tagsId}
          value={hashtags}
          onChange={(next) => onHashtags([...new Set(next.map(normalizeHashtag).filter(Boolean))])}
          placeholder="#hashtag"
          maxItems={30}
          aria-label={t("hashtags")}
        />
      </FormField>
    </SectionCard>
  )
}
