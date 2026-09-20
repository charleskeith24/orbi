"use client"

import { History } from "lucide-react"
import Link from "next/link"
import { EmptyState, SectionCard } from "@/components/common"
import { cn } from "@/lib/utils"
import type { ReviewState } from "./review-model"
import { ReviewStatusBadge } from "./review-status"

export interface HistoryEntry {
  id: string
  href: string
  label: string
  state: ReviewState
  snippet: string
  active: boolean
}

/** Saved reviews, newest first; each opens its period. */
export function ReviewHistory({
  title,
  info,
  entries,
  emptyTitle,
  emptyDescription,
  className,
}: {
  title: string
  info?: string
  entries: HistoryEntry[]
  emptyTitle: string
  emptyDescription: string
  className?: string
}) {
  return (
    <SectionCard
      title={title}
      info={info}
      icon={History}
      className={cn("print:hidden", className)}
      contentClassName={entries.length ? "px-2 pt-2 pb-2" : undefined}
    >
      {entries.length ? (
        <ul aria-label={title} className="flex max-h-[30rem] flex-col gap-0.5 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={entry.href}
                aria-current={entry.active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-col gap-1 rounded-md px-2 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
                  entry.active && "bg-muted"
                )}
              >
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium num">{entry.label}</span>
                  <ReviewStatusBadge state={entry.state} className="shrink-0" />
                </span>
                {entry.snippet ? <span className="line-clamp-2 text-xs text-pretty text-muted-foreground">{entry.snippet}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={History} title={emptyTitle} description={emptyDescription} />
      )}
    </SectionCard>
  )
}
