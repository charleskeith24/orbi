"use client"

import { differenceInCalendarDays } from "date-fns"
import { Archive, ArchiveRestore, ExternalLink, FilePlus2 } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import { DetailSheet, FormField, IdeaStatusSelect, InlineText, PrioritySelect } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IDEA_SOURCE_MAP, IDEA_STATUS_MAP } from "@/lib/constants"
import { formatDate, parseDate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { translate, type UiLang } from "@/lib/i18n/core"
import { dataActions } from "@/lib/store"
import type { ContentIdea, IdeaStatus } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { useIdeaActions } from "./idea-actions"
import { IdeaActionsMenu } from "./idea-actions-menu"
import { IdeaScoreBadge } from "./idea-badges"
import { ideaDetailMessages } from "./idea-detail-messages"
import { IdeaFields } from "./idea-fields"
import { IdeaRelated, useRelatedCount } from "./idea-related"
import { IdeaScorePanel } from "./idea-score-panel"

type SheetTab = "details" | "score" | "related"

function capturedPhrase(value: string, now: Date, lang: UiLang): string {
  const date = parseDate(value)
  if (!date) return ""
  const days = differenceInCalendarDays(now, date)
  if (days <= 0) return translate(ideaDetailMessages, lang, "captured_today")
  if (days === 1) return translate(ideaDetailMessages, lang, "captured_yesterday")
  if (days <= 14) return translate(ideaDetailMessages, lang, "captured_days_ago", { count: days })
  return translate(ideaDetailMessages, lang, "captured_on", { date: formatDate(date, "MMM d") })
}

/** `/ideas?open=<id>` — edit every field, score the idea, convert it, see what came from it. */
export function IdeaDetailSheet({
  idea,
  open,
  now,
  onOpenChange,
}: {
  idea: ContentIdea | null
  open: boolean
  now: Date
  onOpenChange: (open: boolean) => void
}) {
  const t = useT(ideaDetailMessages)
  const lang = useUiLang()
  if (!idea) return null
  const source = IDEA_SOURCE_MAP[idea.source]?.label ?? "Manual"
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={
        <InlineText
          value={idea.title}
          required
          maxLength={300}
          placeholder={t("untitled_idea")}
          aria-label={t("title_label")}
          className="text-base leading-6 font-semibold"
          onSave={(title) => dataActions.update("content_ideas", idea.id, { title })}
        />
      }
      description={t("sheet_description", {
        status: IDEA_STATUS_MAP[idea.status]?.label ?? idea.status,
        source,
        captured: capturedPhrase(idea.created_at, now, lang),
      })}
      actions={<IdeaActionsMenu idea={idea} showOpen={false} className="size-7" />}
      footer={<SheetFooter idea={idea} />}
    >
      <SheetBody key={idea.id} idea={idea} now={now} />
    </DetailSheet>
  )
}

function SheetBody({ idea, now }: { idea: ContentIdea; now: Date }) {
  const id = useId()
  const actions = useIdeaActions()
  const t = useT(ideaDetailMessages)
  const [tab, setTab] = useState<SheetTab>("details")
  const relatedCount = useRelatedCount(idea)

  function changeStatus(next: IdeaStatus | null) {
    if (!next || next === idea.status) return
    // Converted runs the convert flow (unless the idea already has content); Archived offers Undo.
    if (next === "converted" || next === "archived") actions.setStatus([idea.id], next)
    else dataActions.update("content_ideas", idea.id, { status: next })
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <FormField label="Status" htmlFor={`${id}-status`}>
          <IdeaStatusSelect id={`${id}-status`} size="sm" value={idea.status} onChange={changeStatus} />
        </FormField>
        <FormField label="Priority" htmlFor={`${id}-priority`}>
          <PrioritySelect
            id={`${id}-priority`}
            size="sm"
            value={idea.priority}
            onChange={(priority) => {
              if (priority) dataActions.update("content_ideas", idea.id, { priority })
            }}
          />
        </FormField>
        <button
          type="button"
          onClick={() => setTab("score")}
          className="col-span-2 flex h-7 items-center justify-between gap-3 rounded-md border bg-card px-2.5 text-xs text-muted-foreground outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:col-span-1 dark:bg-input/30"
        >
          {t("idea_score")}
          <IdeaScoreBadge score={idea.score} />
        </button>
      </div>

      <Tabs value={tab} onValueChange={(next) => setTab(next as SheetTab)} className="min-w-0 gap-4">
        <TabsList>
          <TabsTrigger value="details">{t("tab_details")}</TabsTrigger>
          <TabsTrigger value="score">{t("idea_score")}</TabsTrigger>
          <TabsTrigger value="related">
            {t("tab_related")}
            {relatedCount ? <span className="text-xs text-muted-foreground num">{formatNumber(relatedCount)}</span> : null}
          </TabsTrigger>
        </TabsList>
        {/* Details and Score stay mounted so drafts, AI suggestions and hook options survive tab switches. */}
        <TabsContent value="details" forceMount className="min-w-0 data-[state=inactive]:hidden">
          <IdeaFields idea={idea} />
        </TabsContent>
        <TabsContent value="score" forceMount className="min-w-0 data-[state=inactive]:hidden">
          <IdeaScorePanel idea={idea} />
        </TabsContent>
        <TabsContent value="related" className="min-w-0">
          <IdeaRelated idea={idea} now={now} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SheetFooter({ idea }: { idea: ContentIdea }) {
  const actions = useIdeaActions()
  const t = useT(ideaDetailMessages)
  const hasContent = Boolean(idea.converted_item_id)
  return (
    <>
      {idea.status === "archived" ? (
        <Button type="button" variant="outline" size="sm" onClick={() => actions.restore([idea.id])}>
          <ArchiveRestore aria-hidden />
          {t("restore")}
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => actions.archive([idea.id])}>
          <Archive aria-hidden />
          {t("archive")}
        </Button>
      )}
      {hasContent ? (
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => actions.convert(idea.id)}>
            <FilePlus2 aria-hidden />
            {t("create_more")}
          </Button>
          <Button type="button" size="sm" asChild>
            <Link href={`/studio/${idea.converted_item_id}`}>
              <ExternalLink aria-hidden />
              {t("open_in_studio")}
            </Link>
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" onClick={() => actions.convert(idea.id)}>
          <FilePlus2 aria-hidden />
          {t("convert")}
        </Button>
      )}
    </>
  )
}
