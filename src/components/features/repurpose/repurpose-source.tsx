"use client"

import { CornerLeftUp, FileText, NotebookPen, Type, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { AiNotice, FormatLabel, PlatformIcon, StageBadge, TierBadge } from "@/components/common"
import { formatMultiple } from "@/lib/analytics"
import { SCRIPT_FORMATS } from "@/lib/constants"
import type { ContentItem } from "@/lib/types"
import { formatCompact, pluralize } from "@/lib/utils"
import type { SourceText } from "./repurpose-model"
import type { TreePerf } from "./tree-model"

function originCopy(source: SourceText): { icon: LucideIcon; label: string; hint?: string } {
  const words = pluralize(source.words, "word")
  switch (source.origin) {
    case "script": {
      const script = source.script
      const label = script ? `${SCRIPT_FORMATS[script.format]?.label ?? "Script"} v${script.version}` : "Script"
      return { icon: FileText, label: `${label} · ${words}` }
    }
    case "brief":
      return { icon: NotebookPen, label: `Brief · ${words}`, hint: "No script yet — drafts are built from the brief and hook." }
    case "hook":
      return { icon: Type, label: "Hook only", hint: "No script or brief yet — drafts are built from the hook and title. Add a brief for richer versions." }
    case "title":
      return { icon: Type, label: "Title only", hint: "Only a title so far — add a hook or a brief first to get drafts worth editing." }
  }
}

/** What the Repurposing Engine works from: the piece, how it performed and which text feeds the drafts. */
export function RepurposeSource({
  item,
  source,
  perf,
  parent,
}: {
  item: ContentItem
  source: SourceText
  perf: TreePerf
  parent: ContentItem | null
}) {
  const copy = originCopy(source)
  const OriginIcon = copy.icon
  const title = item.title.trim() || "Untitled content"
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 dark:bg-input/30">
          <PlatformIcon platform={item.platform} label className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Repurposing from</p>
          <p className="truncate text-sm font-medium" title={title}>
            {title}
          </p>
        </div>
        {perf.published ? <TierBadge tier={perf.tier} className="mt-0.5" /> : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <StageBadge stage={item.stage} />
        <FormatLabel formatId={item.format_id} className="max-w-48" />
        {perf.views !== null ? (
          <span className="num">{formatCompact(perf.views)} views</span>
        ) : perf.published ? (
          <span>No analytics yet</span>
        ) : null}
        {perf.ratio !== null ? (
          <span className="num" title="Compared with your recent posts on the same platform">
            {formatMultiple(perf.ratio)} vs baseline
          </span>
        ) : null}
        <span className="inline-flex min-w-0 items-center gap-1" title="The text the drafts are built from">
          <OriginIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{copy.label}</span>
        </span>
        {parent ? (
          <Link
            href={`/studio/${parent.id}`}
            className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <CornerLeftUp className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Repurposed from {parent.title.trim() || "untitled content"}</span>
          </Link>
        ) : null}
      </div>
      {copy.hint ? <AiNotice>{copy.hint}</AiNotice> : null}
      {!perf.published ? (
        <AiNotice>Not published yet — you can draft versions now, but repurposing works best once real performance shows what resonated.</AiNotice>
      ) : null}
    </div>
  )
}
