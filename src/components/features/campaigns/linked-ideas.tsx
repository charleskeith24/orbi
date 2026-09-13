"use client"

import { ArrowUpRight, FilePlus2, Lightbulb } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, IdeaStatusBadge, PillarBadge, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { convertIdeaToContent, useTable } from "@/lib/store"
import type { ContentCampaign, ContentIdea } from "@/lib/types"
import { pluralize } from "@/lib/utils"

const LIMIT = 8
const isOpen = (idea: ContentIdea) => idea.status !== "converted" && idea.status !== "archived"

/** Ideas whose `campaign_id` is this campaign; open ones can be turned into campaign content in one click. */
export function LinkedIdeas({ campaign, className }: { campaign: ContentCampaign; className?: string }) {
  const router = useRouter()
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
    toast.success(`Created ${pluralize(created.length, "content piece")}`, {
      description: idea.title,
      action: first ? { label: "Open", onClick: () => router.push(`/studio/${first.id}`) } : undefined,
    })
  }

  return (
    <SectionCard
      className={className}
      title="Linked ideas"
      description={linked.length ? `${open} open · ${linked.length - open} converted or archived` : "Backlog for this push"}
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
                    {idea.title || "Untitled idea"}
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
                        aria-label={`Create campaign content from “${idea.title || "idea"}”`}
                        onClick={() => convert(idea)}
                      >
                        <FilePlus2 aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Create campaign content</TooltipContent>
                  </Tooltip>
                ) : idea.converted_item_id ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" className="-mr-1 text-muted-foreground" asChild>
                        <Link href={`/studio/${idea.converted_item_id}`} aria-label={`Open content made from “${idea.title}”`}>
                          <ArrowUpRight aria-hidden />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open content</TooltipContent>
                  </Tooltip>
                ) : null}
              </li>
            ))}
          </ul>
          {linked.length > LIMIT ? (
            <div className="border-t px-2 py-1.5">
              <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : `Show all ${linked.length}`}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          compact
          icon={Lightbulb}
          title="No linked ideas"
          description="Set this campaign on ideas in the Idea Bank to keep the backlog for this push in one place."
        />
      )}
    </SectionCard>
  )
}
