"use client"

import { CircleCheck, CircleDashed, TriangleAlert, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { MixBar } from "@/components/charts"
import { Meter, PlatformIcon, SectionCard, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { useT, type Translator } from "@/lib/i18n"
import { cn, formatNumber } from "@/lib/utils"
import { scheduleMessages } from "./schedule-messages"
import type { CapacitySummary, PlatformLoad, SlotMix } from "./schedule-model"

type T = Translator<typeof scheduleMessages.en>

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
  const t = useT(scheduleMessages)
  const { postsPerWeek, target, gap, status, activeSlots, pausedSlots } = capacity
  const posts = (count: number) => t.plural("posts", count, { count: formatNumber(count) })
  const message =
    status === "match"
      ? t("capacity_match", { target })
      : status === "under"
        ? t("capacity_under", { posts: posts(-gap), target })
        : status === "over"
          ? t("capacity_over", { posts: posts(gap), target })
          : t("capacity_empty")
  return (
    <SectionCard
      title={t("capacity_title")}
      description={t("capacity_description")}
      action={<CardLink href="/settings?tab=general">{t("change_target")}</CardLink>}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-2xl leading-8 font-semibold tracking-tight num">{postsPerWeek}</span>
        <span className="truncate text-sm text-muted-foreground">{t("posts_a_week_target", { target })}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t.plural("from_active", activeSlots, { count: formatNumber(activeSlots) })}
        {pausedSlots ? t("paused_suffix", { count: pausedSlots }) : ""}
      </p>
      <Meter
        className="mt-3"
        value={postsPerWeek}
        max={Math.max(target, postsPerWeek, 1)}
        target={target || undefined}
        tone={status === "match" ? "good" : status === "under" ? "warning" : "brand"}
        aria-label={t("capacity_aria")}
        valueText={t("posts_of_target", { count: postsPerWeek, target })}
      />
      <StatusPill tone={status === "match" ? "good" : status === "under" ? "warning" : "neutral"} className="mt-3">
        {message}
      </StatusPill>
      {status === "under" ? (
        <p className="mt-2 text-xs text-pretty text-muted-foreground">{t("capacity_under_hint")}</p>
      ) : null}
    </SectionCard>
  )
}

function MixCard({ mix }: { mix: SlotMix }) {
  const t = useT(scheduleMessages)
  return (
    <SectionCard
      title={t("mix_title")}
      description={t("mix_description")}
      action={<CardLink href="/pillars">Pillars</CardLink>}
    >
      <MixBar
        segments={mix.rows.map((r) => ({ id: r.pillarId, label: r.label, value: r.posts, color: r.color }))}
        targets={mix.rows.map((r) => ({ id: r.pillarId, value: r.targetPct }))}
        valueLabel={t("slot_posts_label")}
        height={20}
        emptyMessage={t("mix_empty")}
        aria-label={t("mix_aria")}
      />
      <div className="mt-3 flex flex-col gap-1.5">
        {mix.warnings.slice(0, 3).map((w) => (
          <p key={w.pillarId} className="flex items-start gap-1.5 text-xs text-pretty">
            <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-fg" aria-hidden />
            <span>
              <span className="sr-only">{t("warning_sr")}</span>
              {w.message}
            </span>
          </p>
        ))}
        {mix.total && !mix.warnings.length ? <StatusPill tone="good">{t("mix_on_target")}</StatusPill> : null}
        {mix.unassigned ? (
          <p className="text-xs text-pretty text-muted-foreground">{t.plural("unassigned", mix.unassigned, { count: formatNumber(mix.unassigned) })}</p>
        ) : null}
      </div>
    </SectionCard>
  )
}

function platformState(row: PlatformLoad, t: T): { icon: LucideIcon; text: string; className: string } {
  if (row.target === null) return { icon: CircleDashed, text: t("no_strategy"), className: "text-muted-foreground" }
  const diff = row.posts - row.target
  if (diff === 0) return { icon: CircleCheck, text: t("on_target"), className: "text-good-fg" }
  if (diff < 0) return { icon: TriangleAlert, text: t("short_by", { count: -diff }), className: "text-warning-fg" }
  return { icon: CircleDashed, text: t("over_by", { count: diff }), className: "text-muted-foreground" }
}

function PlatformsCard({ platforms, anyPlatform }: { platforms: PlatformLoad[]; anyPlatform: number }) {
  const t = useT(scheduleMessages)
  return (
    <SectionCard
      title={t("platforms_title")}
      description={t("platforms_description")}
      action={<CardLink href="/strategy/platforms">{t("strategy")}</CardLink>}
    >
      {platforms.length ? (
        <ul className="-my-1 flex flex-col divide-y">
          {platforms.map((row) => {
            const state = platformState(row, t)
            const Icon = state.icon
            return (
              <li key={row.platform} className="flex min-w-0 items-center gap-2 py-1.5 text-sm">
                <PlatformIcon platform={row.platform} className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground num">
                  {t("per_week", { count: `${row.posts}${row.target !== null ? ` / ${row.target}` : ""}` })}
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
        <p className="text-xs text-muted-foreground">{t("no_platforms")}</p>
      )}
      {anyPlatform ? (
        <p className="mt-2 text-xs text-muted-foreground">{t.plural("any_platform_slots", anyPlatform, { count: formatNumber(anyPlatform) })}</p>
      ) : null}
    </SectionCard>
  )
}
