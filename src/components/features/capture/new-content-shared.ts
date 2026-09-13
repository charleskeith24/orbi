import type { BrandProfile, ContentIdea, ContentItem, InsertRow, PlatformId } from "@/lib/types"

/** Values a caller passes to the New Content dialog; they prefill the form and carry through to every item. */
export type ContentDefaults = InsertRow<"content_items">

export type OnContentCreated = (items: ContentItem[], title: string) => void

/** Platforms to preselect: the caller's platform, else the idea's, else the brand's main platform. */
export function platformsFor(idea: ContentIdea | undefined, defaults: ContentDefaults | undefined, brand: BrandProfile): PlatformId[] {
  if (defaults?.platform) return [defaults.platform]
  if (idea?.platforms.length) return idea.platforms
  return [brand.main_platforms[0] ?? "facebook"]
}

/** Callers' defaults apply to every created item — except an explicit id, which must stay unique. */
export function withoutId(values: ContentDefaults | undefined): ContentDefaults {
  const copy: ContentDefaults = { ...values }
  delete copy.id
  return copy
}

export const createLabel = (count: number) => (count > 1 ? `Create ${count} items` : "Create content")
