import {
  Archive,
  BadgeCheck,
  CheckCheck,
  Flame,
  Inbox,
  Minus,
  Search,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react"
import { TONE_ICON, TONE_SOFT, TONE_TEXT } from "@/components/common/tone"
import type { IconComponent, StatusTone } from "@/components/common/types"
import {
  FUNNEL_STAGES,
  HEALTH_BANDS,
  IDEA_STATUS_MAP,
  PERFORMANCE_TIERS,
  PIPELINE_STAGE_MAP,
  PRIORITY_MAP,
  STAGE_GROUPS,
} from "@/lib/constants"
import type { FunnelStage, IdeaStatus, PerformanceTier, PipelineStage, Priority } from "@/lib/types"
import { cn } from "@/lib/utils"

const PILL = "inline-flex h-5 w-fit max-w-full shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5 [&>svg]:shrink-0"

/**
 * Status label: tone wash + icon + text. Status is never colour-only, so a tone icon is
 * shown by default; pass `icon` to override or `icon={null}` only when the text says it all.
 */
export function StatusPill({
  tone = "neutral",
  icon,
  children,
  className,
  title,
}: {
  tone?: StatusTone
  icon?: IconComponent | null
  children: React.ReactNode
  className?: string
  title?: string
}) {
  const Icon = icon === undefined ? TONE_ICON[tone] : icon
  return (
    <span
      data-slot="status-pill"
      data-tone={tone}
      title={title}
      className={cn(PILL, TONE_SOFT[tone], tone === "neutral" ? "text-foreground/80" : TONE_TEXT[tone], className)}
    >
      {Icon ? <Icon aria-hidden /> : null}
      <span className="truncate">{children}</span>
    </span>
  )
}

/* --------------------------------- Stages --------------------------------- */

const LAST_GROUP = STAGE_GROUPS.length - 1

/** Progress glyph for a pipeline stage: dashed (idea) → filling pie → check (published). */
export function StageIcon({ stage, className }: { stage: PipelineStage; className?: string }) {
  const group = PIPELINE_STAGE_MAP[stage]?.group ?? "idea"
  const index = STAGE_GROUPS.findIndex((g) => g.id === group)
  const done = index >= LAST_GROUP
  if (done) {
    return (
      <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3.5 shrink-0 text-good-fg", className)}>
        <circle cx="7" cy="7" r="6" fill="currentColor" />
        <path d="M4.3 7.2l1.8 1.8 3.6-3.8" fill="none" className="stroke-card" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  const angle = (index / LAST_GROUP) * Math.PI * 2
  const r = 3.1
  const x = 7 + r * Math.sin(angle)
  const y = 7 - r * Math.cos(angle)
  const wedge = index > 0 ? `M7 7V${7 - r}A${r} ${r} 0 ${angle > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z` : null
  return (
    <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3.5 shrink-0 text-muted-foreground", className)}>
      <circle
        cx="7"
        cy="7"
        r="5.75"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={index === 0 ? "2.2 1.8" : undefined}
      />
      {wedge ? <path d={wedge} fill="currentColor" /> : null}
    </svg>
  )
}

/** Neutral stage label with a progress glyph. */
export function StageBadge({ stage, className }: { stage: PipelineStage; className?: string }) {
  const meta = PIPELINE_STAGE_MAP[stage]
  return (
    <span
      title={meta?.description}
      className={cn(PILL, "border bg-card text-foreground/85 dark:bg-input/30", className)}
    >
      <StageIcon stage={stage} />
      <span className="truncate">{meta?.label ?? stage}</span>
    </span>
  )
}

/* ---------------------------------- Ideas --------------------------------- */

export const IDEA_STATUS_ICONS: Record<IdeaStatus, LucideIcon> = {
  inbox: Inbox,
  researching: Search,
  validated: BadgeCheck,
  selected: Target,
  converted: CheckCheck,
  archived: Archive,
}

export function IdeaStatusBadge({ status, className }: { status: IdeaStatus; className?: string }) {
  const meta = IDEA_STATUS_MAP[status]
  return (
    <StatusPill
      tone={status === "converted" ? "good" : "neutral"}
      icon={IDEA_STATUS_ICONS[status]}
      title={meta?.description}
      className={cn(status === "archived" && "text-muted-foreground", className)}
    >
      {meta?.label ?? status}
    </StatusPill>
  )
}

/* -------------------------------- Priority -------------------------------- */

const PRIORITY_LEVEL: Record<Priority, number> = { low: 1, medium: 2, high: 3 }

/** Three ascending bars; inactive bars stay faint so every level reads at a glance. */
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const level = PRIORITY_LEVEL[priority] ?? 2
  return (
    <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3.5 shrink-0", className)}>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1.5 + i * 4}
          y={9 - i * 3.5}
          width={3}
          height={3.5 + i * 3.5}
          rx={1}
          fill="currentColor"
          opacity={i < level ? 1 : 0.25}
        />
      ))}
    </svg>
  )
}

