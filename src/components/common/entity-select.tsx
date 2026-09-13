"use client"

import { Target } from "lucide-react"
import { useMemo } from "react"
import { ColorDot } from "@/components/common/color"
import { formatCategoryIcon } from "@/components/common/entity-badges"
import { PlatformIcon } from "@/components/common/platform-icon"
import { IDEA_STATUS_ICONS, PriorityIcon, StageIcon } from "@/components/common/status-badges"
import type { ControlSize } from "@/components/common/types"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FORMAT_CATEGORIES,
  FORMAT_CATEGORY_MAP,
  FUNNEL_STAGE_IDS,
  FUNNEL_STAGES,
  GOAL_CATEGORIES,
  HOOK_CATEGORIES,
  HOOK_CATEGORY_IDS,
  IDEA_STATUSES,
  PIPELINE_STAGES,
  PLATFORM_IDS,
  PLATFORMS,
  PRIORITIES,
} from "@/lib/constants"
import { useTable } from "@/lib/store"
import type { FunnelStage, HookCategory, ID, IdeaStatus, PipelineStage, PlatformId, Priority } from "@/lib/types"
import { cn, truncate } from "@/lib/utils"

/** Radix Select forbids "" as an item value, so "no selection" uses a sentinel. */
const NONE = "__none__"

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  icon?: React.ReactNode
  /** Options sharing a group render under a group label. */
  group?: string
}

export interface BaseSelectProps<T extends string = string> {
  value: T | null
  onChange: (value: T | null) => void
  /** Adds a "none" option that maps to `null`. */
  allowNone?: boolean
  noneLabel?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
  size?: ControlSize
  "aria-label"?: string
  "aria-invalid"?: boolean
}

/** Generic controlled select over an option list (used by every entity/enum select). */
export function OptionSelect<T extends string>({
  options,
  value,
  onChange,
  allowNone = false,
  noneLabel = "None",
  placeholder = "Select…",
  emptyText = "Nothing to choose from yet",
  className,
  disabled,
  id,
  size = "default",
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: BaseSelectProps<T> & { options: SelectOption<T>[]; emptyText?: string }) {
  const known = value !== null && options.some((o) => o.value === value)
  const selectValue = value === null ? (allowNone ? NONE : "") : known ? value : ""

  const groups = useMemo(() => {
    const out: { label: string | null; options: SelectOption<T>[] }[] = []
    for (const option of options) {
      const label = option.group ?? null
      const last = out[out.length - 1]
      if (last && last.label === label) last.options.push(option)
      else out.push({ label, options: [option] })
    }
    return out
  }, [options])

  return (
    <Select
      value={selectValue}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === "") return
        onChange(next === NONE ? null : (next as T))
      }}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        className={cn("w-full min-w-0 *:data-[slot=select-value]:min-w-0", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        className="max-h-72 max-w-[min(28rem,calc(100vw-2rem))] min-w-(--radix-select-trigger-width)"
      >
        {allowNone ? (
          <SelectItem value={NONE}>
            <span className="truncate text-muted-foreground">{noneLabel}</span>
          </SelectItem>
        ) : null}
        {allowNone && options.length ? <SelectSeparator /> : null}
        {groups.map((group, index) =>
          group.label ? (
            <SelectGroup key={`${group.label}-${index}`}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((option) => (
                <OptionItem key={option.value} option={option} />
              ))}
            </SelectGroup>
          ) : (
            group.options.map((option) => <OptionItem key={option.value} option={option} />)
          )
        )}
        {!options.length ? <div className="px-2 py-2 text-xs text-muted-foreground">{emptyText}</div> : null}
      </SelectContent>
    </Select>
  )
}

function OptionItem<T extends string>({ option }: { option: SelectOption<T> }) {
  return (
    <SelectItem value={option.value} title={option.label.length > 60 ? option.label : undefined}>
      {option.icon}
      <span className="min-w-0 truncate">{option.label}</span>
    </SelectItem>
  )
}

/* ------------------------------ Entity selects ---------------------------- */

type EntitySelectProps = BaseSelectProps<ID>

/** Keeps the current value selectable even when filtered out (inactive, other persona…). */
function keepCurrent<T extends { id: ID }>(rows: T[], keep: (row: T) => boolean, current: ID | null): T[] {
  return rows.filter((row) => keep(row) || row.id === current)
}

