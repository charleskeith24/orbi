"use client"

import { addDays } from "date-fns"
import { CalendarClock, Lightbulb, Plus, RotateCcw, X } from "lucide-react"
import { ColorDot, DatePicker, DateTimePicker, EmptyState, Meter, PlatformIcon, PlatformToggleGroup, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import type { ContentRecommendation } from "@/lib/analytics"
import { IDEA_STATUS_MAP, PIPELINE_STAGE_MAP, PLATFORMS } from "@/lib/constants"
import { parseDate, toISODate } from "@/lib/dates"
import type { ContentIdea, ContentItem, ContentPillar, ID, PlatformId, PostingSlot } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { pickPlatforms, plannedPostCount, type PlanEntry, type PlanPick } from "./planner-model"

const ORIGIN_LABEL: Record<PlanPick["origin"], string> = { recommended: "Recommended", bank: "Idea Bank", ai: "AI draft" }

/* -------------------------------- Validation ------------------------------- */

/** Blocking problem (error) or heads-up (warning) for one planned post. */
export function entryIssue(entry: PlanEntry, weekStart: Date, now: Date): { error: string | null; warning: string | null } {
  const at = parseDate(entry.publishAt)
  if (!at) return { error: "Pick a publish time.", warning: null }
  if (at.getTime() <= now.getTime()) return { error: "That time has already passed.", warning: null }
  if (entry.dueDate && entry.dueDate > toISODate(at)) return { error: "The due date is after publishing.", warning: null }
  if (at < weekStart || at >= addDays(weekStart, 7)) return { error: null, warning: "Outside this week" }
  return { error: null, warning: null }
}

export function deadlinesReady(picks: PlanPick[], weekStart: Date, now: Date): boolean {
  return picks.every((p) => p.entries.length > 0 && p.entries.every((e) => !entryIssue(e, weekStart, now).error))
}

function kindText(pick: PlanPick, ideas: Map<ID, ContentIdea>, items: Map<ID, ContentItem>): string {
  if (pick.source.kind === "new") return "New idea"
  if (pick.source.kind === "item") {
    const item = items.get(pick.source.itemId)
    return item ? `In production · ${PIPELINE_STAGE_MAP[item.stage]?.label ?? item.stage}` : "Content item"
  }
  const idea = ideas.get(pick.source.ideaId)
  return idea ? `${IDEA_STATUS_MAP[idea.status]?.label ?? "Open"} idea` : "Idea"
}

function PillarTag({ pillar }: { pillar: ContentPillar | undefined }) {
  if (!pillar) return <span>No pillar</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <ColorDot color={pillar.color} />
      <span className="truncate">{pillar.name}</span>
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h3>
}

/* --------------------------- Step 4 · Select ideas -------------------------- */

function PlanProgress({ planned, already, target }: { planned: number; already: number; target: number }) {
  const total = planned + already
  return (
    <div className="grid min-w-0 gap-2 rounded-lg border bg-muted/20 p-3 dark:bg-muted/10">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span>
          <span className="font-semibold num">{total}</span> <span className="text-muted-foreground">of {target} posts this week</span>
        </span>
        <span className="text-xs text-muted-foreground num">
          {planned} planned here · {already} already scheduled
        </span>
      </div>
      <Meter
        value={total}
        max={Math.max(target, total, 1)}
        target={target || undefined}
        tone={total >= target ? "good" : "brand"}
        aria-label="Posts planned against the weekly post target"
        valueText={`${total} of ${target} posts`}
      />
    </div>
  )
}

/** Step 4: recommended ideas (Content Decision Engine) + Idea Bank picks, against the weekly post target. */
export function IdeasStep({
  picks,
  recs,
  ideas,
  items,
  pillars,
  target,
  alreadyScheduled,
  aiBadge,
  onAddRecommendation,
  onOpenBank,
  onRemove,
}: {
  picks: PlanPick[]
  recs: ContentRecommendation[]
  ideas: Map<ID, ContentIdea>
  items: Map<ID, ContentItem>
  pillars: Map<ID, ContentPillar>
  target: number
  alreadyScheduled: number
  aiBadge?: React.ReactNode
  onAddRecommendation: (rec: ContentRecommendation) => void
  onOpenBank: () => void
  onRemove: (key: string) => void
}) {
  const pickedKeys = new Set(picks.map((p) => p.key))
  const available = recs.filter((r) => !pickedKeys.has(`${r.kind}:${r.id}`))
  return (
    <div className="grid min-w-0 gap-5">
      <PlanProgress planned={plannedPostCount(picks)} already={alreadyScheduled} target={target} />

      <section className="grid min-w-0 gap-2" aria-label="Your picks">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <SectionLabel>Your picks · {picks.length}</SectionLabel>
          {aiBadge}
        </div>
        {picks.length ? (
          <ul className="grid min-w-0 gap-1.5">
            {picks.map((pick) => (
              <li key={pick.key} className="flex min-w-0 items-start gap-3 rounded-md border bg-card px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{pick.title.trim() || "Untitled"}</p>
                  <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                    <Token className="font-normal text-muted-foreground">{ORIGIN_LABEL[pick.origin]}</Token>
                    <span>{kindText(pick, ideas, items)}</span>
                    <PillarTag pillar={pick.pillarId ? pillars.get(pick.pillarId) : undefined} />
                    {pick.entries.length ? (
                      <span className="inline-flex items-center gap-1">
                        {pick.entries.map((e) => (
                          <PlatformIcon key={e.platform} platform={e.platform} label className="size-3.5" />
                        ))}
                      </span>
                    ) : null}
                  </p>
                  {pick.reason ? <p className="mt-1 line-clamp-2 text-xs text-pretty text-muted-foreground">{pick.reason}</p> : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove “${pick.title}” from the plan`}
                  onClick={() => onRemove(pick.key)}
                  className="text-muted-foreground"
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-pretty text-muted-foreground">
            Add recommended ideas below, pick from the Idea Bank, or let AI draft the week. With nothing new to add, skip ahead and save the focus.
          </p>
        )}
      </section>

      <section className="grid min-w-0 gap-2" aria-label="Recommended">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <SectionLabel>Recommended</SectionLabel>
          <Button type="button" size="sm" variant="outline" onClick={onOpenBank}>
            <Lightbulb aria-hidden />
            Add from Idea Bank
          </Button>
        </div>
        <p className="text-xs text-pretty text-muted-foreground">
          Ranked by the Content Decision Engine — pillar gaps, posting slots, Idea Score, audience demand, similarity to winners, platform performance and freshness.
        </p>
        {available.length ? (
          <ul className="grid min-w-0 gap-1.5">
            {available.map((rec) => {
              const item = rec.kind === "item" ? items.get(rec.id) : undefined
              const idea = rec.kind === "idea" ? ideas.get(rec.id) : undefined
              return (
                <li key={`${rec.kind}:${rec.id}`} className="flex min-w-0 items-start gap-3 rounded-md border px-3 py-2">
                  <span
                    className="mt-0.5 flex h-6 min-w-9 shrink-0 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold num"
                    title="Decision score, 0–100"
                  >
                    {rec.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{rec.title.trim() || "Untitled"}</p>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {item
                          ? `In production · ${PIPELINE_STAGE_MAP[item.stage]?.label ?? item.stage}`
                          : `${IDEA_STATUS_MAP[idea?.status ?? "inbox"]?.label ?? "Open"} idea`}
                      </span>
                      <PillarTag pillar={rec.pillarId ? pillars.get(rec.pillarId) : undefined} />
                      <span className="inline-flex items-center gap-1">
                        <PlatformIcon platform={rec.platform} className="size-3.5" />
                        {PLATFORMS[rec.platform]?.label}
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{rec.reasons.topic}</p>
                  </div>
                  <Button type="button" size="xs" variant="outline" onClick={() => onAddRecommendation(rec)} aria-label={`Add “${rec.title}” to the plan`}>
                    <Plus aria-hidden />
                    Add
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={Lightbulb}
            title={recs.length ? "Every recommendation is in the plan" : "No open ideas to recommend"}
            description="Pick more from the Idea Bank, or generate fresh ideas for your pillars."
            className="rounded-lg border border-dashed"
          />
        )}
      </section>
    </div>
  )
}

/* ------------------------- Step 5 · Assign platforms ------------------------ */

/** Step 5: platforms per idea (one content item each); existing items keep their platform. */
export function PlatformsStep({
  picks,
  pillars,
  platformChoices,
  onChange,
  onGoToIdeas,
}: {
  picks: PlanPick[]
  pillars: Map<ID, ContentPillar>
  platformChoices: PlatformId[]
  onChange: (key: string, platforms: PlatformId[]) => void
  onGoToIdeas: () => void
}) {
  if (!picks.length) {
    return (
      <EmptyState
        compact
        icon={Lightbulb}
        title="No ideas in the plan yet"
        description="Select ideas in step 4, then choose where each one goes out."
        action={
          <Button type="button" size="sm" variant="outline" onClick={onGoToIdeas}>
            Back to Select ideas
          </Button>
        }
      />
    )
  }
  return (
    <div className="grid min-w-0 gap-3">
      <p className="text-xs text-pretty text-muted-foreground">
        Each platform becomes its own content item with its own brief — adapt the idea to how people use that platform.
      </p>
      <ul className="grid min-w-0 gap-2">
        {picks.map((pick) => {
          const none = !pick.entries.length
          return (
            <li
              key={pick.key}
              className={cn(
                "grid min-w-0 gap-2 rounded-md border px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
                none && "border-destructive/50"
              )}
            >
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-medium">{pick.title.trim() || "Untitled"}</p>
                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
                  <PillarTag pillar={pick.pillarId ? pillars.get(pick.pillarId) : undefined} />
                  <span className="num">{pluralize(pick.entries.length, "post")}</span>
                </p>
              </div>
              {pick.source.kind === "item" ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PlatformIcon platform={pick.entries[0]?.platform ?? "facebook"} className="size-3.5" />
                  Already a {PLATFORMS[pick.entries[0]?.platform ?? "facebook"]?.label} post
                </span>
              ) : (
                <PlatformToggleGroup
                  value={pickPlatforms(pick)}
                  onChange={(platforms) => onChange(pick.key, platforms)}
                  platforms={platformChoices}
                  size="xs"
                  aria-label={`Platforms for ${pick.title}`}
                />
              )}
              {none ? <p className="text-xs text-destructive md:col-span-2">Pick at least one platform.</p> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* -------------------------- Step 6 · Set deadlines -------------------------- */

/** Step 6: publish times (auto-filled from posting slots) and due dates, all editable. */
export function DeadlinesStep({
  picks,
  slots,
  weekStart,
  now,
  onEntryChange,
  onAutoFill,
  onGoToIdeas,
}: {
  picks: PlanPick[]
  slots: Map<ID, PostingSlot>
  weekStart: Date
  now: Date
  onEntryChange: (key: string, platform: PlatformId, patch: Partial<PlanEntry>) => void
  onAutoFill: (replan: boolean) => void
  onGoToIdeas: () => void
}) {
  if (!picks.length) {
    return (
      <EmptyState
        compact
        icon={CalendarClock}
        title="Nothing to schedule yet"
        description="Select ideas in step 4 — their publish times fill your open posting slots here."
        action={
          <Button type="button" size="sm" variant="outline" onClick={onGoToIdeas}>
            Back to Select ideas
          </Button>
        }
      />
    )
  }
  const minDate = toISODate(now)
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 basis-64 text-xs text-pretty text-muted-foreground">
          Publish times fill your open posting slots first — same pillar, lightest day. Due dates leave two days for production.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onAutoFill(false)}>
            <CalendarClock aria-hidden />
            Auto-fill empty
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onAutoFill(true)}>
            <RotateCcw aria-hidden />
            Re-plan all
          </Button>
        </div>
      </div>
      <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_15rem_12rem] gap-3 px-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase lg:grid">
        <span>Post</span>
        <span>Publish</span>
        <span>Due</span>
      </div>
      <ul className="grid min-w-0 gap-2">
        {picks.flatMap((pick, pickIndex) =>
          pick.entries.map((entry) => {
            const issue = entryIssue(entry, weekStart, now)
            const slot = entry.slotId ? slots.get(entry.slotId) : undefined
            const at = parseDate(entry.publishAt)
            const base = `planner-${pickIndex}-${entry.platform}`
            return (
              <li
                key={`${pick.key}:${entry.platform}`}
                className={cn(
                  "grid min-w-0 gap-2 rounded-md border px-3 py-2.5 lg:grid-cols-[minmax(0,1fr)_15rem_12rem] lg:items-start lg:gap-3",
                  issue.error && "border-destructive/50"
                )}
              >
                <div className="min-w-0 lg:pt-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                    <PlatformIcon platform={entry.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{pick.title.trim() || "Untitled"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {slot ? `Fills “${slot.label || "posting slot"}”` : at ? "Extra post — no posting slot" : "Not placed yet"}
                    {issue.warning ? <span className="text-warning-fg"> · {issue.warning}</span> : null}
                  </p>
                </div>
                <div className="grid min-w-0 gap-1">
                  <span className="text-[11px] text-muted-foreground lg:hidden">Publish</span>
                  <DateTimePicker
                    id={`${base}-publish`}
                    size="sm"
                    value={entry.publishAt}
                    clearable={false}
                    minDate={minDate}
                    aria-label={`Publish time for ${pick.title} on ${PLATFORMS[entry.platform]?.label}`}
                    aria-invalid={Boolean(issue.error)}
                    onChange={(value) => onEntryChange(pick.key, entry.platform, { publishAt: value, slotId: null })}
                  />
                  {issue.error ? <p className="text-xs text-destructive">{issue.error}</p> : null}
                </div>
                <div className="grid min-w-0 gap-1">
                  <span className="text-[11px] text-muted-foreground lg:hidden">Due</span>
                  <DatePicker
                    id={`${base}-due`}
                    size="sm"
                    value={entry.dueDate}
                    placeholder="No deadline"
                    minDate={minDate}
                    maxDate={at ? toISODate(at) : undefined}
                    aria-label={`Due date for ${pick.title} on ${PLATFORMS[entry.platform]?.label}`}
                    onChange={(value) => onEntryChange(pick.key, entry.platform, { dueDate: value })}
                  />
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