/** Priority with a bar glyph. Only `high` uses a status tone. */
export function PriorityBadge({
  priority,
  showLabel = true,
  className,
}: {
  priority: Priority
  showLabel?: boolean
  className?: string
}) {
  const label = PRIORITY_MAP[priority]?.label ?? priority
  const high = priority === "high"
  return (
    <span
      title={`${label} priority`}
      className={cn(PILL, high ? cn(TONE_SOFT.serious, TONE_TEXT.serious) : "px-0 text-muted-foreground", className)}
    >
      <PriorityIcon priority={priority} />
      {showLabel ? <span className="truncate">{label}</span> : <span className="sr-only">{label} priority</span>}
    </span>
  )
}

/* --------------------------------- Funnel --------------------------------- */

const FUNNEL_LEVEL: Record<FunnelStage, number> = { tofu: 0, mofu: 1, bofu: 2 }

function FunnelGlyph({ stage }: { stage: FunnelStage }) {
  const level = FUNNEL_LEVEL[stage]
  const bars = [
    { x: 1, w: 10 },
    { x: 2.75, w: 6.5 },
    { x: 4.5, w: 3 },
  ]
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="size-3 shrink-0">
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={1 + i * 3.75}
          width={bar.w}
          height={2.5}
          rx={1}
          fill="currentColor"
          opacity={i === level ? 1 : 0.28}
        />
      ))}
    </svg>
  )
}

/** TOFU / MOFU / BOFU label with a funnel-level glyph. Renders nothing for `null`. */
export function FunnelBadge({
  stage,
  showName = false,
  className,
}: {
  stage: FunnelStage | null | undefined
  showName?: boolean
  className?: string
}) {
  if (!stage) return null
  const meta = FUNNEL_STAGES[stage]
  return (
    <span
      title={`${meta.label} · ${meta.name} — ${meta.goal}`}
      className={cn(PILL, "border bg-card text-foreground/85 dark:bg-input/30", className)}
    >
      <FunnelGlyph stage={stage} />
      <span className="text-[11px] font-semibold tracking-wide">{meta.label}</span>
      {showName ? <span className="font-normal text-muted-foreground">{meta.name}</span> : null}
    </span>
  )
}

/* ---------------------------- Performance tiers --------------------------- */

export const TIER_ICONS: Record<PerformanceTier, LucideIcon> = {
  normal: Minus,
  good: TrendingUp,
  winner: Trophy,
  breakout: Flame,
}

const TIER_EMPHASIS: Record<PerformanceTier, string> = {
  normal: "",
  good: "",
  winner: "bg-good/15 dark:bg-good/20",
  breakout: "bg-good/20 ring-1 ring-good/30 ring-inset dark:bg-good/25",
}

/** Winner detection tier. `normal` is hidden unless `showNormal`. */
export function TierBadge({
  tier,
  showNormal = false,
  className,
}: {
  tier: PerformanceTier | null | undefined
  showNormal?: boolean
  className?: string
}) {
  if (!tier || (tier === "normal" && !showNormal)) return null
  const meta = PERFORMANCE_TIERS[tier]
  return (
    <StatusPill
      tone={tier === "normal" ? "neutral" : "good"}
      icon={TIER_ICONS[tier]}
      title={meta.description}
      className={cn(TIER_EMPHASIS[tier], className)}
    >
      {meta.label}
    </StatusPill>
  )
}

/* --------------------------------- Health --------------------------------- */

/** Health label. Pass `score` (0–100) to use the Content Health bands, or `tone` + `label`. */
export function HealthBadge({
  score,
  tone,
  label,
  className,
}: {
  score?: number | null
  tone?: StatusTone
  label?: React.ReactNode
  className?: string
}) {
  const band =
    score === undefined || score === null ? undefined : (HEALTH_BANDS.find((b) => score >= b.min) ?? HEALTH_BANDS[HEALTH_BANDS.length - 1])
  return (
    <StatusPill tone={tone ?? band?.tone ?? "neutral"} className={className}>
      {label ?? band?.label ?? "Not enough data"}
    </StatusPill>
  )
}
