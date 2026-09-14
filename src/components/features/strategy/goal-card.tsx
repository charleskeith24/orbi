"use client"

import {
  CircleCheck,
  CircleDashed,
  Ellipsis,
  Pencil,
  Power,
  PowerOff,
  Star,
  StarOff,
  Trash2,
  TriangleAlert,
  Trophy,
  type LucideIcon,
} from "lucide-react"
import { ColorDot, Meter, StatusPill, Token, type MeterTone, type StatusTone } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GOAL_CATEGORIES } from "@/lib/constants"
import { formatShortDate } from "@/lib/dates"
import { cn, formatNumber } from "@/lib/utils"
import { CATEGORY_COLORS, goalPace, metricLabel, periodNoun, type GoalPace, type GoalRole, type GoalRow } from "./goals-model"

const PACE: Record<GoalPace, { label: string; tone: StatusTone; meter: MeterTone; icon: LucideIcon }> = {
  hit: { label: "Target hit", tone: "good", meter: "good", icon: Trophy },
  on_track: { label: "On track", tone: "good", meter: "brand", icon: CircleCheck },
  behind: { label: "Behind pace", tone: "warning", meter: "warning", icon: TriangleAlert },
  not_started: { label: "Starts with your first post", tone: "neutral", meter: "neutral", icon: CircleDashed },
  no_target: { label: "No target", tone: "neutral", meter: "neutral", icon: CircleDashed },
}

export function RoleBadge({ role }: { role: GoalRole }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-brand-soft px-1.5 text-xs font-medium text-foreground">
      <Star className={cn("size-3 text-brand", role === "primary" && "fill-current")} aria-hidden />
      {role === "primary" ? "Primary" : "Secondary"}
    </span>
  )
}

export interface GoalCardActions {
  onEdit: () => void
  onSetRole: (role: GoalRole) => void
  onClearRole: () => void
  onToggleActive: () => void
  onDelete: () => void
}

function GoalMenu({ name, role, active, actions }: { name: string; role: GoalRole | null; active: boolean; actions: GoalCardActions }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="-mt-1 -mr-1.5" aria-label={`Actions for ${name}`}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={actions.onEdit}>
          <Pencil aria-hidden />
          Edit goal…
        </DropdownMenuItem>
        {role !== "primary" ? (
          <DropdownMenuItem disabled={!active} onSelect={() => actions.onSetRole("primary")}>
            <Star aria-hidden />
            Make primary goal
          </DropdownMenuItem>
        ) : null}
        {role !== "secondary" ? (
          <DropdownMenuItem disabled={!active} onSelect={() => actions.onSetRole("secondary")}>
            <Star aria-hidden />
            Make secondary goal
          </DropdownMenuItem>
        ) : null}
        {role ? (
          <DropdownMenuItem onSelect={actions.onClearRole}>
            <StarOff aria-hidden />
            Remove from focus
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={actions.onToggleActive}>
          {active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
          {active ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={actions.onDelete}>
          <Trash2 aria-hidden />
          Delete goal…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** One goal: category, focus role, progress toward its target this period and the content serving it. */
export function GoalCard({ row, actions, started = true }: { row: GoalRow; actions: GoalCardActions; started?: boolean }) {
  const { goal, progress: p, role } = row
  const pace = PACE[goalPace(p, started)]
  const name = goal.name || "Untitled goal"
  const unit = metricLabel(p.metric)
  const period = periodNoun(goal.period)

  return (
    <article
      aria-labelledby={`goal-${goal.id}`}
      className={cn("flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4", !goal.is_active && "bg-muted/30 dark:bg-muted/10")}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ColorDot color={CATEGORY_COLORS[goal.category]} />
              {GOAL_CATEGORIES[goal.category].label}
            </span>
            {role ? <RoleBadge role={role} /> : null}
            {!goal.is_active ? (
              <StatusPill tone="neutral" icon={PowerOff}>
                Inactive
              </StatusPill>
            ) : null}
          </div>
          <h3 id={`goal-${goal.id}`} className="text-sm leading-5 font-medium text-pretty">
            <button
              type="button"
              onClick={actions.onEdit}
              className="text-left outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {name}
            </button>
          </h3>
          {goal.description ? <p className="line-clamp-2 text-xs text-pretty text-muted-foreground">{goal.description}</p> : null}
        </div>
        <GoalMenu name={name} role={role} active={goal.is_active} actions={actions} />
      </header>

      {p.target !== null ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm">
              <span className="font-semibold num">{formatNumber(p.current)}</span>
              <span className="text-muted-foreground">
                {" "}
                / {formatNumber(p.target)} {unit}
              </span>
            </p>
            <span className="shrink-0 text-sm font-medium num">{p.pct}%</span>
          </div>
          <Meter
            value={p.current}
            max={p.target}
            target={Math.round((p.target * p.elapsedPct) / 100)}
            tone={pace.meter}
            valueText={`${p.pct}% of target`}
            aria-label={`${name}: ${formatNumber(p.current)} of ${formatNumber(p.target)} ${unit} this ${period}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <StatusPill tone={pace.tone} icon={pace.icon}>
              {pace.label}
            </StatusPill>
            <span className="num" title="The tick on the bar marks where you'd be at an even pace.">
              {formatShortDate(p.periodStart)} – {formatShortDate(p.periodEnd)} · {p.elapsedPct}% elapsed
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm">
            <span className="font-semibold num">{formatNumber(p.current)}</span>
            <span className="text-muted-foreground">
              {" "}
              {unit} this {period}
            </span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <StatusPill tone={pace.tone} icon={pace.icon}>
              {pace.label}
            </StatusPill>
            <Button type="button" variant="ghost" size="xs" onClick={actions.onEdit}>
              Set a target
            </Button>
          </div>
        </div>
      )}

      <footer className="mt-auto flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground">
        <p className="text-pretty">
          <span className="font-medium text-foreground num">{row.published30}</span> {row.published30 === 1 ? "post" : "posts"} in the last 30 days
          {row.share30 !== null ? <span className="num"> ({row.share30}%)</span> : null} ·{" "}
          <span className="font-medium text-foreground num">{row.inProduction}</span> in production ·{" "}
          <span className="font-medium text-foreground num">{row.ideas}</span> {row.ideas === 1 ? "open idea" : "open ideas"}
        </p>
        {goal.kpis.length ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-0.5">KPIs</span>
            {goal.kpis.map((kpi) => (
              <Token key={kpi}>{kpi}</Token>
            ))}
          </div>
        ) : null}
      </footer>
    </article>
  )
}
