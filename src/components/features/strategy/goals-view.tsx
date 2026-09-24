"use client"

import { Plus, Target } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, PageContainer, PageHeader, PageSection, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import { ReadOnlyNotice } from "@/components/features/team/team-ui"
import { hasPublishedContent } from "@/components/features/dashboard/first-run"
import { useT } from "@/lib/i18n"
import { dataActions, updateBrand, useBrand, useCanWrite, useDataStore, useDb, useSettings } from "@/lib/store"
import type { ContentGoal, GoalCategory, ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { GoalCard } from "./goal-card"
import { GoalCategoryTiles } from "./goal-categories"
import { GoalFocusCard } from "./goal-focus"
import { GoalFormDialog, type GoalDialogTarget } from "./goal-form-dialog"
import { goalsMessages } from "./goals-messages"
import { focusPatch, goalPace, goalReferences, goalsSummary, type GoalRole } from "./goals-model"
import { useNow } from "./use-now"

function listJoin(parts: string[], and: string): string {
  if (parts.length <= 1) return parts.join("")
  return `${parts.slice(0, -1).join(", ")}${and}${parts[parts.length - 1]}`
}

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
  const t = useT(goalsMessages)
  const canWrite = useCanWrite("content_goals")

  const summary = useMemo(() => goalsSummary(db, now, settings), [db, now, settings])
  const withTargets = summary.rows.filter((r) => r.goal.is_active && r.progress.target !== null)
  // Before the first published post, goals haven't fallen behind — they haven't started.
  const started = useMemo(() => hasPublishedContent(db.content_items), [db.content_items])
  const behind = withTargets.filter((r) => goalPace(r.progress, started) === "behind").length
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
    toast.success(goal ? t("now_role", { name: goal.name || t("untitled"), role }) : t(role === "primary" ? "role_cleared_primary" : "role_cleared_secondary"), {
      description: swapped ? t("role_swapped", { role, other: role === "primary" ? "secondary" : "primary" }) : undefined,
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
    toast.success(next ? t("activated") : t("deactivated"), {
      description: cleared ? t("no_longer_role", { name: goal.name, role: cleared }) : goal.name,
    })
  }

  async function deleteGoal(goal: ContentGoal) {
    const refs = goalReferences(useDataStore.getState().db, goal.id)
    const name = goal.name || t("untitled")
    const count = (key: "linked_items" | "linked_ideas" | "linked_campaigns" | "linked_platforms", n: number) =>
      n ? t.plural(key, n, { count: formatNumber(n) }) : ""
    const linked = [
      count("linked_items", refs.items),
      count("linked_ideas", refs.ideas),
      count("linked_campaigns", refs.campaigns),
      count("linked_platforms", refs.platforms),
    ].filter(Boolean)
    const ok = await confirm({
      title: t("delete_title", { name }),
      description: [
        linked.length ? t("delete_linked", { list: listJoin(linked, t("list_and")) }) : "",
        refs.role ? t("delete_role", { role: refs.role }) : "",
        t("delete_permanent"),
      ]
        .filter(Boolean)
        .join(" "),
      confirmLabel: t("delete_confirm"),
    })
    if (!ok) return
    if (openId === goal.id) setOpen(null)
    dataActions.remove("content_goals", goal.id)
    toast.success(t("deleted"), { description: name })
  }

  function handleSaved(goal: ContentGoal) {
    if (!goal.is_active) {
      const cleared = clearRoleIfFocused(goal.id)
      if (cleared) toast.info(t("inactive_cleared", { name: goal.name, role: cleared }))
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Goals"
        info={t("description")}
        actions={
          <Button type="button" size="sm" onClick={() => startCreate("awareness")} disabled={!canWrite}>
            <Plus aria-hidden />
            {t("new_goal")}
          </Button>
        }
      />

      <ReadOnlyNotice table="content_goals" />

      {summary.rows.length ? (
        <>
          <GoalFocusCard summary={summary} brand={brand} onChange={setRole} />
          <PageSection
            title={t("your_goals")}
            count={activeCount}
            info={
              started
                ? t("summary_started", { onPace: withTargets.length - behind, withTarget: withTargets.length })
                : t("summary_new")
            }
          >
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summary.rows.map((row) => (
                <GoalCard
                  started={started}
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
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button type="button" size="sm" onClick={() => startCreate("awareness")}>
              <Plus aria-hidden />
              {t("empty_action")}
            </Button>
          }
        />
      )}

      <GoalCategoryTiles goals={db.content_goals} onAdd={startCreate} defaultOpen={!summary.rows.length} />

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
