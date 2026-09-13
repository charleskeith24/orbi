"use client"

import { Lightbulb } from "lucide-react"
import Link from "next/link"
import { FormatCategoryIcon, IdeaStatusBadge, PlatformIcon, StageIcon, TierBadge } from "@/components/common"
import { IDEA_STATUS_MAP, PIPELINE_STAGE_MAP, PLATFORMS, REPURPOSE_TYPES } from "@/lib/constants"
import type { ContentFormat, ContentItem, ID } from "@/lib/types"
import { cn, formatCompact } from "@/lib/utils"
import type { TreeIdeaNode, TreeItemNode, TreeNode, TreeSuggestionNode } from "./tree-model"

/** Fixed node size of the layered layout — connectors are positioned from it. */
export const NODE_W = 228
export const NODE_H = 76

export interface TreeContext {
  formats: Map<ID, ContentFormat>
  currentId: ID | null
}

const FOCUS = "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function itemTitle(item: ContentItem) {
  return item.title.trim() || "Untitled content"
}

function itemEyebrow(item: ContentItem, format: ContentFormat | undefined): string {
  const platform = PLATFORMS[item.platform]?.label ?? item.platform
  if (item.repurpose_type) return `${REPURPOSE_TYPES[item.repurpose_type]?.label ?? "Repurposed"} · ${platform}`
  return format ? `${platform} · ${format.name}` : platform
}

export function nodeHref(node: TreeNode): string {
  if (node.kind === "idea") return `/ideas?open=${node.id}`
  if (node.kind === "item") return `/studio/${node.id}`
  return `/studio/${node.sourceId}?tab=repurpose`
}

function nodeLabel(node: TreeNode, ctx: TreeContext): string {
  if (node.kind === "idea") return `Original idea: ${node.idea.title || "Untitled idea"}`
  if (node.kind === "suggestion") return `Suggested ${REPURPOSE_TYPES[node.row.type].label}, not created yet: ${node.row.title}`
  const current = node.id === ctx.currentId ? " (current)" : ""
  return `${itemTitle(node.item)} — ${itemEyebrow(node.item, ctx.formats.get(node.item.format_id ?? ""))}, ${PIPELINE_STAGE_MAP[node.item.stage]?.label ?? node.item.stage}${current}`
}

/** Live items show their tier (or "Published"); items in production show their stage. */
function StageOrTier({ node }: { node: TreeItemNode }) {
  const { item, perf } = node
  const stage = PIPELINE_STAGE_MAP[item.stage]?.label ?? item.stage
  const tiered = perf.published && perf.tier !== null && perf.tier !== "normal"
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={stage}>
      <StageIcon stage={item.stage} className="size-3" />
      {tiered ? <TierBadge tier={perf.tier} /> : <span className="min-w-0 truncate">{perf.published ? "Published" : stage}</span>}
    </span>
  )
}

/* ------------------------------ Layered cards ----------------------------- */

function ItemCardBody({ node, ctx }: { node: TreeItemNode; ctx: TreeContext }) {
  const { item, perf } = node
  const format = item.format_id ? ctx.formats.get(item.format_id) : undefined
  const current = node.id === ctx.currentId
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
        <PlatformIcon platform={item.platform} className="size-3.5" />
        <FormatCategoryIcon category={format?.category} className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{itemEyebrow(item, format)}</span>
        {current ? <span className="ml-auto shrink-0 font-medium text-brand">Current</span> : null}
      </span>
      <span className="truncate text-sm leading-5 font-medium">{itemTitle(item)}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-muted-foreground">
        <StageOrTier node={node} />
        {perf.views !== null ? <span className="ml-auto shrink-0 num">{formatCompact(perf.views)} views</span> : null}
      </span>
    </>
  )
}

function IdeaCardBody({ node }: { node: TreeIdeaNode }) {
  const { idea } = node
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 font-medium tracking-wide text-muted-foreground uppercase">
        <Lightbulb className="size-3.5 shrink-0" aria-hidden />
        Original idea
      </span>
      <span className="truncate text-sm leading-5 font-medium">{idea.title || "Untitled idea"}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-muted-foreground">
        <IdeaStatusBadge status={idea.status} />
        {idea.score !== null ? <span className="shrink-0 num">Score {Math.round(idea.score)}</span> : null}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {idea.platforms.slice(0, 4).map((p) => (
            <PlatformIcon key={p} platform={p} className="size-3" />
          ))}
        </span>
      </span>
    </>
  )
}

