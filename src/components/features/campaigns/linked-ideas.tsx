"use client"

import { ArrowUpRight, FilePlus2, Lightbulb } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, IdeaStatusBadge, PillarBadge, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { convertIdeaToContent, useTable } from "@/lib/store"
import type { ContentCampaign, ContentIdea } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { campaignDetailMessages } from "./messages"

const LIMIT = 8
const isOpen = (idea: ContentIdea) => idea.status !== "converted" && idea.status !== "archived"

/** Ideas whose `campaign_id` is this campaign; open ones can be turned into campaign content in one click. */
export function LinkedIdeas({ campaign, className }: { campaign: ContentCampaign; className?: string }) {
  const router = useRouter()
  const t = useT(campaignDetailMessages)
  const c = useT(commonMessages)
  const ideas = useTable("content_ideas")
  const [expanded, setExpanded] = useState(false)

  const linked = useMemo(
    () =>
      ideas
        .filter((i) => i.campaign_id === campaign.id)
        .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (b.score ?? -1) - (a.score ?? -1) || a.title.localeCompare(b.title)),
    [ideas, campaign.id]
  )
  const open = linked.filter(isOpen).length
  const shown = expanded ? linked : linked.slice(0, LIMIT)

  function convert(idea: ContentIdea) {
    const created = convertIdeaToContent(idea.id, { campaign_id: campaign.id })
    const first = created[0]
    toast.success(t.plural("created_pieces", created.length, { count: formatNumber(created.length) }), {
      description: idea.title,
      action: first ? { label: c("open"), onClick: () => router.push(`/studio/${first.id}`) } : undefined,
    })
  }

  return (
    <SectionCard
      className={className}
      title={t("linked_ideas")}
      description={linked.length ? t("linked_description", { open, closed: linked.length - open }) : t("linked_backlog")}
      action={
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/ideas">
            Idea Bank
            <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      }
      contentClassName="p-0 pt-2"
    >
      {linked.length ? (
        <>
          <ul className="divide-y">
            {shown.map((idea) => (
              <li key={idea.id} className="flex min-w-0 items-start gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/ideas?open=${idea.id}`}
                    className="line-clamp-2 text-sm leading-snug outline-none hover:underline focus-visible:underline"
                  >
                    {idea.title || t("untitled_idea")}
                  </Link>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                    <IdeaStatusBadge status={idea.status} />
                    <PillarBadge pillarId={idea.pillar_id} variant="plain" className="min-w-0" />
                    {idea.score !== null ? (
                      <span className="text-xs text-muted-foreground num" title="Idea Score">
                        {idea.score}
                      </span>
                    ) : null}
                  </div>
                </div>
                {isOpen(idea) ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="-mr-1 text-muted-foreground"
                        aria-label={t("create_from_aria", { title: idea.title || t("idea_lower") })}
                        onClick={() => convert(idea)}
                      >
                        <FilePlus2 aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("create_content")}</TooltipContent>
                  </Tooltip>
                ) : idea.converted_item_id ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" className="-mr-1 text-muted-foreground" asChild>
                        <Link href={`/studio/${idea.converted_item_id}`} aria-label={t("open_made_from", { title: idea.title })}>
                          <ArrowUpRight aria-hidden />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("open_content")}</TooltipContent>
                  </Tooltip>
                ) : null}
              </li>
            ))}
          </ul>
          {linked.length > LIMIT ? (
            <div className="border-t px-2 py-1.5">
              <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
                {expanded ? c("show_less") : t("show_all", { count: linked.length })}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          compact
          icon={Lightbulb}
          title={t("no_linked_ideas")}
          description={t("no_linked_description")}
        />
      )}
    </SectionCard>
  )
}
