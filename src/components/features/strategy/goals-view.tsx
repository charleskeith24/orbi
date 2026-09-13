"use client"

import { Plus, Target } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageContainer, PageHeader, PageSection, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { dataActions, updateBrand, useBrand, useDataStore, useDb, useSettings } from "@/lib/store"
import type { ContentGoal, GoalCategory, ID } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { GoalCard } from "./goal-card"
import { GoalCategoryTiles } from "./goal-categories"
import { GoalFocusCard } from "./goal-focus"
import { GoalFormDialog, type GoalDialogTarget } from "./goal-form-dialog"
import { focusPatch, goalPace, goalReferences, goalsSummary, type GoalRole } from "./goals-model"
import { StrategyTabs } from "./strategy-tabs"
import { useNow } from "./use-now"

function listJoin(parts: string[]): string {
  if (parts.length <= 1) return parts.join("")
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Strategy → Goals (spec §4, §15): goal CRUD, primary / secondary focus and progress per goal. `?open=<id>` edits a goal. */
export function GoalsView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const db = useDb()
  const settings = useSettings()
  const brand = useBrand()
  const now = useNow()
  const [confirm, confirmDialog] = useConfirm()

  const summary = useMemo(() => goalsSummary(db, now, settings), [db, now, settings])
  const withTargets = summary.rows.filter((r) => r.goal.is_active && r.progress.target !== null)
  const behind = withTargets.filter((r) => goalPace(r.progress) === "behind").length
  const activeCount = summary.rows.filter((r) => r.goal.is_active).length

  // `?open=<id>` edits a goal; "new" is local state. Keep the last form mounted while the dialog animates out.
  const openId = searchParams.get("open")
  const openGoal = openId ? (db.content_goals.find((g) => g.id === openId) ?? null) : null
  const [creating, setCreating] = useState<{ category: GoalCategory; nonce: number } | null>(null)
  const target: GoalDialogTarget | null = openGoal
    ? { key: `edit:${openGoal.id}`, goal: openGoal, category: openGoal.category }
    : creating
      ? { key: `new:${creating.category}:${creating.nonce}`, goal: null, category: creating.category }
      : null
  const [shown, setShown] = useState<GoalDialogTarget | null>(target)
  if (target && shown?.key !== target.key) setShown(target)

  const setOpen = useCallback(
    (id: ID | null) => router.replace(id ? `${pathname}?open=${id}` : pathname, { scroll: false }),
    [router, pathname]
  )

  function startCreate(category: GoalCategory) {
    if (openId) setOpen(null)
    setCreating({ category, nonce: Date.now() })
  }

  function closeDialog() {
    if (openId) setOpen(null)
    setCreating(null)
  }

  function setRole(role: GoalRole, goalId: ID | null) {
    const current = useDataStore.getState().db.brand_profiles[0] ?? brand
    const patch = focusPatch(current, role, goalId)
    updateBrand(patch)
    const goal = goalId ? db.content_goals.find((g) => g.id === goalId) : null
    const swapped = Object.keys(patch).length > 1
    toast.success(goal ? `“${goal.name || "Untitled goal"}” is now your ${role} goal` : `${capitalize(role)} goal cleared`, {
      description: swapped ? `Your previous ${role} goal is now the ${role === "primary" ? "secondary" : "primary"} goal.` : undefined,
    })
  }

  function clearRoleIfFocused(goalId: ID): GoalRole | null {
    const current = useDataStore.getState().db.brand_profiles[0]
    const role: GoalRole | null =
      current?.primary_goal_id === goalId ? "primary" : current?.secondary_goal_id === goalId ? "secondary" : null
    if (role) updateBrand(role === "primary" ? { primary_goal_id: null } : { secondary_goal_id: null })
    return role
  }

  function toggleActive(goal: ContentGoal) {
    const next = !goal.is_active
    dataActions.update("content_goals", goal.id, { is_active: next })
    const cleared = next ? null : clearRoleIfFocused(goal.id)
    toast.success(next ? "Goal activated" : "Goal deactivated", {
      description: cleared ? `“${goal.name}” is no longer your ${cleared} goal.` : goal.name,
    })
  }

  async function deleteGoal(goal: ContentGoal) {
    const refs = goalReferences(useDataStore.getState().db, goal.id)
    const name = goal.name || "Untitled goal"
    const linked = [
      refs.items ? pluralize(refs.items, "content item") : "",
      refs.ideas ? pluralize(refs.ideas, "idea") : "",
      refs.campaigns ? pluralize(refs.campaigns, "campaign") : "",
      refs.platforms ? pluralize(refs.platforms, "platform plan") : "",
    ].filter(Boolean)
    const ok = await confirm({
      title: `Delete “${name}”?`,
      description: [
        linked.length ? `${listJoin(linked)} keep working without a goal.` : "",
        refs.role ? `It stops being your ${refs.role} goal.` : "",
        "This can't be undone.",
      ]
        .filter(Boolean)
        .join(" "),
      confirmLabel: "Delete goal",
    })
    if (!ok) return
    if (openId === goal.id) setOpen(null)
    dataActions.remove("content_goals", goal.id)
    toast.success("Goal deleted", { description: name })
  }

  function handleSaved(goal: ContentGoal) {
    if (!goal.is_active) {
      const cleared = clearRoleIfFocused(goal.id)
      if (cleared) toast.info(`“${goal.name}” is inactive, so it's no longer your ${cleared} goal.`)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Goals"
        icon={Target}
        description="What your content is for. Every goal has a target and a period — and every piece of content should serve one."
        actions={
          <Button type="button" size="sm" onClick={() => startCreate("awareness")}>
            <Plus aria-hidden />
            New goal
          </Button>
        }
      >
        <StrategyTabs />
      </PageHeader>

      {summary.rows.length ? (
        <>
          <GoalFocusCard summary={summary} brand={brand} onChange={setRole} />
          <PageSection
            title="Your goals"
            description={`${pluralize(activeCount, "active goal")} · ${withTargets.length - behind} of ${withTargets.length} with a target on pace · progress counts content published this period`}
          >
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summary.rows.map((row) => (
                <GoalCard
                  key={row.goal.id}
                  row={row}
                  actions={{
                    onEdit: () => setOpen(row.goal.id),
                    onSetRole: (role) => setRole(role, row.goal.id),
                    onClearRole: () => row.role && setRole(row.role, null),
                    onToggleActive: () => toggleActive(row.goal),
                    onDelete: () => void deleteGoal(row.goal),
                  }}
                />
              ))}
            </div>
          </PageSection>
        </>
      ) : (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Goals give every piece of content a purpose. Start with the outcome that matters most this quarter."
          action={
            <Button type="button" size="sm" onClick={() => startCreate("awareness")}>
              <Plus aria-hidden />
              Add your first goal
            </Button>
          }
        />
      )}

      <GoalCategoryTiles goals={db.content_goals} onAdd={startCreate} />

      <GoalFormDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        target={shown}
        onSaved={handleSaved}
      />
      {confirmDialog}
    </PageContainer>
  )
}
