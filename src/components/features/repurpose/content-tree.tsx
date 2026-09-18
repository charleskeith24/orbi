"use client"

import { Lightbulb, SearchX, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { EmptyState, PlatformIcon } from "@/components/common"
import { Button } from "@/components/ui/button"
import { computeTiers, isPublishedItem, latestMetricsByItem } from "@/lib/analytics"
import { useT, useUiLang } from "@/lib/i18n"
import { useDb, useLookup, useSettings } from "@/lib/store"
import type { ID } from "@/lib/types"
import { cn, formatCompact, formatNumber } from "@/lib/utils"
import { treeMessages } from "./messages"
import { buildContentTree, treeHeadline, type ContentTreeModel, type TreeNode } from "./tree-model"
import { NODE_H, TreeNodeCard, TreeRow, type TreeContext } from "./tree-node"

// Props are a contract used by the Content Studio and the Winning Content Library — do not change them.
export interface ContentTreeProps {
  /** Any content item in the tree (the root idea is resolved automatically). */
  itemId?: ID
  /** Or start from an idea. */
  ideaId?: ID
}

/** Connector length on each side of a parent → child link, and the gap between sibling rows. */
const GAP = 18
const ROW_GAP = 10
const LINE = "border-muted-foreground/35"
const DASH = "border-dashed border-muted-foreground/50"

/** Layered layout: node, then its children stacked to the right, joined by hairline connectors. */
function Branch({ node, ctx }: { node: TreeNode; ctx: TreeContext }) {
  const { children } = node
  const onlySuggestion = children.length === 1 && children[0].kind === "suggestion"
  return (
    <div className="flex items-start">
      <TreeNodeCard node={node} ctx={ctx} />
      {children.length ? (
        <div className="flex items-start">
          <span aria-hidden className={cn("block shrink-0 border-t", onlySuggestion ? DASH : LINE)} style={{ width: GAP, marginTop: NODE_H / 2 }} />
          <ul className="flex flex-col">
            {children.map((child, index) => {
              const first = index === 0
              const last = index === children.length - 1
              const top = first ? 0 : ROW_GAP
              const center = top + NODE_H / 2
              return (
                <li key={child.id} className="relative flex" style={{ paddingTop: top, paddingLeft: GAP }}>
                  {children.length > 1 ? (
                    <span
                      aria-hidden
                      className={cn("absolute left-0 border-l", LINE)}
                      style={first ? { top: center, bottom: 0 } : last ? { top: 0, height: center } : { top: 0, bottom: 0 }}
                    />
                  ) : null}
                  <span aria-hidden className={cn("absolute left-0 border-t", child.kind === "suggestion" ? DASH : LINE)} style={{ top: center, width: GAP }} />
                  <Branch node={child} ctx={ctx} />
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** Indented layout for narrow containers (mobile, sheets). */
function ListBranch({ node, ctx }: { node: TreeNode; ctx: TreeContext }) {
  return (
    <li className="min-w-0">
      <TreeRow node={node} ctx={ctx} />
      {node.children.length ? (
        <ul className="ml-5 flex min-w-0 flex-col gap-0.5 border-l border-muted-foreground/25 pl-2">
          {node.children.map((child) => (
            <ListBranch key={child.id} node={child} ctx={ctx} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function TreeSummaryLine({ model }: { model: ContentTreeModel }) {
  const t = useT(treeMessages)
  const lang = useUiLang()
  const { summary } = model
  const stats = [
    t("published_count", { count: formatNumber(summary.published) }),
    summary.measured ? t("views", { count: formatCompact(summary.views) }) : null,
    summary.pending ? t.plural("pending", summary.pending, { count: formatNumber(summary.pending) }) : null,
  ].filter(Boolean)
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="text-sm leading-6 font-medium text-balance">{treeHeadline(model, lang)}</p>
        <p className="text-xs text-muted-foreground num">{stats.join(" · ")}</p>
      </div>
      {summary.platforms.length ? (
        <ul className="flex items-center gap-1.5 text-muted-foreground" aria-label={t("platforms_label")}>
          {summary.platforms.map((p) => (
            <li key={p} className="flex">
              <PlatformIcon platform={p} label className="size-4" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function TreeLegend({ pending }: { pending: boolean }) {
  const t = useT(treeMessages)
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-3 w-4 rounded-[3px] border bg-card" />
        {t("legend_item")}
      </span>
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-4 rounded-[3px] border border-dashed border-muted-foreground/60" />
          {t("legend_suggested")}
        </span>
      ) : null}
      <span>{t("legend_select")}</span>
    </p>
  )
}

/** Content Tree (spec §24): how one idea became many assets across platforms. */
export function ContentTree({ itemId, ideaId }: ContentTreeProps) {
  const t = useT(treeMessages)
  const db = useDb()
  const settings = useSettings()
  const formats = useLookup("content_formats")
  const [now] = useState(() => new Date())

  const model = useMemo(() => {
    const tiers = computeTiers(db, settings, now)
    const latest = latestMetricsByItem(db)
    return buildContentTree(db, { itemId, ideaId }, (item) => {
      const published = isPublishedItem(item)
      const info = published ? tiers.get(item.id) : undefined
      return { published, tier: info?.tier ?? null, ratio: info?.ratio ?? null, views: latest.get(item.id)?.views ?? null }
    })
  }, [db, settings, now, itemId, ideaId])
  const currentId = model?.currentId ?? null
  const ctx = useMemo<TreeContext>(() => ({ formats, currentId }), [formats, currentId])
  const scrollerRef = useRef<HTMLDivElement>(null)

  // A wide tree scrolls sideways: bring the node it was opened from into view once.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return
    const target = scroller.querySelector<HTMLElement>('[aria-current="true"]')
    if (!target) return
    const left = target.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft
    scroller.scrollLeft = Math.max(0, left - (scroller.clientWidth - target.offsetWidth) / 2)
  }, [currentId])

  if (!model) {
    return (
      <EmptyState
        icon={SearchX}
        title={t("empty_title")}
        description={t("empty_description")}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/studio">{t("open_studio")}</Link>
          </Button>
        }
      />
    )
  }

  const { summary } = model
  const firstItem = model.root.kind === "item" ? model.root : model.root.children.find((c) => c.kind === "item")
  const lonely = summary.assets === 1 && !summary.pending

  return (
    <div className="@container flex min-w-0 flex-col gap-3">
      <TreeSummaryLine model={model} />

      <div className="hidden min-w-0 @3xl:block">
        <div ref={scrollerRef} className="overflow-x-auto rounded-lg border bg-muted/25 dark:bg-input/10">
          <ul className="w-max p-4" aria-label={t("tree_label")}>
            <li>
              <Branch node={model.root} ctx={ctx} />
            </li>
          </ul>
        </div>
      </div>
      <ul className="min-w-0 rounded-lg border bg-card p-1.5 @3xl:hidden" aria-label={t("tree_label")}>
        <ListBranch node={model.root} ctx={ctx} />
      </ul>

      {model.idea && !summary.assets ? (
        <EmptyState
          compact
          icon={Lightbulb}
          title={t("idea_empty_title")}
          description={t("idea_empty_description")}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={`/ideas?open=${model.idea.id}`}>{t("open_in_idea_bank")}</Link>
            </Button>
          }
        />
      ) : lonely && firstItem ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2.5">
          <p className="min-w-0 flex-1 basis-64 text-xs text-pretty text-muted-foreground">
            {t("lonely")}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href={`/studio/${firstItem.id}?tab=repurpose`}>
              <Sparkles className="text-brand" aria-hidden />
              {t("repurpose")}
            </Link>
          </Button>
        </div>
      ) : null}

      <TreeLegend pending={summary.pending > 0} />
    </div>
  )
}