export function PillarSelect(props: EntitySelectProps) {
  const pillars = useTable("content_pillars")
  const options = useMemo(
    () =>
      keepCurrent(pillars, (p) => p.is_active, props.value)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({ value: p.id, label: p.name || "Untitled pillar", icon: <ColorDot color={p.color} /> })),
    [pillars, props.value]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select pillar"}
      noneLabel={props.noneLabel ?? "No pillar"}
      emptyText="No pillars yet — add them in Content Pillars."
    />
  )
}

export function PersonaSelect(props: EntitySelectProps) {
  const personas = useTable("audience_personas")
  const options = useMemo(
    () =>
      [...personas]
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name))
        .map((p) => ({ value: p.id, label: p.name || "Untitled persona", icon: <ColorDot color={p.color} /> })),
    [personas]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select persona"}
      noneLabel={props.noneLabel ?? "No persona"}
      emptyText="No personas yet — add them in Audience HQ."
    />
  )
}

/** Audience problems, optionally limited to one persona (`personaId`). */
export function ProblemSelect({ personaId, ...props }: EntitySelectProps & { personaId?: ID | null }) {
  const problems = useTable("audience_problems")
  const options = useMemo(
    () =>
      keepCurrent(problems, (p) => !personaId || p.persona_id === personaId, props.value)
        .sort((a, b) => b.severity - a.severity || a.problem.localeCompare(b.problem))
        .map((p) => ({ value: p.id, label: truncate(p.problem || "Untitled problem", 90) })),
    [problems, personaId, props.value]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select problem"}
      noneLabel={props.noneLabel ?? "No problem"}
      emptyText={personaId ? "No problems for this persona yet." : "The Problem Bank is empty."}
    />
  )
}

export function GoalSelect(props: EntitySelectProps) {
  const goals = useTable("content_goals")
  const options = useMemo(
    () =>
      keepCurrent(goals, (g) => g.is_active, props.value).map((g) => ({
        value: g.id,
        label: g.name || GOAL_CATEGORIES[g.category]?.label || "Untitled goal",
        icon: <Target className="text-muted-foreground" aria-hidden />,
      })),
    [goals, props.value]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select goal"}
      noneLabel={props.noneLabel ?? "No goal"}
      emptyText="No goals yet — set them in Strategy → Goals."
    />
  )
}

const FORMAT_CATEGORY_ORDER = FORMAT_CATEGORIES.map((c) => c.id)

export function FormatSelect(props: EntitySelectProps) {
  const formats = useTable("content_formats")
  const options = useMemo(
    () =>
      [...formats]
        .sort(
          (a, b) =>
            FORMAT_CATEGORY_ORDER.indexOf(a.category) - FORMAT_CATEGORY_ORDER.indexOf(b.category) ||
            a.sort_order - b.sort_order ||
            a.name.localeCompare(b.name)
        )
        .map((f) => {
          const Icon = formatCategoryIcon(f.category)
          return {
            value: f.id,
            label: f.name || "Untitled format",
            icon: <Icon className="text-muted-foreground" aria-hidden />,
            group: FORMAT_CATEGORY_MAP[f.category]?.label,
          }
        }),
    [formats]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select format"}
      noneLabel={props.noneLabel ?? "No format"}
      emptyText="No formats in the library yet."
    />
  )
}

export function AngleSelect(props: EntitySelectProps) {
  const angles = useTable("angles")
  const options = useMemo(
    () =>
      [...angles]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ value: a.id, label: a.name || "Untitled angle" })),
    [angles]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select angle"}
      noneLabel={props.noneLabel ?? "No angle"}
      emptyText="The Angle Library is empty."
    />
  )
}

export function CampaignSelect(props: EntitySelectProps) {
  const campaigns = useTable("content_campaigns")
  const options = useMemo(
    () =>
      keepCurrent(campaigns, (c) => c.status !== "completed", props.value)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .map((c) => ({
          value: c.id,
          label: c.name || "Untitled campaign",
          icon: <ColorDot color={c.color} shape="square" />,
        })),
    [campaigns, props.value]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select campaign"}
      noneLabel={props.noneLabel ?? "No campaign"}
      emptyText="No active campaigns."
    />
  )
}

