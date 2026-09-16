/**
 * Key actions derived from workspace changes, so no domain operation needs a tracking call:
 * a new idea (idea_captured), a new content item (content_created), an item reaching a published
 * stage (post_published) and a new analytics snapshot (metrics_logged).
 *
 * Only ids, enums and booleans are read — never titles or text. Changes that add more rows than
 * BULK_THRESHOLD at once (workspace import, reset, moving a local workspace to the cloud) are not
 * user actions and produce nothing.
 */
import { PUBLISHED_STAGES } from "@/lib/constants"
import type { Database } from "@/lib/types"
import type { UsageEventName, UsageProps } from "./events"

export const BULK_THRESHOLD = 12

export interface DetectedAction {
  name: Extract<UsageEventName, "idea_captured" | "content_created" | "post_published" | "metrics_logged">
  props: UsageProps
}

const isPublished = (stage: string) => (PUBLISHED_STAGES as string[]).includes(stage)

function added<T extends { id: string }>(prev: T[], next: T[]): T[] {
  if (prev === next) return []
  const known = new Set(prev.map((row) => row.id))
  return next.filter((row) => !known.has(row.id))
}

export function detectKeyActions(prev: Database, next: Database): DetectedAction[] {
  const actions: DetectedAction[] = []

  const ideas = added(prev.content_ideas, next.content_ideas)
  if (ideas.length <= BULK_THRESHOLD) {
    for (const idea of ideas) actions.push({ name: "idea_captured", props: { source: idea.source } })
  }

  if (prev.content_items !== next.content_items) {
    const newItems = added(prev.content_items, next.content_items)
    if (newItems.length <= BULK_THRESHOLD) {
      for (const item of newItems) {
        actions.push({ name: "content_created", props: { platform: item.platform, stage: item.stage, from_idea: Boolean(item.idea_id) } })
        if (isPublished(item.stage)) actions.push({ name: "post_published", props: { platform: item.platform } })
      }
      const before = new Map(prev.content_items.map((item) => [item.id, item]))
      let moved = 0
      for (const item of next.content_items) {
        const old = before.get(item.id)
        if (!old || old === item || isPublished(old.stage) || !isPublished(item.stage)) continue
        if (++moved > BULK_THRESHOLD) break
        actions.push({ name: "post_published", props: { platform: item.platform } })
      }
    }
  }

  const metrics = added(prev.content_metrics, next.content_metrics)
  if (metrics.length <= BULK_THRESHOLD) {
    for (const metric of metrics) actions.push({ name: "metrics_logged", props: { platform: metric.platform } })
  }

  return actions
}
