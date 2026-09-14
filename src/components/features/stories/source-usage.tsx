"use client"

import { Lightbulb } from "lucide-react"
import Link from "next/link"
import { EmptyState, IdeaStatusBadge, PlatformIcon, StageBadge } from "@/components/common"
import { PLATFORMS } from "@/lib/constants"
import { formatNumber } from "@/lib/utils"
import type { SourceUsage } from "./story-model"

/** Ideas citing a story or reference (`source_ref_id`) and the content made from them, with links. */
export function SourceUsageList({
  usage,
  noun,
  emptyAction,
}: {
  usage: SourceUsage | undefined
  noun: "story" | "reference"
  emptyAction?: React.ReactNode
}) {
  const ideas = usage?.ideas ?? []
  const items = usage?.items ?? []
  if (!ideas.length) {
    return (
      <EmptyState
        compact
        icon={Lightbulb}
        title="Not used yet"
        description={`Ideas you create from this ${noun} show up here, together with the content made from them.`}
        action={emptyAction}
        className="rounded-lg border border-dashed"
      />
    )
  }
  const sortedIdeas = [...ideas].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const sortedItems = [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <UsageGroup title="Ideas" count={ideas.length}>
        <ul className="divide-y rounded-lg border">
          {sortedIdeas.map((idea) => (
            <li key={idea.id} className="flex min-w-0 items-center gap-2 px-3 py-2">
              <Link
                href={`/ideas?open=${idea.id}`}
                title={idea.title}
                className="min-w-0 flex-1 truncate text-sm outline-none hover:underline focus-visible:underline"
              >
                {idea.title || "Untitled idea"}
              </Link>
              <IdeaStatusBadge status={idea.status} />
            </li>
          ))}
        </ul>
      </UsageGroup>
      <UsageGroup title="Content" count={items.length}>
        {sortedItems.length ? (
          <ul className="divide-y rounded-lg border">
            {sortedItems.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center gap-2 px-3 py-2">
                <PlatformIcon platform={item.platform} label={PLATFORMS[item.platform]?.label} className="size-3.5 text-muted-foreground" />
                <Link
                  href={`/studio/${item.id}`}
                  title={item.title}
                  className="min-w-0 flex-1 truncate text-sm outline-none hover:underline focus-visible:underline"
                >
                  {item.title || "Untitled content"}
                </Link>
                <StageBadge stage={item.stage} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">None of these ideas has become content yet.</p>
        )}
      </UsageGroup>
    </div>
  )
}

function UsageGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {title}
        <span className="num">{formatNumber(count)}</span>
      </h3>
      {children}
    </section>
  )
}