function SuggestionCardBody({ node }: { node: TreeSuggestionNode }) {
  const spec = REPURPOSE_TYPES[node.row.type]
  const platform = node.row.platform ?? spec.platform
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
        {platform ? <PlatformIcon platform={platform} className="size-3.5" /> : null}
        <span className="min-w-0 truncate">Suggested · {spec.label}</span>
      </span>
      <span className="truncate text-sm leading-5 text-foreground/80">{node.row.title || spec.label}</span>
      <span className="flex min-w-0 items-center gap-1 text-xs leading-5 text-muted-foreground">
        <Lightbulb className="size-3 shrink-0" aria-hidden />
        Not created yet
      </span>
    </>
  )
}

/** Fixed-size node of the layered (desktop) tree. The whole card is the link. */
export function TreeNodeCard({ node, ctx }: { node: TreeNode; ctx: TreeContext }) {
  const current = node.id === ctx.currentId
  return (
    <Link
      href={nodeHref(node)}
      aria-label={nodeLabel(node, ctx)}
      aria-current={current ? "true" : undefined}
      title={node.kind === "suggestion" ? "Suggested — open the source's Repurpose tab to create it" : undefined}
      style={{ width: NODE_W, height: NODE_H }}
      className={cn(
        "flex shrink-0 flex-col justify-center gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-[border-color,box-shadow]",
        FOCUS,
        node.kind === "suggestion"
          ? "border-dashed border-muted-foreground/40 bg-transparent hover:border-muted-foreground/70"
          : "bg-card shadow-xs hover:border-foreground/25 hover:shadow-sm",
        node.kind === "idea" && "bg-muted/50 dark:bg-input/30",
        current && "border-brand/60 ring-2 ring-brand/25"
      )}
    >
      {node.kind === "idea" ? (
        <IdeaCardBody node={node} />
      ) : node.kind === "item" ? (
        <ItemCardBody node={node} ctx={ctx} />
      ) : (
        <SuggestionCardBody node={node} />
      )}
    </Link>
  )
}

/* ------------------------------ Indented rows ----------------------------- */

function RowGlyph({ node }: { node: TreeNode }) {
  const box = "flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground"
  if (node.kind === "idea") {
    return (
      <span className={cn(box, "bg-muted/60 dark:bg-input/30")}>
        <Lightbulb className="size-3.5" aria-hidden />
      </span>
    )
  }
  if (node.kind === "suggestion") {
    const platform = node.row.platform ?? REPURPOSE_TYPES[node.row.type].platform
    return (
      <span className={cn(box, "border-dashed border-muted-foreground/50")}>
        {platform ? <PlatformIcon platform={platform} className="size-3.5" /> : <Lightbulb className="size-3.5" aria-hidden />}
      </span>
    )
  }
  return (
    <span className={cn(box, "bg-card dark:bg-input/30")}>
      <PlatformIcon platform={node.item.platform} className="size-3.5" />
    </span>
  )
}

/** Compact row of the indented (mobile / narrow) tree. */
export function TreeRow({ node, ctx }: { node: TreeNode; ctx: TreeContext }) {
  const current = node.id === ctx.currentId
  let title: string
  let meta: React.ReactNode
  if (node.kind === "idea") {
    title = node.idea.title || "Untitled idea"
    meta = (
      <>
        <span>Original idea</span>
        <span aria-hidden>·</span>
        <span>{IDEA_STATUS_MAP[node.idea.status]?.label ?? node.idea.status}</span>
      </>
    )
  } else if (node.kind === "suggestion") {
    title = node.row.title || REPURPOSE_TYPES[node.row.type].label
    meta = <span>Suggested · {REPURPOSE_TYPES[node.row.type].label} · not created yet</span>
  } else {
    const format = node.item.format_id ? ctx.formats.get(node.item.format_id) : undefined
    title = itemTitle(node.item)
    meta = (
      <>
        <span className="min-w-0 truncate">{itemEyebrow(node.item, format)}</span>
        <StageOrTier node={node} />
        {node.perf.views !== null ? <span className="shrink-0 num">{formatCompact(node.perf.views)} views</span> : null}
      </>
    )
  }
  return (
    <Link
      href={nodeHref(node)}
      aria-label={nodeLabel(node, ctx)}
      aria-current={current ? "true" : undefined}
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-muted/60",
        FOCUS,
        current && "border-brand/40 bg-brand-soft"
      )}
    >
      <RowGlyph node={node} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm leading-5", node.kind === "suggestion" ? "text-foreground/80" : "font-medium")}>
          {title}
          {current ? <span className="ml-1.5 text-xs font-medium text-brand">Current</span> : null}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-5 text-muted-foreground">{meta}</span>
      </span>
    </Link>
  )
}
