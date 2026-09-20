"use client"

import { BookOpen } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { EmptyState, SectionCard } from "@/components/common"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { useTable } from "@/lib/store"
import { experienceMessages } from "./experience-messages"
import { storyDay, storyTypeLabel } from "./story-model"

/** The five most recently captured stories (title and month; type and full date on hover), linking into the Story Vault. */
export function RecentStories({ className }: { className?: string }) {
  const stories = useTable("stories")
  const t = useT(experienceMessages)
  const recent = useMemo(
    () => [...stories].sort((a, b) => b.created_at.localeCompare(a.created_at) || storyDay(b).localeCompare(storyDay(a))).slice(0, 5),
    [stories]
  )
  return (
    <SectionCard
      title={t("recent_title")}
      className={className}
      contentClassName="pt-1.5 pb-2"
      action={
        <Button type="button" variant="ghost" size="xs" asChild>
          <Link href="/stories">{t("view_all")}</Link>
        </Button>
      }
    >
      {recent.length ? (
        <ul className="-mx-1.5 flex flex-col">
          {recent.map((story) => (
            <li key={story.id}>
              <Link
                href={`/stories?open=${story.id}`}
                title={`${storyTypeLabel(story.type)} · ${formatDate(storyDay(story), "MMM d, yyyy")}`}
                className="flex min-w-0 items-baseline gap-3 rounded-md px-1.5 py-1.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{story.title || t("untitled_story")}</span>
                <span className="shrink-0 text-xs text-muted-foreground num">{formatDate(storyDay(story), "MMM yyyy")}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={BookOpen} title={t("recent_empty_title")} description={t("recent_empty_description")} />
      )}
    </SectionCard>
  )
}
