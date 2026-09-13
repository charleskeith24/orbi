"use client"

import { Lightbulb, PackageCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ColorDot,
  EmptyState,
  FormField,
  IdeaStatusBadge,
  PlatformIcon,
  PlatformToggleGroup,
  SearchInput,
  StageBadge,
  TimeInput,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { combineDateTime, formatDate, parseDate } from "@/lib/dates"
import { convertIdeaToContent, scheduleItem, useBrand, useLookup, useTable } from "@/lib/store"
import type { ContentIdea, ContentItem, ContentPillar, IdeaStatus, PlatformId } from "@/lib/types"
import { cn, matchesQuery, pluralize, truncate } from "@/lib/utils"
import { DEFAULT_SLOT_TIME, formatSlotTime, TRAY_GROUPS, trayGroupOf, type DaySlot, type TrayGroupId } from "./calendar-model"
import { useNow } from "./use-now"

export interface FillTarget {
  day: Date
  daySlot: DaySlot
}

type FillTab = "idea" | "item"

/** Open ideas, most committed first. */
const IDEA_STATUS_RANK: Partial<Record<IdeaStatus, number>> = { selected: 0, validated: 1, researching: 2, inbox: 3 }
const TRAY_RANK: Record<TrayGroupId, number> = { ready: 0, production: 1, early: 2 }
const MAX_ROWS = 80

/**
 * Fill a posting slot: pick an idea (filtered to the slot's pillar) → one content item per platform scheduled
 * at the slot's time, or pick unscheduled content → schedule it.
 */
export function FillSlotDialog({
  target,
  open,
  nonce,
  onOpenChange,
}: {
  target: FillTarget | null
  open: boolean
  nonce: number
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open && Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        {target ? <FillSlotForm key={nonce} target={target} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function FillSlotForm({ target, onClose }: { target: FillTarget; onClose: () => void }) {
  const router = useRouter()
  const now = useNow()
  const brand = useBrand()
  const ideas = useTable("content_ideas")
  const items = useTable("content_items")
  const strategies = useTable("content_platforms")
  const pillars = useLookup("content_pillars")
  const { day, daySlot } = target
  const { slot } = daySlot
  const pillar = slot.pillar_id ? (pillars.get(slot.pillar_id) ?? null) : null
  const wanted = daySlot.missing.length ? daySlot.missing : slot.platforms

  const [tab, setTab] = useState<FillTab>("idea")
  const [query, setQuery] = useState("")
  const [matchPillar, setMatchPillar] = useState(Boolean(pillar))
  const [ideaId, setIdeaId] = useState<string | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)
  const [platforms, setPlatforms] = useState<PlatformId[] | null>(null)
  const [time, setTime] = useState<string | null>(slot.time ?? DEFAULT_SLOT_TIME)

  const platformChoices = useMemo(() => {
    const active = new Set<PlatformId>([
      ...strategies.filter((s) => s.is_active).map((s) => s.platform),
      ...brand.main_platforms,
      ...slot.platforms,
    ])
    const list = PLATFORM_IDS.filter((p) => active.has(p))
    return list.length ? list : PLATFORM_IDS
  }, [strategies, brand.main_platforms, slot.platforms])

  const ideaRows = useMemo(
    () =>
      ideas
        .filter((i) => IDEA_STATUS_RANK[i.status] !== undefined)
        .filter((i) => !matchPillar || !pillar || i.pillar_id === pillar.id)
        .filter((i) => matchesQuery(query, i.title, i.hook, i.core_topic))
        .sort(
          (a, b) =>
            (IDEA_STATUS_RANK[a.status] ?? 9) - (IDEA_STATUS_RANK[b.status] ?? 9) ||
            (b.score ?? -1) - (a.score ?? -1) ||
            b.created_at.localeCompare(a.created_at)
        ),
    [ideas, matchPillar, pillar, query]
  )

  const itemRows = useMemo(
    () =>
      items
        .map((item) => ({ item, group: trayGroupOf(item) }))
        .filter((row): row is { item: ContentItem; group: TrayGroupId } => row.group !== null)
        .filter(({ item }) => matchesQuery(query, item.title, item.hook))
        .sort(
          (a, b) =>
            TRAY_RANK[a.group] - TRAY_RANK[b.group] ||
            Number(wanted.length > 0 && !wanted.includes(a.item.platform)) - Number(wanted.length > 0 && !wanted.includes(b.item.platform)) ||
            a.item.title.localeCompare(b.item.title)
        ),
    [items, query, wanted]
  )

  const idea = ideaId ? ideas.find((i) => i.id === ideaId) : undefined
  const item = itemId ? items.find((i) => i.id === itemId) : undefined
  const ideaPlatforms = platforms ?? (wanted.length ? wanted : idea?.platforms.length ? idea.platforms : platformChoices.slice(0, 1))
  const at = time ? parseDate(combineDateTime(day, time)) : null
  const timeError = !at ? "Pick a time." : at.getTime() <= now.getTime() ? "That time has already passed — pick a later one." : null
  const selectionError = tab === "idea" ? (idea ? (ideaPlatforms.length ? null : "Pick at least one platform.") : "Pick an idea.") : item ? null : "Pick a piece of content."
  const canSubmit = !timeError && !selectionError
  const when = at ? formatDate(at, "EEE, MMM d · h:mm a") : ""
  const label = slot.label.trim() || pillar?.name || "Posting slot"

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || !at) return
    if (tab === "idea" && idea) {
      const created = convertIdeaToContent(idea.id, { platforms: ideaPlatforms, scheduled_at: at.toISOString() })
      const first = created[0]
      toast.success(`${pluralize(created.length, "post")} scheduled for ${when}`, {
        description: truncate(idea.title, 90),
        action: first ? { label: "Open", onClick: () => router.push(`/studio/${first.id}`) } : undefined,
      })
    } else if (tab === "item" && item) {
      scheduleItem(item.id, at.toISOString())
      toast.success(`Scheduled for ${when}`, {
        description: truncate(item.title, 90),
        action: { label: "Open", onClick: () => router.push(`/studio/${item.id}`) },
      })
    }
    onClose()
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Fill slot</DialogTitle>
        <DialogDescription>
          {formatDate(day, "EEEE, MMM d")} · {formatSlotTime(slot.time) ?? "Any time"} · {label}
        </DialogDescription>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {pillar ? (
            <span className="inline-flex items-center gap-1.5">
              <ColorDot color={pillar.color} />
              {pillar.name}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            {wanted.map((p) => (
              <PlatformIcon key={p} platform={p} className="size-3.5" />
            ))}
            {wanted.length ? `Needs ${wanted.map((p) => PLATFORMS[p].label).join(" + ")}` : "Any platform"}
          </span>
        </div>
      </DialogHeader>

      <Tabs value={tab} onValueChange={(value) => setTab(value as FillTab)} className="min-w-0 gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="idea">
              <Lightbulb aria-hidden />
              From an idea
            </TabsTrigger>
            <TabsTrigger value="item">
              <PackageCheck aria-hidden />
              Unscheduled content
            </TabsTrigger>
          </TabsList>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={tab === "idea" ? "Search ideas…" : "Search content…"}
            className="sm:ml-auto sm:w-48"
          />
        </div>

        <TabsContent value="idea" className="grid min-w-0 gap-2">
          {pillar ? (
            <div className="flex items-center gap-2">
              <Switch id="fill-match-pillar" size="sm" checked={matchPillar} onCheckedChange={setMatchPillar} />
              <Label htmlFor="fill-match-pillar" className="text-xs font-normal text-muted-foreground">
                Only {pillar.name} ideas
              </Label>
            </div>
          ) : null}
          {ideaRows.length ? (
            <OptionList label="Ideas">
              {ideaRows.slice(0, MAX_ROWS).map((row) => (
                <IdeaOption
                  key={row.id}
                  idea={row}
                  pillar={row.pillar_id ? (pillars.get(row.pillar_id) ?? null) : null}
                  selected={row.id === ideaId}
                  onSelect={() => setIdeaId(row.id)}
                />
              ))}
            </OptionList>
          ) : (
            <EmptyState
              compact
              icon={Lightbulb}
              title={matchPillar && pillar ? `No open ${pillar.name} ideas` : "No open ideas"}
              description="Ideas that are in the inbox, researching, validated or selected can fill a slot."
              action={
                matchPillar && pillar ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setMatchPillar(false)}>
                    Show all pillars
                  </Button>
                ) : undefined
              }
              secondaryAction={
                <Button asChild size="sm" variant="ghost">
                  <Link href={pillar ? `/ideas/generator?pillar=${pillar.id}&run=1` : "/ideas/generator"}>Generate ideas</Link>
                </Button>
              }
              className="rounded-lg border border-dashed"
            />
          )}
        </TabsContent>

        <TabsContent value="item" className="grid min-w-0 gap-2">
          {itemRows.length ? (
            <OptionList label="Unscheduled content">
              {itemRows.slice(0, MAX_ROWS).map(({ item: row, group }) => (
                <ItemOption
                  key={row.id}
                  item={row}
                  group={group}
                  pillar={row.pillar_id ? (pillars.get(row.pillar_id) ?? null) : null}
                  offPlatform={wanted.length > 0 && !wanted.includes(row.platform)}
                  selected={row.id === itemId}
                  onSelect={() => setItemId(row.id)}
                />
              ))}
            </OptionList>
          ) : (
            <EmptyState
              compact
              icon={PackageCheck}
              title="Nothing unscheduled"
              description="Everything in production already has a publish date or deadline."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/pipeline">Open Pipeline</Link>
                </Button>
              }
              className="rounded-lg border border-dashed"
            />
          )}
        </TabsContent>
      </Tabs>

      <div className="grid min-w-0 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        {tab === "idea" ? (
          <FormField label="Platforms" description="One content item per platform, each with a brief.">
            <PlatformToggleGroup value={ideaPlatforms} onChange={setPlatforms} platforms={platformChoices} size="xs" />
          </FormField>
        ) : (
          <FormField label="Selected">
            <p className="min-w-0 truncate text-sm text-muted-foreground">{item ? item.title : "Pick a piece of content above"}</p>
          </FormField>
        )}
        <FormField label="Publish time" htmlFor="fill-slot-time" error={timeError}>
          <TimeInput id="fill-slot-time" value={time} onChange={setTime} />
        </FormField>
      </div>

      <DialogFooter className="items-center">
        {selectionError && !timeError ? <p className="mr-auto text-xs text-muted-foreground">{selectionError}</p> : null}
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {tab === "idea" && ideaPlatforms.length > 1 ? `Schedule ${ideaPlatforms.length} posts` : "Schedule"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function OptionList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="max-h-[min(20rem,38svh)] divide-y overflow-y-auto rounded-lg border scrollbar-thin">
      {children}
    </div>
  )
}

