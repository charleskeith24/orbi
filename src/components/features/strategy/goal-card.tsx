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
import { ColorDot, Disclosure, Meter, StatusPill, Token, type MeterTone, type StatusTone } from "@/components/common"
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
import { useT } from "@/lib/i18n"
import { cn, formatNumber } from "@/lib/utils"
import { goalCardMessages, goalsMessages } from "./goals-messages"
import { CATEGORY_COLORS, goalPace, metricLabel, periodNoun, type GoalPace, type GoalRole, type GoalRow } from "./goals-model"

const PACE: Record<GoalPace, { tone: StatusTone; meter: MeterTone; icon: LucideIcon }> = {
  hit: { tone: "good", meter: "good", icon: Trophy },
  on_track: { tone: "good", meter: "brand", icon: CircleCheck },
  behind: { tone: "warning", meter: "warning", icon: TriangleAlert },
  not_started: { tone: "neutral", meter: "neutral", icon: CircleDashed },
  no_target: { tone: "neutral", meter: "neutral", icon: CircleDashed },
}

export function RoleBadge({ role }: { role: GoalRole }) {
  const t = useT(goalCardMessages)
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-brand-soft px-1.5 text-xs font-medium text-foreground">
      <Star className={cn("size-3 text-brand", role === "primary" && "fill-current")} aria-hidden />
      {role === "primary" ? t("primary") : t("secondary")}
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
  const t = useT(goalCardMessages)
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="-mt-1 -mr-1.5" aria-label={t("actions_for", { name })}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={actions.onEdit}>
          <Pencil aria-hidden />
          {t("edit")}
        </DropdownMenuItem>
        {role !== "primary" ? (
          <DropdownMenuItem disabled={!active} onSelect={() => actions.onSetRole("primary")}>
            <Star aria-hidden />
            {t("make_primary")}
          </DropdownMenuItem>
        ) : null}
        {role !== "secondary" ? (
          <DropdownMenuItem disabled={!active} onSelect={() => actions.onSetRole("secondary")}>
            <Star aria-hidden />
            {t("make_secondary")}
          </DropdownMenuItem>
        ) : null}
        {role ? (
          <DropdownMenuItem onSelect={actions.onClearRole}>
            <StarOff aria-hidden />
            {t("remove_focus")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={actions.onToggleActive}>
          {active ? <PowerOff aria-hidden /> : <Power aria-hidden />}
          {active ? t("deactivate") : t("activate")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={actions.onDelete}>
          <Trash2 aria-hidden />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** One goal: category, focus role, progress toward its target this period and the content serving it (description and KPIs under "Details"). */
export function GoalCard({ row, actions, started = true }: { row: GoalRow; actions: GoalCardActions; started?: boolean }) {
  const { goal, progress: p, role } = row
  const paceKey = goalPace(p, started)
  const pace = PACE[paceKey]
  const t = useT(goalCardMessages)
  const tg = useT(goalsMessages)
  const paceLabel = t(`pace_${paceKey}`)
  const name = goal.name || tg("untitled")
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
                {t("inactive")}
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
            valueText={t("pct_of_target", { pct: String(p.pct) })}
            aria-label={t("progress_aria", { name, current: formatNumber(p.current), target: formatNumber(p.target), unit, period })}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <StatusPill tone={pace.tone} icon={pace.icon}>
              {paceLabel}
            </StatusPill>
            <span className="num" title={t("tick_title")}>
              {formatShortDate(p.periodStart)} – {formatShortDate(p.periodEnd)} · {t("elapsed", { pct: p.elapsedPct })}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm">
            <span className="font-semibold num">{formatNumber(p.current)}</span>
            <span className="text-muted-foreground">
              {" "}
              {t("unit_this_period", { unit, period })}
            </span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <StatusPill tone={pace.tone} icon={pace.icon}>
              {paceLabel}
            </StatusPill>
            <Button type="button" variant="ghost" size="xs" onClick={actions.onEdit}>
              {t("set_target")}
            </Button>
          </div>
        </div>
      )}

      <footer className="mt-auto flex flex-col gap-2.5 border-t pt-3 text-xs text-muted-foreground">
        <dl className="grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <dt className="truncate">{t("footer_posts")}</dt>
            <dd className="text-sm font-medium text-foreground num">
              {row.published30}
              {row.share30 !== null ? <span className="text-xs font-normal text-muted-foreground"> · {row.share30}%</span> : null}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="truncate">{t("footer_production")}</dt>
            <dd className="text-sm font-medium text-foreground num">{row.inProduction}</dd>
          </div>
          <div className="min-w-0">
            <dt className="truncate">{t("footer_ideas")}</dt>
            <dd className="text-sm font-medium text-foreground num">{row.ideas}</dd>
          </div>
        </dl>
        {goal.description || goal.kpis.length ? (
          <Disclosure contentClassName="flex flex-col gap-2">
            {goal.description ? <p className="text-pretty">{goal.description}</p> : null}
            {goal.kpis.length ? (
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-0.5">KPIs</span>
                {goal.kpis.map((kpi) => (
                  <Token key={kpi}>{kpi}</Token>
                ))}
              </div>
            ) : null}
          </Disclosure>
        ) : null}
      </footer>
    </article>
  )
}
