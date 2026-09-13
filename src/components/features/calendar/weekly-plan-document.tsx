"use client"

import { format } from "date-fns"
import { CircleCheck, CircleDashed, Printer } from "lucide-react"
import Link from "next/link"
import { MixBar, type MixSegment, type MixTarget } from "@/components/charts"
import { ColorDot, PlatformIcon, StageIcon, StatusPill, Token } from "@/components/common"
import { Button } from "@/components/ui/button"
import { PIPELINE_STAGE_MAP } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import type { ContentPillar, ID } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { weekLabel } from "./calendar-model"
import type { PlanDocument, PlanRow } from "./planner-model"

/** Posts per pillar in the plan (existing posts + drafts; deadlines excluded). */
export function planPillarCounts(doc: PlanDocument): Map<ID | null, number> {
  const counts = new Map<ID | null, number>()
  for (const day of doc.days) {
    for (const row of day.rows) {
      const pillarId =
        row.kind === "post" ? (row.placement.kind === "due" ? undefined : row.placement.item.pillar_id) : row.kind === "draft" ? row.pick.pillarId : undefined
      if (pillarId === undefined) continue
      counts.set(pillarId, (counts.get(pillarId) ?? 0) + 1)
    }
  }
  for (const { pick } of doc.unscheduled) counts.set(pick.pillarId, (counts.get(pick.pillarId) ?? 0) + 1)
  return counts
}

/** Planned posts including those without a publish time yet, and how many of them aren't created yet. */
export function planTotals(doc: PlanDocument): { planned: number; notCreated: number } {
  return { planned: doc.posts + doc.unscheduled.length, notCreated: doc.drafts + doc.unscheduled.length }
}

/** Mix-bar segments (active pillars, in order) and their normalised targets. */
export function pillarSegments(counts: Map<ID | null, number>, pillars: Map<ID, ContentPillar>): { segments: MixSegment[]; targets: MixTarget[] } {
  const active = [...pillars.values()].filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const targetTotal = active.reduce((n, p) => n + Math.max(0, p.target_percentage), 0)
  return {
    segments: active.map((p) => ({ id: p.id, label: p.name || "Untitled pillar", value: counts.get(p.id) ?? 0, color: p.color })),
    targets: active.map((p) => ({ id: p.id, value: targetTotal ? (Math.max(0, p.target_percentage) / targetTotal) * 100 : 0 })),
  }
}

/** Time · post · stage — the stage folds into the meta line on phones. */
const ROW = "grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3 rounded-md px-2.5 py-1.5 sm:grid-cols-[4.75rem_minmax(0,1fr)_auto] print:break-inside-avoid"

function PillarMeta({ pillar }: { pillar: ContentPillar | undefined }) {
  if (!pillar) return null
  return (
    <span className="inline-flex items-center gap-1.5">
      <ColorDot color={pillar.color} />
      {pillar.name}
    </span>
  )
}

