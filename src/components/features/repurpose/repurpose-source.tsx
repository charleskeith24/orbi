"use client"

import { CornerLeftUp, FileText, NotebookPen, Type, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { AiNotice, FormatLabel, PlatformIcon, StageBadge, TierBadge } from "@/components/common"
import { formatMultiple } from "@/lib/analytics"
import { useT, type Translator } from "@/lib/i18n"
import { SCRIPT_FORMATS } from "@/lib/constants"
import type { ContentItem } from "@/lib/types"
import { formatCompact, formatNumber } from "@/lib/utils"
import { repurposeMessages } from "./messages"
import type { SourceText } from "./repurpose-model"
import type { TreePerf } from "./tree-model"

function originCopy(source: SourceText, t: Translator<(typeof repurposeMessages)["en"]>): { icon: LucideIcon; label: string; hint?: string } {
  const words = t.plural("words", source.words, { count: formatNumber(source.words) })
  switch (source.origin) {
    case "script": {
      const script = source.script
      const label = script ? `${SCRIPT_FORMATS[script.format]?.label ?? t("script")} v${script.version}` : t("script")
      return { icon: FileText, label: `${label} · ${words}` }
    }
    case "brief":
      return { icon: NotebookPen, label: t("brief_words", { words }), hint: t("hint_brief") }
    case "hook":
      return { icon: Type, label: t("hook_only"), hint: t("hint_hook") }
    case "title":
      return { icon: Type, label: t("title_only"), hint: t("hint_title") }
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
  const t = useT(repurposeMessages)
  const copy = originCopy(source, t)
  const OriginIcon = copy.icon
  const title = item.title.trim() || t("untitled_content")
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 dark:bg-input/30">
          <PlatformIcon platform={item.platform} label className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t("repurposing_from")}</p>
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
          <span className="num">{t("views", { count: formatCompact(perf.views) })}</span>
        ) : perf.published ? (
          <span>{t("no_analytics")}</span>
        ) : null}
        {perf.ratio !== null ? (
          <span className="num" title={t("baseline_title")}>
            {t("vs_baseline", { ratio: formatMultiple(perf.ratio) })}
          </span>
        ) : null}
        <span className="inline-flex min-w-0 items-center gap-1" title={t("source_text_title")}>
          <OriginIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{copy.label}</span>
        </span>
        {parent ? (
          <Link
            href={`/studio/${parent.id}`}
            className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <CornerLeftUp className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{t("repurposed_from", { title: parent.title.trim() || t("untitled_lower") })}</span>
          </Link>
        ) : null}
      </div>
      {copy.hint ? <AiNotice>{copy.hint}</AiNotice> : null}
      {!perf.published ? (
        <AiNotice>{t("not_published")}</AiNotice>
      ) : null}
    </div>
  )
}
