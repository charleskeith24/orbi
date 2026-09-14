"use client"

import { BookOpen } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { EmptyState, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/dates"
import { useTable } from "@/lib/store"
import { storyDay, storyTypeLabel } from "./story-model"

/** The five most recently captured stories, linking into the Story Vault. */
export function RecentStories({ className }: { className?: string }) {
  const stories = useTable("stories")
  const recent = useMemo(
    () => [...stories].sort((a, b) => b.created_at.localeCompare(a.created_at) || storyDay(b).localeCompare(storyDay(a))).slice(0, 5),
    [stories]
  )
  return (
    <SectionCard
      title="Recent stories"
      className={className}
      contentClassName="pt-1.5 pb-2"
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/stories">View all</Link>
        </Button>
      }
    >
      {recent.length ? (
        <ul className="-mx-1.5 flex flex-col">
          {recent.map((story) => (
            <li key={story.id}>
              <Link
                href={`/stories?open=${story.id}`}
                className="flex min-w-0 flex-col gap-0.5 rounded-md px-1.5 py-1.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="truncate text-sm">{story.title || "Untitled story"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {storyTypeLabel(story.type)} · {formatDate(storyDay(story), "MMM d, yyyy")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={BookOpen} title="No stories yet" description="Stories you save from here become your content memory." />
      )}
    </SectionCard>
  )
}