function RowView({ row, pillars }: { row: PlanRow; pillars: Map<ID, ContentPillar> }) {
  if (row.kind === "open") {
    const pillar = row.daySlot.slot.pillar_id ? pillars.get(row.daySlot.slot.pillar_id) : undefined
    return (
      <li className={cn(ROW, "border border-dashed text-xs text-muted-foreground")}>
        <span className="num">{format(row.at, "h:mm a")}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <CircleDashed className="size-3.5 shrink-0" aria-hidden />
          {row.platform ? <PlatformIcon platform={row.platform} label className="size-3.5 shrink-0" /> : null}
          <span className="truncate">Open slot · {row.daySlot.slot.label || pillar?.name || "Posting slot"}</span>
        </span>
      </li>
    )
  }

  if (row.kind === "draft") {
    const pillar = row.pick.pillarId ? pillars.get(row.pick.pillarId) : undefined
    return (
      <li className={cn(ROW, "border border-dashed border-brand/40 text-sm")}>
        <span className="text-xs font-medium num">{row.at ? format(row.at, "h:mm a") : "—"}</span>
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <PlatformIcon platform={row.entry.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{row.pick.title.trim() || "Untitled"}</span>
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
            <PillarMeta pillar={pillar} />
            {row.entry.dueDate ? <span className="num">Due {formatDate(row.entry.dueDate, "EEE, MMM d")}</span> : null}
            <span className="sm:hidden">Planned</span>
          </span>
        </span>
        <Token className="font-normal text-muted-foreground max-sm:hidden">Planned</Token>
      </li>
    )
  }

  const { placement } = row
  const item = placement.item
  const pillar = item.pillar_id ? pillars.get(item.pillar_id) : undefined
  const live = placement.kind === "published"
  const stage = (
    <>
      {live ? <CircleCheck className="size-3.5 shrink-0 text-good-fg" aria-hidden /> : <StageIcon stage={item.stage} />}
      {PIPELINE_STAGE_MAP[item.stage]?.label ?? item.stage}
    </>
  )
  return (
    <li className={cn(ROW, "border text-sm", placement.kind === "due" && "border-dashed")}>
      <span className="text-xs font-medium num">{placement.kind === "due" ? "Due" : format(placement.at, "h:mm a")}</span>
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
          <Link href={`/studio/${item.id}`} className={cn("truncate font-medium underline-offset-4 hover:underline", live && "text-muted-foreground")}>
            {item.title.trim() || "Untitled content"}
          </Link>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
          <PillarMeta pillar={pillar} />
          {placement.kind === "due" ? <span className="max-sm:hidden">Production deadline — no publish time yet</span> : null}
          {placement.kind === "scheduled" && item.due_date ? <span className="num">Due {formatDate(item.due_date, "EEE, MMM d")}</span> : null}
          <span className="inline-flex items-center gap-1 sm:hidden">{stage}</span>
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground max-sm:hidden">{stage}</span>
    </li>
  )
}

/** The Weekly Content Plan: every day of the week with its posts, planned drafts and open slots. Printable. */
export function WeeklyPlanDocument({
  weekStart,
  doc,
  focus,
  target,
  pillars,
  savedAt,
  onPrint,
}: {
  weekStart: Date
  doc: PlanDocument
  focus: string
  target: number
  pillars: Map<ID, ContentPillar>
  savedAt: string | null
  onPrint: () => void
}) {
  const { segments, targets } = pillarSegments(planPillarCounts(doc), pillars)
  const { planned, notCreated } = planTotals(doc)
  return (
    <section aria-labelledby="weekly-plan-title" className="min-w-0 rounded-lg border bg-card print:rounded-none print:border-0">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b px-4 py-3 print:px-0">
        <div className="min-w-0 flex-1 basis-72">
          <h2 id="weekly-plan-title" className="text-sm font-semibold">
            Weekly Content Plan · {weekLabel(weekStart)}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground num">
            {pluralize(planned, "post")} planned · target {target} · {doc.slotsFilled} of {pluralize(doc.slotsTotal, "slot")} filled
            {notCreated ? ` · ${notCreated} not created yet` : ""}
          </p>
          <p className="mt-1.5 text-sm text-pretty">
            <span className="text-muted-foreground">Focus: </span>
            {focus.trim() || <span className="text-muted-foreground">not set yet</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 print:hidden">
          {savedAt ? <StatusPill tone="good">Saved {formatDate(savedAt, "MMM d, h:mm a")}</StatusPill> : null}
          <Button type="button" size="sm" variant="outline" onClick={onPrint}>
            <Printer aria-hidden />
            Print plan
          </Button>
        </div>
      </header>
      {planned ? (
        <div className="border-b px-4 py-3 print:px-0">
          <MixBar segments={segments} targets={targets} valueLabel="Posts" height={16} aria-label="Pillar mix of the planned week" />
        </div>
      ) : null}
      <ol className="divide-y">
        {doc.days.map((day) => (
          <li key={day.key} className="grid min-w-0 gap-2 px-4 py-3 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-4 print:break-inside-avoid print:px-0">
            <div>
              <p className={cn("text-sm font-medium", day.isPast && "text-muted-foreground")}>{format(day.date, "EEEE")}</p>
              <p className="text-xs text-muted-foreground num">
                {format(day.date, "MMM d")} · {pluralize(day.posts, "post")}
              </p>
            </div>
            {day.rows.length ? (
              <ul className="grid min-w-0 gap-1">
                {day.rows.map((row, index) => (
                  <RowView key={`${row.kind}-${index}`} row={row} pillars={pillars} />
                ))}
              </ul>
            ) : (
              <p className="self-center text-xs text-muted-foreground">Nothing planned — a rest day.</p>
            )}
          </li>
        ))}
      </ol>
      {doc.unscheduled.length ? (
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground print:px-0">
          {pluralize(doc.unscheduled.length, "planned post")} without a publish time — set {doc.unscheduled.length === 1 ? "it" : "them"} in step 6.
        </p>
      ) : null}
    </section>
  )
}
