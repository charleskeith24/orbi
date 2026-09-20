"use client"

import { format } from "date-fns"
import { ArrowUpRight, Lightbulb, Wand2 } from "lucide-react"
import Link from "next/link"
import { IdeaStatusBadge, PillarBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { IDEA_SOURCE_MAP } from "@/lib/constants"
import { parseDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { uiActions } from "@/lib/store"
import type { ContentIdea } from "@/lib/types"
import { todayMessages } from "./messages"
import { InlineEmpty, WorkSection } from "./work-section"

function IdeaRow({ idea }: { idea: ContentIdea }) {
  const t = useT(todayMessages)
  const created = parseDate(idea.created_at)
  const title = idea.title.trim() || t("untitled_idea")
  return (
    <div className="flex min-w-0 flex-col gap-2 px-4 py-2.5 @lg/work:flex-row @lg/work:items-center @lg/work:gap-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/ideas?open=${idea.id}`}
          className="line-clamp-2 rounded-sm text-sm leading-snug font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {title}
        </Link>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          {created ? <span className="num">{format(created, "h:mm a")}</span> : null}
          <span>{IDEA_SOURCE_MAP[idea.source]?.label ?? "Manual"}</span>
          {idea.status !== "inbox" ? <IdeaStatusBadge status={idea.status} /> : null}
          {idea.pillar_id ? <PillarBadge pillarId={idea.pillar_id} variant="plain" className="text-muted-foreground" /> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {idea.status === "converted" && idea.converted_item_id ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/studio/${idea.converted_item_id}`}>
              <ArrowUpRight aria-hidden />
              {t("open_content")}
            </Link>
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "new-content", ideaId: idea.id })}>
            <Wand2 aria-hidden />
            {t("convert")}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Ideas created today, newest first — convert the strongest straight into content. */
export function IdeasTodaySection({ ideas, className }: { ideas: ContentIdea[]; className?: string }) {
  const t = useT(todayMessages)
  return (
    <WorkSection
      id="ideas-today"
      title={t("ideas_title")}
      icon={Lightbulb}
      info={t("ideas_info")}
      action={
        <Button asChild variant="ghost" size="xs" className="text-muted-foreground">
          <Link href="/ideas">Idea Bank</Link>
        </Button>
      }
      items={ideas}
      getKey={(idea) => idea.id}
      renderItem={(idea) => <IdeaRow idea={idea} />}
      className={className}
      empty={
        <InlineEmpty
          icon={Lightbulb}
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => uiActions.openDialog({ type: "quick-capture" })}>
              {t("capture_idea")}
            </Button>
          }
        >
          {t("ideas_empty")}
        </InlineEmpty>
      }
    />
  )
}
