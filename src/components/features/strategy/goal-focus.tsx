"use client"

import { Star, TriangleAlert } from "lucide-react"
import { useMemo } from "react"
import { MixBar, type MixSegment } from "@/components/charts"
import { ColorDot, OptionSelect, SectionCard, type SelectOption } from "@/components/common"
import { GOAL_CATEGORIES, GOAL_CATEGORY_IDS } from "@/lib/constants"
import type { BrandProfile, ID } from "@/lib/types"
import { cn, pluralize } from "@/lib/utils"
import { CATEGORY_COLORS, type GoalRole, type GoalRow, type GoalsSummary } from "./goals-model"

const SLOT_COPY: Record<GoalRole, { label: string; hint: string }> = {
  primary: { label: "Primary goal", hint: "Gets the most content and steers recommendations and AI drafts." },
  secondary: { label: "Secondary goal", hint: "The next most important outcome — supports the primary goal." },
}

function FocusSlot({
  role,
  row,
  options,
  onChange,
}: {
  role: GoalRole
  row: GoalRow | undefined
  options: SelectOption<ID>[]
  onChange: (role: GoalRole, goalId: ID | null) => void
}) {
  const copy = SLOT_COPY[role]
  const id = `focus-${role}`
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
          <Star className={cn("size-3.5 text-brand", role === "primary" && "fill-current")} aria-hidden />
          {copy.label}
        </label>
        <p className="text-xs text-muted-foreground">{copy.hint}</p>
      </div>
      <OptionSelect
        id={id}
        value={row?.goal.id ?? null}
        options={options}
        allowNone
        noneLabel="No goal"
        placeholder="Choose a goal"
        emptyText="No active goals yet."
        onChange={(goalId) => onChange(role, goalId)}
      />
      {row ? (
        <p className="text-xs text-muted-foreground">
          {row.progress.pct !== null ? (
            <>
              <span className="font-medium text-foreground num">{row.progress.pct}%</span> of target ·{" "}
            </>
          ) : null}
          <span className="font-medium text-foreground num">{row.share30 ?? 0}%</span> of the last 30 days&apos; posts
          {!row.goal.is_active ? " · inactive" : ""}
        </p>
      ) : null}
    </div>
  )
}

/** Primary / secondary goal selection plus how last month's content was split across goal categories. */
export function GoalFocusCard({
  summary,
  brand,
  onChange,
}: {
  summary: GoalsSummary
  brand: BrandProfile
  onChange: (role: GoalRole, goalId: ID | null) => void
}) {
  const options = useMemo<SelectOption<ID>[]>(
    () =>
      summary.rows
        .filter((r) => r.goal.is_active || r.role)
        .sort(
          (a, b) =>
            GOAL_CATEGORY_IDS.indexOf(a.goal.category) - GOAL_CATEGORY_IDS.indexOf(b.goal.category) ||
            a.goal.name.localeCompare(b.goal.name)
        )
        .map((r) => ({
          value: r.goal.id,
          label: `${r.goal.name || "Untitled goal"}${r.goal.is_active ? "" : " (inactive)"}`,
          icon: <ColorDot color={CATEGORY_COLORS[r.goal.category]} />,
          group: GOAL_CATEGORIES[r.goal.category].label,
        })),
    [summary.rows]
  )
  const primary = summary.rows.find((r) => r.goal.id === brand.primary_goal_id)
  const secondary = summary.rows.find((r) => r.goal.id === brand.secondary_goal_id)

  const segments: MixSegment[] = [
    ...GOAL_CATEGORY_IDS.filter((c) => summary.byCategory[c] > 0).map((c) => ({
      id: c,
      label: GOAL_CATEGORIES[c].label,
      value: summary.byCategory[c],
      color: CATEGORY_COLORS[c],
    })),
    ...(summary.unassigned30 ? [{ id: "none", label: "No goal", value: summary.unassigned30, color: "other" as const }] : []),
  ]

  const warnings: string[] = []
  if (!primary) warnings.push("Choose a primary goal so recommendations know what to optimise for.")
  else if (summary.posts30 >= 5 && (primary.share30 ?? 0) < 20) {
    warnings.push(`Only ${primary.share30 ?? 0}% of the last 30 days' posts served your primary goal.`)
  }
  if (summary.posts30 && summary.unassigned30 / summary.posts30 > 0.15) {
    warnings.push(
      `${pluralize(summary.unassigned30, "post")} (${Math.round((summary.unassigned30 / summary.posts30) * 100)}%) had no goal — every piece of content needs a purpose.`
    )
  }

  return (
    <SectionCard
      title="Strategic focus"
      description="Your primary and secondary goal decide what the Content Decision Engine and every AI generation optimise for."
      contentClassName="flex flex-col gap-4"
    >
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <FocusSlot role="primary" row={primary} options={options} onChange={onChange} />
        <FocusSlot role="secondary" row={secondary} options={options} onChange={onChange} />
      </div>
      <div className="flex min-w-0 flex-col gap-2 border-t pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium">Content by goal — last 30 days</p>
          <p className="text-xs text-muted-foreground num">{pluralize(summary.posts30, "post")}</p>
        </div>
        <MixBar
          segments={segments}
          valueLabel="Posts"
          emptyMessage="No posts published in the last 30 days."
          aria-label="Posts by goal category, last 30 days"
        />
        {warnings.length ? (
          <ul className="flex flex-col gap-1">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-1.5 text-xs text-pretty">
                <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning-fg" aria-hidden />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SectionCard>
  )
}