const OPTION_CLASS =
  "flex w-full min-w-0 flex-col gap-1 px-3 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"

function IdeaOption({ idea, pillar, selected, onSelect }: { idea: ContentIdea; pillar: ContentPillar | null; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={cn(OPTION_CLASS, selected && "bg-brand-soft hover:bg-brand-soft")}>
      <span className="line-clamp-1 text-sm font-medium">{idea.title.trim() || "Untitled idea"}</span>
      {idea.hook ? <span className="line-clamp-1 text-xs text-muted-foreground">{idea.hook}</span> : null}
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
        <IdeaStatusBadge status={idea.status} />
        {pillar ? (
          <span className="inline-flex items-center gap-1.5">
            <ColorDot color={pillar.color} />
            {pillar.name}
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
    </button>
  )
}

function ItemOption({
  item,
  group,
  pillar,
  offPlatform,
  selected,
  onSelect,
}: {
  item: ContentItem
  group: TrayGroupId
  pillar: ContentPillar | null
  offPlatform: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={cn(OPTION_CLASS, selected && "bg-brand-soft hover:bg-brand-soft")}>
      <span className="line-clamp-1 text-sm font-medium">{item.title.trim() || "Untitled content"}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
        <StageBadge stage={item.stage} />
        <span className="inline-flex items-center gap-1.5">
          <PlatformIcon platform={item.platform} className="size-3.5" />
          {PLATFORMS[item.platform].label}
          {offPlatform ? <span className="text-muted-foreground/80">· not this slot&apos;s platform</span> : null}
        </span>
        {pillar ? (
          <span className="inline-flex items-center gap-1.5">
            <ColorDot color={pillar.color} />
            {pillar.name}
          </span>
        ) : null}
        <span>{TRAY_GROUPS.find((g) => g.id === group)?.label}</span>
      </span>
    </button>
  )
}
