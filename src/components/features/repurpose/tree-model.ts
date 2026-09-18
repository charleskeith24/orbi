/**
 * Content Tree model (spec §24, principle 6): ORIGINAL IDEA → content items per platform →
 * repurposed children (recursive, via `parent_id` plus created `content_repurposing` rows) →
 * pending suggestions. Pure — performance comes in through `perfOf`.
 */
import { PLATFORM_IDS } from "@/lib/constants"
import { translator, type UiLang } from "@/lib/i18n/core"
import type { ContentIdea, ContentItem, ContentRepurpose, Database, ID, PerformanceTier, PlatformId } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { treeMessages } from "./messages"
import { isPendingSuggestion } from "./repurpose-model"

export interface TreePerf {
  published: boolean
  /** Winner-detection tier; null when unpublished or unmeasured. */
  tier: PerformanceTier | null
  /** Value ÷ platform baseline (null below the minimum sample). */
  ratio: number | null
  /** Latest snapshot views; null when no analytics were logged. */
  views: number | null
}

export interface TreeIdeaNode {
  kind: "idea"
  id: ID
  depth: number
  idea: ContentIdea
  children: TreeNode[]
}

export interface TreeItemNode {
  kind: "item"
  id: ID
  depth: number
  item: ContentItem
  perf: TreePerf
  children: TreeNode[]
}

export interface TreeSuggestionNode {
  kind: "suggestion"
  id: ID
  depth: number
  row: ContentRepurpose
  sourceId: ID
  children: TreeNode[]
}

export type TreeNode = TreeIdeaNode | TreeItemNode | TreeSuggestionNode

export interface TreeSummary {
  /** Content items in the tree (the idea and suggestions excluded). */
  assets: number
  platforms: PlatformId[]
  published: number
  /** Sum of latest-snapshot views over measured items. */
  views: number
  measured: number
  /** Suggestions not created yet. */
  pending: number
  /** Deepest level (root = 0). */
  depth: number
}

export interface ContentTreeModel {
  root: TreeIdeaNode | TreeItemNode
  /** The original idea; null when the family was never linked to one. */
  idea: ContentIdea | null
  /** The item the tree was opened from, when it is part of the tree. */
  currentId: ID | null
  summary: TreeSummary
}

const platformIndex = (p: PlatformId) => {
  const i = PLATFORM_IDS.indexOf(p)
  return i === -1 ? PLATFORM_IDS.length : i
}

const byCreated = (a: ContentItem, b: ContentItem) =>
  a.created_at.localeCompare(b.created_at) || platformIndex(a.platform) - platformIndex(b.platform) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function pushUnique<V>(map: Map<ID, V[]>, key: ID, value: V) {
  const list = map.get(key)
  if (!list) map.set(key, [value])
  else if (!list.includes(value)) list.push(value)
}

