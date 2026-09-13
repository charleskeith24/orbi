"use client"

import { Lightbulb } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { CheckboxIndicator, ChipToggleGroup, ColorDot, EmptyState, IdeaStatusBadge, PlatformIcon, SearchInput } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLookup, useTable } from "@/lib/store"
import type { ContentIdea, ID, IdeaStatus } from "@/lib/types"
import { cn, matchesQuery, pluralize } from "@/lib/utils"

/** Open ideas, most committed first. */
const STATUS_RANK: Partial<Record<IdeaStatus, number>> = { selected: 0, validated: 1, researching: 2, inbox: 3 }
const MAX_ROWS = 120

/** Pick any open ideas from the Idea Bank for the week's plan. */
export function IdeaBankPicker({
  open,
  onOpenChange,
  excludeIds,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ideas already in the plan. */
  excludeIds: Set<ID>
  onAdd: (ideas: ContentIdea[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        {open ? (
          <PickerBody
            excludeIds={excludeIds}
            onCancel={() => onOpenChange(false)}
            onAdd={(ideas) => {
              onAdd(ideas)
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function PickerBody({ excludeIds, onCancel, onAdd }: { excludeIds: Set<ID>; onCancel: () => void; onAdd: (ideas: ContentIdea[]) => void }) {
  const ideas = useTable("content_ideas")
  const pillars = useLookup("content_pillars")
  const [query, setQuery] = useState("")
  const [pillar, setPillar] = useState<string | null>(null)
  const [selected, setSelected] = useState<ID[]>([])

  const rows = useMemo(
    () =>
      ideas
        .filter((i) => STATUS_RANK[i.status] !== undefined && !excludeIds.has(i.id))
        .filter((i) => !pillar || i.pillar_id === pillar)
        .filter((i) => matchesQuery(query, i.title, i.hook, i.core_topic))
        .sort(
          (a, b) =>
            (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || (b.score ?? -1) - (a.score ?? -1) || b.created_at.localeCompare(a.created_at)
        ),
    [ideas, excludeIds, pillar, query]
  )
  const pillarOptions = useMemo(
    () =>
      [...pillars.values()]
        .filter((p) => p.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({ value: p.id, label: p.name || "Untitled pillar", color: p.color })),
    [pillars]
  )
  const toggle = (id: ID) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

  return (
    <div className="grid min-w-0 gap-4">
      <DialogHeader>
        <DialogTitle>Add from the Idea Bank</DialogTitle>
        <DialogDescription>Open ideas — selected and validated first, then by Idea Score.</DialogDescription>
      </DialogHeader>
      <div className="grid min-w-0 gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search ideas…" className="sm:w-full" />
        {pillarOptions.length ? <ChipToggleGroup options={pillarOptions} value={pillar} onChange={setPillar} size="xs" aria-label="Filter by pillar" /> : null}
      </div>
      {rows.length ? (
        <div role="group" aria-label="Open ideas" className="max-h-[min(24rem,45svh)] divide-y overflow-y-auto rounded-lg border scrollbar-thin">
          {rows.slice(0, MAX_ROWS).map((idea) => {
            const checked = selected.includes(idea.id)
            const ideaPillar = idea.pillar_id ? pillars.get(idea.pillar_id) : undefined
            return (
              <button
                key={idea.id}
                type="button"
                aria-pressed={checked}
                onClick={() => toggle(idea.id)}
                className={cn(
                  "flex w-full min-w-0 items-start gap-3 px-3 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  checked && "bg-brand-soft hover:bg-brand-soft"
                )}
              >
                <CheckboxIndicator checked={checked} className="mt-0.5" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-1 text-sm font-medium">{idea.title.trim() || "Untitled idea"}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                    <IdeaStatusBadge status={idea.status} />
                    {ideaPillar ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ColorDot color={ideaPillar.color} />
                        {ideaPillar.name}
                      </span>
                    ) : null}
                    {idea.score !== null ? <span className="num">Idea Score {Math.round(idea.score)}</span> : null}
                    {idea.platforms.length ? (
                      <span className="inline-flex items-center gap-1">
                        {idea.platforms.map((p) => (
                          <PlatformIcon key={p} platform={p} label className="size-3.5" />
                        ))}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <EmptyState
          compact
          icon={Lightbulb}
          title="No open ideas match"
          description="Capture or generate ideas, then plan them into the week."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/ideas/generator">Open the Idea Generator</Link>
            </Button>
          }
          className="rounded-lg border border-dashed"
        />
      )}
      <DialogFooter className="items-center">
        <span className="mr-auto text-xs text-muted-foreground num">{selected.length ? `${pluralize(selected.length, "idea")} selected` : "Nothing selected"}</span>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={!selected.length} onClick={() => onAdd(ideas.filter((i) => selected.includes(i.id)))}>
          {selected.length > 1 ? `Add ${selected.length} ideas` : "Add idea"}
        </Button>
      </DialogFooter>
    </div>
  )
}
