"use client"

import { CircleCheck, CircleDashed, TriangleAlert, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { MixBar } from "@/components/charts"
import { Meter, PlatformIcon, SectionCard, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { cn, pluralize } from "@/lib/utils"
import type { CapacitySummary, PlatformLoad, SlotMix } from "./schedule-model"

/** Weekly capacity vs the post target, the slots' pillar mix vs pillar targets, and platform load vs strategy. */
export function ScheduleSummary({
  capacity,
  platforms,
  anyPlatform,
  mix,
}: {
  capacity: CapacitySummary
  platforms: PlatformLoad[]
  anyPlatform: number
  mix: SlotMix
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <CapacityCard capacity={capacity} />
      <MixCard mix={mix} />
      <PlatformsCard platforms={platforms} anyPlatform={anyPlatform} />
    </div>
  )
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild size="xs" variant="ghost" className="text-muted-foreground">
      <Link href={href}>{children}</Link>
    </Button>
  )
}

function CapacityCard({ capacity }: { capacity: CapacitySummary }) {
  const { postsPerWeek, target, gap, status, activeSlots, pausedSlots } = capacity
  const message =
    status === "match"
      ? `Matches your ${target}-post weekly target`
      : status === "under"
        ? `${pluralize(-gap, "post")} short of your ${target}-post target`
        : status === "over"
          ? `${pluralize(gap, "post")} more than your ${target}-post target`
          : "No active slots yet"
  return (
    <SectionCard
      title="Weekly capacity"
      description="Posts your active slots produce each week — one per platform."
      action={<CardLink href="/settings?tab=general">Change target</CardLink>}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-2xl leading-8 font-semibold tracking-tight num">{postsPerWeek}</span>
        <span className="truncate text-sm text-muted-foreground">posts a week · target {target}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        From {pluralize(activeSlots, "active slot")}
        {pausedSlots ? ` · ${pausedSlots} paused` : ""}
      </p>
      <Meter
        className="mt-3"
        value={postsPerWeek}
        max={Math.max(target, postsPerWeek, 1)}
        target={target || undefined}
        tone={status === "match" ? "good" : status === "under" ? "warning" : "brand"}
        aria-label="Weekly capacity against the weekly post target"
        valueText={`${postsPerWeek} of ${target} posts`}
      />
      <StatusPill tone={status === "match" ? "good" : status === "under" ? "warning" : "neutral"} className="mt-3">
        {message}
      </StatusPill>
      {status === "under" ? (
        <p className="mt-2 text-xs text-pretty text-muted-foreground">Add a slot, add a platform to an existing one, or lower the target in Settings.</p>
      ) : null}
    </SectionCard>
  )
}

function MixCard({ mix }: { mix: SlotMix }) {
  return (
    <SectionCard
      title="Pillar mix of your slots"
      description="Slot posts per pillar against your pillar targets."
      action={<CardLink href="/pillars">Pillars</CardLink>}
    >
      <MixBar
        segments={mix.rows.map((r) => ({ id: r.pillarId, label: r.label, value: r.posts, color: r.color }))}
        targets={mix.rows.map((r) => ({ id: r.pillarId, value: r.targetPct }))}
        valueLabel="Slot posts"
        height={20}
        emptyMessage="Give your slots a pillar to see the mix."
        aria-label="Pillar mix of your posting slots"
      />
      <div className="mt-3 flex flex-col gap-1.5">
        {mix.warnings.slice(0, 3).map((w) => (
          <p key={w.pillarId} className="flex items-start gap-1.5 text-xs text-pretty">
            <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-fg" aria-hidden />
            <span>
              <span className="sr-only">Warning: </span>
              {w.message}
            </span>
          </p>
        ))}
        {mix.total && !mix.warnings.length ? <StatusPill tone="good">In line with your pillar targets</StatusPill> : null}
        {mix.unassigned ? (
          <p className="text-xs text-pretty text-muted-foreground">
            {pluralize(mix.unassigned, "slot post")} without a pillar — give {mix.unassigned === 1 ? "it" : "them"} one so the mix is measurable.
          </p>
        ) : null}
      </div>
    </SectionCard>
  )
}

function platformState(row: PlatformLoad): { icon: LucideIcon; text: string; className: string } {
  if (row.target === null) return { icon: CircleDashed, text: "No strategy", className: "text-muted-foreground" }
  const diff = row.posts - row.target
  if (diff === 0) return { icon: CircleCheck, text: "On target", className: "text-good-fg" }
  if (diff < 0) return { icon: TriangleAlert, text: `${-diff} short`, className: "text-warning-fg" }
  return { icon: CircleDashed, text: `${diff} over`, className: "text-muted-foreground" }
}

function PlatformsCard({ platforms, anyPlatform }: { platforms: PlatformLoad[]; anyPlatform: number }) {
  return (
    <SectionCard
      title="Platforms"
      description="Slot posts per platform against your platform strategy."
      action={<CardLink href="/strategy/platforms">Strategy</CardLink>}
    >
      {platforms.length ? (
        <ul className="-my-1 flex flex-col divide-y">
          {platforms.map((row) => {
            const state = platformState(row)
            const Icon = state.icon
            return (
              <li key={row.platform} className="flex min-w-0 items-center gap-2 py-1.5 text-sm">
                <PlatformIcon platform={row.platform} className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground num">
                  {row.posts}
                  {row.target !== null ? ` / ${row.target}` : ""} a week
                </span>
                <span className={cn("inline-flex w-24 shrink-0 items-center justify-end gap-1 text-xs", state.className)}>
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  {state.text}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No slot names a platform and no platform strategy is active.</p>
      )}
      {anyPlatform ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {pluralize(anyPlatform, "slot")} {anyPlatform === 1 ? "takes" : "take"} any platform.
        </p>
      ) : null}
    </SectionCard>
  )
}
