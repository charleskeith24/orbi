import type { AiTaskOutput, ExperienceAngleType } from "@/lib/ai"
import { blankSections, convertIdeaToContent, createIdea, dataActions, saveScriptVersion } from "@/lib/store"
import type { ContentFormat, ContentIdea, ContentItem, FunnelStage, GeneratedBy, HookCategory, ID, InsertRow, PlatformId } from "@/lib/types"
import { upperFirst } from "./story-model"

export type ExperienceOutput = AiTaskOutput<"experience_to_content">
export type AngleOutput = ExperienceOutput["angles"][number]
export type ExtractedStory = ExperienceOutput["story"]

/** The eight Experience → Content angles, in display order (spec §31). */
export const ANGLE_ORDER: ExperienceAngleType[] = [
  "leadership_lesson",
  "management_framework",
  "personal_reflection",
  "storytelling_post",
  "educational_video",
  "contrarian_opinion",
  "linkedin_post",
  "facebook_post",
]

/** Label, hook style and funnel stage per angle (a lived experience is never a sales pitch). */
export const ANGLE_META: Record<ExperienceAngleType, { label: string; hook: HookCategory; funnel: FunnelStage }> = {
  leadership_lesson: { label: "Leadership lesson", hook: "authority", funnel: "mofu" },
  management_framework: { label: "Management framework", hook: "list", funnel: "mofu" },
  personal_reflection: { label: "Personal reflection", hook: "curiosity", funnel: "tofu" },
  storytelling_post: { label: "Storytelling post", hook: "story", funnel: "tofu" },
  educational_video: { label: "Educational video", hook: "list", funnel: "mofu" },
  contrarian_opinion: { label: "Contrarian opinion", hook: "contrarian", funnel: "tofu" },
  linkedin_post: { label: "LinkedIn post", hook: "story", funnel: "mofu" },
  facebook_post: { label: "Facebook post", hook: "story", funnel: "tofu" },
}

/** One generated angle, editable before it is saved. */
export interface AngleDraft {
  key: string
  type: ExperienceAngleType
  title: string
  hook: string
  /** Content format name (from the Brand Context). */
  format: string
  platform: PlatformId
  pillar_id: ID | null
  outline: string[]
  draft: string
  edited: boolean
  ideaId: ID | null
  itemId: ID | null
}

export function toAngleDrafts(angles: readonly AngleOutput[], run: number): AngleDraft[] {
  const order = new Map(ANGLE_ORDER.map((type, index) => [type, index]))
  return [...angles]
    .sort((a, b) => (order.get(a.type) ?? 99) - (order.get(b.type) ?? 99))
    .map((angle, index) => ({
      key: `${run}:${angle.type}:${index}`,
      type: angle.type,
      title: angle.title,
      hook: angle.hook,
      format: angle.format,
      platform: angle.platform,
      pillar_id: angle.pillar_id,
      outline: angle.outline,
      draft: angle.draft,
      edited: false,
      ideaId: null,
      itemId: null,
    }))
}

/** Ready-to-post text for the clipboard (the hook is usually the draft's first line already). */
export function angleCopyText(draft: Pick<AngleDraft, "title" | "hook" | "draft">): string {
  const body = draft.draft.trim()
  const hook = draft.hook.trim()
  if (!body) return [draft.title.trim(), hook].filter(Boolean).join("\n\n")
  return !hook || body.includes(hook) ? body : `${hook}\n\n${body}`
}

/** Content format id by (case-insensitive) name, falling back to a partial match. */
export function formatIdByName(formats: readonly ContentFormat[], name: string): ID | null {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return null
  return (
    formats.find((f) => f.name.toLowerCase() === wanted)?.id ??
    formats.find((f) => {
      const own = f.name.toLowerCase()
      return Boolean(own) && (wanted.includes(own) || own.includes(wanted))
    })?.id ??
    null
  )
}

/** Where an angle came from — decides the idea's source, link and provenance note. */
export interface AngleOrigin {
  source: "story" | "experience"
  /** Story Vault row the idea links to (`source_ref_id`), when there is one. */
  storyId: ID | null
  storyTitle: string
  lesson: string
  keywords: readonly string[]
  pillarId: ID | null
}

export function angleIdeaValues(draft: AngleDraft, origin: AngleOrigin, formats: readonly ContentFormat[]): InsertRow<"content_ideas"> {
  const meta = ANGLE_META[draft.type]
  const storyTitle = origin.storyTitle.trim()
  const where = origin.source === "story" ? "Story Vault" : "Experience"
  return {
    title: draft.title.replace(/\s+/g, " ").trim(),
    core_topic: upperFirst(origin.keywords[0] ?? ""),
    description: draft.draft.trim(),
    hook: draft.hook.replace(/\s+/g, " ").trim(),
    hook_category: meta.hook,
    pillar_id: draft.pillar_id ?? origin.pillarId,
    platforms: [draft.platform],
    format_id: formatIdByName(formats, draft.format),
    funnel_stage: meta.funnel,
    talking_points: draft.outline.map((step) => step.trim()).filter(Boolean),
    why_it_matters: origin.lesson.trim(),
    inspiration: storyTitle ? `${where}: “${storyTitle}” (${meta.label.toLowerCase()} angle)` : `${meta.label} angle from a real experience`,
    source: origin.source,
    source_ref_id: origin.storyId,
  }
}

export function saveAngleAsIdea(draft: AngleDraft, origin: AngleOrigin, formats: readonly ContentFormat[]): ContentIdea {
  return createIdea(angleIdeaValues(draft, origin, formats))
}

/** Store a draft as the item's first script (Freeform Copy) so the Content Studio opens on it. */
export function saveDraftScript(itemId: ID, draft: string, generatedBy: GeneratedBy) {
  const body = draft.trim()
  if (!body) return
  saveScriptVersion(itemId, {
    format: "custom",
    sections: blankSections("custom").map((section) => ({ ...section, content: body })),
    generated_by: generatedBy,
  })
}

/** Angle → idea (reusing the one already saved from it) → one content item with the draft as its script. */
export function createContentFromAngle(
  draft: AngleDraft,
  origin: AngleOrigin,
  formats: readonly ContentFormat[],
  generatedBy: GeneratedBy
): { idea: ContentIdea; item: ContentItem } {
  const existing = draft.ideaId ? dataActions.getDb().content_ideas.find((i) => i.id === draft.ideaId) : undefined
  const idea = existing ?? saveAngleAsIdea(draft, origin, formats)
  const [item] = convertIdeaToContent(idea.id, { platforms: [draft.platform], stage: draft.draft.trim() ? "scripting" : "brief" })
  if (!item) throw new Error("The content item couldn't be created.")
  saveDraftScript(item.id, draft.draft, generatedBy)
  return { idea, item }
}