export function buildContentTree(
  db: Pick<Database, "content_items" | "content_ideas" | "content_repurposing">,
  start: { itemId?: ID | null; ideaId?: ID | null },
  perfOf: (item: ContentItem) => TreePerf
): ContentTreeModel | null {
  const items = new Map(db.content_items.map((i) => [i.id, i]))
  const ideas = new Map(db.content_ideas.map((i) => [i.id, i]))
  const hasParent = (item: ContentItem) => Boolean(item.parent_id && item.parent_id !== item.id && items.has(item.parent_id))

  const childIds = new Map<ID, ID[]>()
  for (const item of db.content_items) if (item.parent_id && hasParent(item)) pushUnique(childIds, item.parent_id, item.id)
  for (const r of db.content_repurposing) {
    const target = r.target_item_id ? items.get(r.target_item_id) : undefined
    // parent_id wins; a created row only links targets that lost (or never had) their parent.
    if (target && target.id !== r.source_item_id && items.has(r.source_item_id) && !hasParent(target)) {
      pushUnique(childIds, r.source_item_id, target.id)
    }
  }
  const pending = new Map<ID, ContentRepurpose[]>()
  for (const r of db.content_repurposing) if (isPendingSuggestion(r) && items.has(r.source_item_id)) pushUnique(pending, r.source_item_id, r)

  const startItem = start.itemId ? items.get(start.itemId) : undefined
  let idea = start.ideaId ? (ideas.get(start.ideaId) ?? null) : null
  let top: ContentItem | null = null
  if (startItem) {
    const chain = [startItem]
    const seen = new Set([startItem.id])
    let current = startItem
    while (current.parent_id) {
      const parent = items.get(current.parent_id)
      if (!parent || seen.has(parent.id)) break
      chain.push(parent)
      seen.add(parent.id)
      current = parent
    }
    top = current
    if (!idea) {
      const linked = [...chain].reverse().find((i) => i.idea_id && ideas.has(i.idea_id))
      idea = linked?.idea_id ? (ideas.get(linked.idea_id) ?? null) : null
    }
  }
  if (!top && !idea) return null

  const visited = new Set<ID>()
  const platforms = new Set<PlatformId>()
  const summary: TreeSummary = { assets: 0, platforms: [], published: 0, views: 0, measured: 0, pending: 0, depth: 0 }

  const buildItem = (item: ContentItem, depth: number): TreeItemNode => {
    visited.add(item.id)
    const perf = perfOf(item)
    summary.assets++
    platforms.add(item.platform)
    if (perf.published) summary.published++
    if (perf.views !== null) {
      summary.views += perf.views
      summary.measured++
    }
    summary.depth = Math.max(summary.depth, depth)

    const children: TreeNode[] = []
    const kids = (childIds.get(item.id) ?? [])
      .map((id) => items.get(id))
      .filter((c): c is ContentItem => Boolean(c))
      .sort(byCreated)
    for (const child of kids) if (!visited.has(child.id)) children.push(buildItem(child, depth + 1))
    const suggestions = [...(pending.get(item.id) ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
    for (const row of suggestions) {
      children.push({ kind: "suggestion", id: row.id, depth: depth + 1, row, sourceId: item.id, children: [] })
      summary.pending++
      summary.depth = Math.max(summary.depth, depth + 1)
    }
    return { kind: "item", id: item.id, depth, item, perf, children }
  }

  let root: TreeIdeaNode | TreeItemNode
  if (idea) {
    const ideaId = idea.id
    const own = db.content_items.filter((i) => i.idea_id === ideaId).sort(byCreated)
    const primary = own.filter((i) => !hasParent(i))
    if (top && top.idea_id === null && !primary.includes(top)) primary.unshift(top)
    const children: TreeNode[] = []
    // Items whose parent sits in another family still belong to this idea: they become extra roots.
    for (const item of [...primary, ...own]) if (!visited.has(item.id)) children.push(buildItem(item, 1))
    root = { kind: "idea", id: ideaId, depth: 0, idea, children }
  } else {
    root = buildItem(top as ContentItem, 0)
  }

  summary.platforms = PLATFORM_IDS.filter((p) => platforms.has(p))
  return { root, idea, currentId: startItem && visited.has(startItem.id) ? startItem.id : null, summary }
}

/** "1 idea → 7 assets across 5 platforms" (or "1 post → …" for a family without an idea). */
export function treeHeadline(model: ContentTreeModel, lang: UiLang = "en"): string {
  const t = translator(treeMessages, lang)
  const origin = model.idea ? t("origin_idea") : t("origin_post")
  const { assets, platforms } = model.summary
  if (!assets) return t("headline_empty", { origin })
  return t("headline", {
    origin,
    assets: t.plural("assets", assets, { count: formatNumber(assets) }),
    platforms: t.plural("platforms", platforms.length, { count: formatNumber(platforms.length) }),
  })
}

/** Depth-first list of every node (root first) — used by the indented list and tests. */
export function flattenTree(root: TreeNode): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (node: TreeNode) => {
    out.push(node)
    node.children.forEach(walk)
  }
  walk(root)
  return out
}