export function SeriesSelect(props: EntitySelectProps) {
  const series = useTable("content_series")
  const options = useMemo(
    () =>
      keepCurrent(series, (s) => s.is_active, props.value)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ value: s.id, label: s.name || "Untitled series" })),
    [series, props.value]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select series"}
      noneLabel={props.noneLabel ?? "No series"}
      emptyText="No active series."
    />
  )
}

/** Hooks from the Hook Library, favourites first, grouped by category. */
export function HookSelect(props: EntitySelectProps) {
  const hooks = useTable("hooks")
  const options = useMemo(
    () =>
      [...hooks]
        .sort(
          (a, b) =>
            HOOK_CATEGORY_IDS.indexOf(a.category) - HOOK_CATEGORY_IDS.indexOf(b.category) ||
            Number(b.is_favorite) - Number(a.is_favorite) ||
            a.text.localeCompare(b.text)
        )
        .map((h) => ({
          value: h.id,
          label: truncate(h.text || "Untitled hook", 90),
          group: HOOK_CATEGORIES[h.category]?.label,
        })),
    [hooks]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select hook"}
      noneLabel={props.noneLabel ?? "No hook"}
      emptyText="The Hook Library is empty."
    />
  )
}

/* ------------------------------- Enum selects ----------------------------- */

export function PlatformSelect({ platforms = PLATFORM_IDS, ...props }: BaseSelectProps<PlatformId> & { platforms?: PlatformId[] }) {
  const options = useMemo(
    () =>
      platforms.map((p) => ({
        value: p,
        label: PLATFORMS[p].label,
        icon: <PlatformIcon platform={p} className="text-muted-foreground" />,
      })),
    [platforms]
  )
  return (
    <OptionSelect
      {...props}
      options={options}
      placeholder={props.placeholder ?? "Select platform"}
      noneLabel={props.noneLabel ?? "No platform"}
    />
  )
}

const STAGE_OPTIONS: SelectOption<PipelineStage>[] = PIPELINE_STAGES.map((s) => ({
  value: s.id,
  label: s.label,
  icon: <StageIcon stage={s.id} />,
}))

export function StageSelect(props: BaseSelectProps<PipelineStage>) {
  return <OptionSelect {...props} options={STAGE_OPTIONS} placeholder={props.placeholder ?? "Select stage"} />
}

const PRIORITY_OPTIONS: SelectOption<Priority>[] = PRIORITIES.map((p) => ({
  value: p.id,
  label: p.label,
  icon: <PriorityIcon priority={p.id} className={p.id === "high" ? "text-serious-fg" : "text-muted-foreground"} />,
}))

export function PrioritySelect(props: BaseSelectProps<Priority>) {
  return <OptionSelect {...props} options={PRIORITY_OPTIONS} placeholder={props.placeholder ?? "Priority"} />
}

const FUNNEL_OPTIONS: SelectOption<FunnelStage>[] = FUNNEL_STAGE_IDS.map((id) => ({
  value: id,
  label: `${FUNNEL_STAGES[id].label} · ${FUNNEL_STAGES[id].name}`,
}))

export function FunnelSelect(props: BaseSelectProps<FunnelStage>) {
  return (
    <OptionSelect
      {...props}
      options={FUNNEL_OPTIONS}
      placeholder={props.placeholder ?? "Funnel stage"}
      noneLabel={props.noneLabel ?? "No funnel stage"}
    />
  )
}

const HOOK_CATEGORY_OPTIONS: SelectOption<HookCategory>[] = HOOK_CATEGORY_IDS.map((id) => ({
  value: id,
  label: HOOK_CATEGORIES[id].label,
}))

export function HookCategorySelect(props: BaseSelectProps<HookCategory>) {
  return (
    <OptionSelect
      {...props}
      options={HOOK_CATEGORY_OPTIONS}
      placeholder={props.placeholder ?? "Hook type"}
      noneLabel={props.noneLabel ?? "No hook type"}
    />
  )
}

const IDEA_STATUS_OPTIONS: SelectOption<IdeaStatus>[] = IDEA_STATUSES.map((s) => {
  const Icon = IDEA_STATUS_ICONS[s.id]
  return { value: s.id, label: s.label, icon: <Icon className="text-muted-foreground" aria-hidden /> }
})

export function IdeaStatusSelect(props: BaseSelectProps<IdeaStatus>) {
  return <OptionSelect {...props} options={IDEA_STATUS_OPTIONS} placeholder={props.placeholder ?? "Status"} />
}
