"use client"

import { useMemo } from "react"
import { ColorDot, IdeaStatusBadge, keywordFilter, PillarBadge, PlatformIcon, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { ContentIdea, ContentPillar, ID, IdeaStatus } from "@/lib/types"

const READY: IdeaStatus[] = ["validated", "selected"]
const OPEN: IdeaStatus[] = ["inbox", "researching"]

const titleOf = (idea: Pick<ContentIdea, "title">) => idea.title.trim() || "Untitled idea"
const byScore = (a: ContentIdea, b: ContentIdea) => (b.score ?? -1) - (a.score ?? -1) || b.updated_at.localeCompare(a.updated_at)

/** Searchable Idea Bank: validated and selected ideas first (highest Idea Score first), then the inbox, then converted ones. */
export function IdeaPicker({
  ideas,
  pillars,
  onSelect,
}: {
  ideas: ContentIdea[]
  pillars: Map<ID, ContentPillar>
  onSelect: (id: ID) => void
}) {
  const groups = useMemo(
    () =>
      [
        { heading: "Ready to produce", rows: ideas.filter((i) => READY.includes(i.status)).sort(byScore) },
        { heading: "Inbox & researching", rows: ideas.filter((i) => OPEN.includes(i.status)).sort(byScore) },
        {
          heading: "Already converted",
          rows: ideas.filter((i) => i.status === "converted").sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
        },
      ].filter((group) => group.rows.length),
    [ideas]
  )

  return (
    <Command filter={keywordFilter} label="Choose an idea" className="rounded-lg border bg-card dark:bg-input/20">
      <CommandInput autoFocus placeholder="Search your Idea Bank…" />
      <CommandList className="max-h-[min(20rem,48dvh)]">
        <CommandEmpty>No ideas match.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.rows.map((idea) => {
              const pillar = idea.pillar_id ? pillars.get(idea.pillar_id) : undefined
              return (
                <CommandItem
                  key={idea.id}
                  value={idea.id}
                  keywords={[idea.title, idea.core_topic, pillar?.name ?? ""].filter(Boolean)}
                  onSelect={() => onSelect(idea.id)}
                  className="gap-2.5"
                >
                  <ColorDot color={pillar?.color ?? "gray"} />
                  <span className="min-w-0 flex-1 truncate">{titleOf(idea)}</span>
                  {idea.platforms.length ? (
                    <span className="hidden shrink-0 items-center gap-1 text-muted-foreground sm:flex">
                      {idea.platforms.slice(0, 3).map((platform) => (
                        <PlatformIcon key={platform} platform={platform} className="size-3.5" />
                      ))}
                    </span>
                  ) : null}
                  <span className="w-7 shrink-0 text-right text-xs text-muted-foreground num" title="Idea Score">
                    {idea.score ?? "—"}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}

/** The chosen idea: status, pillar, Idea Score and hook. */
export function SelectedIdea({ idea, onChange }: { idea: ContentIdea; onChange: () => void }) {
  const hook = idea.hook.trim()
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-muted/25 p-3 dark:bg-muted/15">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-medium text-pretty">{titleOf(idea)}</p>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
          <IdeaStatusBadge status={idea.status} />
          <PillarBadge pillarId={idea.pillar_id} />
          {idea.score !== null ? (
            <Token title="Idea Score">
              Score <span className="num">{idea.score}</span>
            </Token>
          ) : null}
        </div>
        {hook ? <p className="mt-2 line-clamp-2 text-xs text-pretty text-muted-foreground">“{hook}”</p> : null}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onChange}>
        Change
      </Button>
    </div>
  )
}
