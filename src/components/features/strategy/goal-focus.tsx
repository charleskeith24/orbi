"use client"

import { Star, TriangleAlert } from "lucide-react"
import { useMemo } from "react"
import { MixBar, type MixSegment } from "@/components/charts"
import { ColorDot, OptionSelect, SectionCard, type SelectOption } from "@/components/common"
import { GOAL_CATEGORIES, GOAL_CATEGORY_IDS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import type { BrandProfile, ID } from "@/lib/types"
import { cn, formatNumber } from "@/lib/utils"
import { goalFocusMessages, goalsMessages } from "./goals-messages"
import { CATEGORY_COLORS, type GoalRole, type GoalRow, type GoalsSummary } from "./goals-model"

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
  const t = useT(goalFocusMessages)
  const id = `focus-${role}`
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
          <Star className={cn("size-3.5 text-brand", role === "primary" && "fill-current")} aria-hidden />
          {t(`${role}_label`)}
        </label>
        <p className="text-xs text-muted-foreground">{t(`${role}_hint`)}</p>
      </div>
      <OptionSelect
        id={id}
        value={row?.goal.id ?? null}
        options={options}
        allowNone
        noneLabel={t("no_goal")}
        placeholder={t("choose")}
        emptyText={t("no_active")}
        onChange={(goalId) => onChange(role, goalId)}
      />
      {row ? (
        <p className="text-xs text-muted-foreground">
          {row.progress.pct !== null ? (
            <>
              <span className="font-medium text-foreground num">{row.progress.pct}%</span> {t("of_target")}{" "}
            </>
          ) : null}
          <span className="font-medium text-foreground num">{row.share30 ?? 0}%</span> {t("of_posts")}
          {!row.goal.is_active ? t("inactive_suffix") : ""}
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
  const t = useT(goalFocusMessages)
  const tg = useT(goalsMessages)
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
          label: `${r.goal.name || tg("untitled")}${r.goal.is_active ? "" : t("inactive_option")}`,
          icon: <ColorDot color={CATEGORY_COLORS[r.goal.category]} />,
          group: GOAL_CATEGORIES[r.goal.category].label,
        })),
    [summary.rows, t, tg]
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
    ...(summary.unassigned30 ? [{ id: "none", label: t("no_goal"), value: summary.unassigned30, color: "other" as const }] : []),
  ]

  const warnings: string[] = []
  if (!primary) warnings.push(t("warn_no_primary"))
  else if (summary.posts30 >= 5 && (primary.share30 ?? 0) < 20) {
    warnings.push(t("warn_low_share", { share: primary.share30 ?? 0 }))
  }
  if (summary.posts30 && summary.unassigned30 / summary.posts30 > 0.15) {
    warnings.push(
      t.plural("warn_no_goal", summary.unassigned30, {
        count: formatNumber(summary.unassigned30),
        pct: Math.round((summary.unassigned30 / summary.posts30) * 100),
      })
    )
  }

  return (
    <SectionCard
      title={t("title")}
      description={t("description")}
      contentClassName="flex flex-col gap-4"
    >
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <FocusSlot role="primary" row={primary} options={options} onChange={onChange} />
        <FocusSlot role="secondary" row={secondary} options={options} onChange={onChange} />
      </div>
      <div className="flex min-w-0 flex-col gap-2 border-t pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium">{t("by_goal")}</p>
          <p className="text-xs text-muted-foreground num">{t.plural("posts", summary.posts30, { count: formatNumber(summary.posts30) })}</p>
        </div>
        <MixBar
          segments={segments}
          valueLabel={t("posts_label")}
          emptyMessage={t("empty")}
          aria-label={t("chart_label")}
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
