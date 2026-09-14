import { saveDraftScript } from "@/components/features/stories/angle-model"
import { upperFirst } from "@/components/features/stories/story-model"
import type { AiTaskInput } from "@/lib/ai"
import { convertIdeaToContent, createIdea, dataActions } from "@/lib/store"
import type { AiProviderId, ContentIdea, ContentItem, ID, InsertRow, PlatformId, ResearchItem, ResearchType, Story } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { adaptAnalysisInput, hookCategoryForAngle, referenceSummary, statusAfterAnalysis, toReferenceAnalysis, type AnalysisFields } from "./research-model"

export interface PastedReference {
  title: string
  creator: string
  platform: PlatformId | null
  url: string
  type: ResearchType
  content: string
}

export const EMPTY_PASTE: PastedReference = { title: "", creator: "", platform: null, url: "", type: "post", content: "" }

/** The analysis the original is built on (from the library or a fresh run), editable. */
export interface AdaptAnalysis {
  fields: AnalysisFields
  provider: AiProviderId
  model: string | null
  analyzedAt: string
  /** Differs from what the library holds (fresh or edited). */
  unsaved: boolean
}

export interface AdaptTargets {
  pillarId: ID | null
  personaId: ID | null
  platform: PlatformId
  formatId: ID | null
  storyId: ID | null
  /** What the creator wants to say, in their own words. */
  topic: string
}

export interface OriginalDraft {
  title: string
  hook: string
  outline: string[]
  draft: string
  originality_note: string
  provider: AiProviderId
  model: string | null
  edited: boolean
}

/** The reference as the flow describes it — a library row or the pasted one. Never its text. */
export interface ReferenceInfo {
  id: ID | null
  title: string
  creator: string
  platform: PlatformId | null
  type: ResearchType
  source: string
  topic: string
  why_attention: string
}

export function referenceInfo(item: ResearchItem): ReferenceInfo {
  return {
    id: item.id,
    title: item.title,
    creator: item.creator,
    platform: item.platform,
    type: item.type,
    source: item.source,
    topic: item.topic,
    why_attention: item.why_attention,
  }
}

/** Library title for a pasted reference: its own title, else its first line. */
export function pastedTitle(pasted: PastedReference): string {
  const own = pasted.title.replace(/\s+/g, " ").trim()
  if (own) return own
  const firstLine = pasted.content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
  return firstLine ? truncate(firstLine, 80) : "Pasted reference"
}

/** adapt_reference input. `story_ids` only steers which Story Vault stories the Brand Context carries. */
export function buildAdaptInput(
  analysis: AnalysisFields,
  ref: ReferenceInfo,
  targets: AdaptTargets,
  story: Story | undefined,
  formatName: string
): AiTaskInput<"adapt_reference"> & { story_ids?: ID[] } {
  const topic = targets.topic.trim() || (story ? story.lesson.trim() || story.title.trim() : "")
  return {
    analysis: adaptAnalysisInput(analysis),
    summary: referenceSummary(ref),
    topic: truncate(topic, 500),
    pillar_id: targets.pillarId,
    persona_id: targets.personaId,
    platform: targets.platform,
    format: truncate(formatName, 80),
    ...(story ? { story_ids: [story.id] } : {}),
  }
}

export function originalIdeaValues(original: OriginalDraft, ref: ReferenceInfo, targets: AdaptTargets, analysis: AnalysisFields): InsertRow<"content_ideas"> {
  const credit = [`“${truncate(ref.title.trim() || "a reference", 120)}”`, ref.creator.trim() ? `(${truncate(ref.creator.trim(), 60)})` : ""]
    .filter(Boolean)
    .join(" ")
  return {
    title: original.title.replace(/\s+/g, " ").trim(),
    hook: original.hook.replace(/\s+/g, " ").trim(),
    hook_category: hookCategoryForAngle(analysis.angle),
    description: original.draft.trim(),
    talking_points: original.outline.map((step) => step.trim()).filter(Boolean),
    pillar_id: targets.pillarId,
    persona_id: targets.personaId,
    platforms: [targets.platform],
    format_id: targets.formatId,
    core_topic: upperFirst(ref.topic),
    why_it_matters: targets.topic.trim(),
    inspiration: truncate(`Inspired by ${credit} — structure only. ${original.originality_note.trim()}`, 1000),
    source: "research",
    source_ref_id: ref.id,
  }
}

export function saveOriginalAsIdea(original: OriginalDraft, ref: ReferenceInfo, targets: AdaptTargets, analysis: AnalysisFields): ContentIdea {
  return createIdea(originalIdeaValues(original, ref, targets, analysis))
}

/** Original → idea (reusing the saved one) → one content item with the draft as its first script. */
export function createContentFromOriginal(
  original: OriginalDraft,
  ref: ReferenceInfo,
  targets: AdaptTargets,
  analysis: AnalysisFields,
  existingIdeaId: ID | null
): { idea: ContentIdea; item: ContentItem } {
  const existing = existingIdeaId ? dataActions.getDb().content_ideas.find((i) => i.id === existingIdeaId) : undefined
  const idea = existing ?? saveOriginalAsIdea(original, ref, targets, analysis)
  const [item] = convertIdeaToContent(idea.id, { platforms: [targets.platform], stage: original.draft.trim() ? "scripting" : "brief" })
  if (!item) throw new Error("The content item couldn't be created.")
  saveDraftScript(item.id, original.draft, original.edited ? "manual" : original.provider)
  return { idea, item }
}

/** Store the flow's analysis on a library reference (analyzing never downgrades an adapted one). */
export function saveAnalysisToReference(item: ResearchItem, analysis: AdaptAnalysis) {
  dataActions.update("research_items", item.id, {
    analysis: toReferenceAnalysis(analysis.fields, analysis.provider, analysis.analyzedAt),
    status: statusAfterAnalysis(item.status),
  })
}

/** Mark a library reference as adapted, keeping the analysis the original was built on. */
export function markReferenceAdapted(item: ResearchItem, analysis: AdaptAnalysis | null) {
  dataActions.update("research_items", item.id, {
    status: "adapted",
    ...(analysis && (analysis.unsaved || !item.analysis) ? { analysis: toReferenceAnalysis(analysis.fields, analysis.provider, analysis.analyzedAt) } : {}),
  })
}

/** Save a pasted reference (text + analysis) to the Research Library. */
export function savePastedReference(pasted: PastedReference, analysis: AdaptAnalysis | null, adapted: boolean, pillarId: ID | null): ResearchItem {
  return dataActions.insert("research_items", {
    title: pastedTitle(pasted),
    type: pasted.type,
    platform: pasted.platform,
    url: pasted.url.trim(),
    creator: pasted.creator.trim(),
    content: pasted.content.trim(),
    analysis: analysis ? toReferenceAnalysis(analysis.fields, analysis.provider, analysis.analyzedAt) : null,
    status: adapted ? "adapted" : analysis ? "analyzed" : "saved",
    pillar_id: pillarId,
  })
}
