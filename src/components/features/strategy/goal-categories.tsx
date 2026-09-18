"use client"

import { Plus } from "lucide-react"
import { ColorDot, PageSection } from "@/components/common"
import { Button } from "@/components/ui/button"
import { GOAL_CATEGORIES, GOAL_CATEGORY_IDS } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import type { ContentGoal, GoalCategory } from "@/lib/types"
import { goalFocusMessages } from "./goals-messages"
import { CATEGORY_COLORS } from "./goals-model"

/** The five goal categories with their KPIs, goal counts and an "add goal" shortcut each. */
export function GoalCategoryTiles({ goals, onAdd }: { goals: ContentGoal[]; onAdd: (category: GoalCategory) => void }) {
  const t = useT(goalFocusMessages)
  const lang = useUiLang()
  return (
    <PageSection title={t("categories_title")} description={t("categories_description")}>
      <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {GOAL_CATEGORY_IDS.map((category) => {
          const meta = GOAL_CATEGORIES[category]
          const inCategory = goals.filter((g) => g.category === category)
          const active = inCategory.filter((g) => g.is_active).length
          return (
            <li key={category} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <ColorDot color={CATEGORY_COLORS[category]} />
                  <span className="truncate">{meta.label}</span>
                </p>
                <span className="shrink-0 text-xs text-muted-foreground num">
                  {active
                    ? t("active_count", { count: active })
                    : inCategory.length
                      ? t("inactive_count", { count: inCategory.length })
                      : t("no_goal")}
                </span>
              </div>
              <p className="text-xs text-pretty text-muted-foreground">{lang === "en" ? meta.description : t(`category_${category}`)}</p>
              <p className="text-xs text-pretty">
                <span className="text-muted-foreground">{t("kpis")}</span>
                {meta.kpis.join(" · ")}
              </p>
              <Button type="button" variant="ghost" size="xs" className="mt-auto -ml-1.5 self-start" onClick={() => onAdd(category)}>
                <Plus aria-hidden />
                {t("add_category_goal", { category: meta.label.toLowerCase() })}
              </Button>
            </li>
          )
        })}
      </ul>
    </PageSection>
  )
}
