"use client"

import { Plus } from "lucide-react"
import { ColorDot, PageSection } from "@/components/common"
import { Button } from "@/components/ui/button"
import { GOAL_CATEGORIES, GOAL_CATEGORY_IDS } from "@/lib/constants"
import type { ContentGoal, GoalCategory } from "@/lib/types"
import { CATEGORY_COLORS } from "./goals-model"

/** The five goal categories with their KPIs, goal counts and an "add goal" shortcut each. */
export function GoalCategoryTiles({ goals, onAdd }: { goals: ContentGoal[]; onAdd: (category: GoalCategory) => void }) {
  return (
    <PageSection
      title="Goal categories"
      description="Every goal belongs to one of five categories — pick targets that match the category's KPIs."
    >
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
                  {active ? `${active} active` : inCategory.length ? `${inCategory.length} inactive` : "No goal"}
                </span>
              </div>
              <p className="text-xs text-pretty text-muted-foreground">{meta.description}</p>
              <p className="text-xs text-pretty">
                <span className="text-muted-foreground">KPIs: </span>
                {meta.kpis.join(" · ")}
              </p>
              <Button type="button" variant="ghost" size="xs" className="mt-auto -ml-1.5 self-start" onClick={() => onAdd(category)}>
                <Plus aria-hidden />
                Add {meta.label.toLowerCase()} goal
              </Button>
            </li>
          )
        })}
      </ul>
    </PageSection>
  )
}
