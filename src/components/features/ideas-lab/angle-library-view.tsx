"use client"

import { Compass, Plus, SearchX, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ChipToggleGroup,
  chipVariants,
  EmptyState,
  FilterBar,
  OptionSelect,
  PageContainer,
  PageHeader,
  SearchInput,
  SectionCard,
  useConfirm,
  ViewToggle,
  type SelectOption,
} from "@/components/common"
import { BarList, ChartFrame } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { anglePerformance, formatMultiple } from "@/lib/analytics"
import { dataActions, useDb } from "@/lib/store"
import type { ContentAngle, ID } from "@/lib/types"
import { formatNumber, pluralize } from "@/lib/utils"
import { AngleCard } from "./angle-card"
import { AngleDetailSheet } from "./angle-detail-sheet"
import { AngleFormDialog } from "./angle-form-dialog"
import {
  ANGLE_SORTS,
  angleStats,
  emptyAngleStats,
  filterAngles,
  generatorHref,
  sortAngles,
  untriedAngles,
  type AngleKind,
  type AngleSort,
} from "./angle-model"
import { formatHookMetric, HOOK_METRICS, hookMetricValue, overallPerformance, type HookMetric } from "./hook-model"
import { useOpenParam } from "./use-open-param"

const SORT_OPTIONS: SelectOption<AngleSort>[] = ANGLE_SORTS.map((s) => ({ value: s.id, label: s.label }))
const KIND_OPTIONS: { value: AngleKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "default", label: "Default" },
  { value: "custom", label: "Custom" },
]
const ANGLE_METRICS = HOOK_METRICS.filter((m) => m.id !== "retention")

/**
 * Angle Library (spec §11, §57): the default and custom angles with usage and average performance.
 * Custom angles can be deleted; defaults can only be edited. `?open=<angleId>` opens the detail sheet.
 */
export function AngleLibraryView() {
  const router = useRouter()
  const db = useDb()
  const [now] = useState(() => new Date())
  const [openId, setOpenId] = useOpenParam()
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<AngleKind>("all")
  const [sort, setSort] = useState<AngleSort>("performance")
  const [metric, setMetric] = useState<HookMetric>("views")
  const [newOpen, setNewOpen] = useState(false)
  const [confirm, confirmDialog] = useConfirm()

  const angles = db.angles
  const stats = useMemo(() => angleStats(db, now), [db, now])
  const overall = useMemo(() => overallPerformance(db, now), [db, now])
  const performance = useMemo(() => anglePerformance(db, now).filter((a) => a.measured > 0), [db, now])
  const visible = useMemo(() => sortAngles(filterAngles(angles, { q, kind }), sort, stats), [angles, q, kind, sort, stats])
  const untried = useMemo(() => untriedAngles(angles, stats), [angles, stats])
  const customCount = useMemo(() => angles.filter((a) => !a.is_default).length, [angles])

  const angleById = useMemo(() => new Map(angles.map((a) => [a.id, a])), [angles])
  const openAngle = openId ? angleById.get(openId) : undefined
  const [shownId, setShownId] = useState<ID | null>(openAngle ? openAngle.id : null)
  if (openAngle && openAngle.id !== shownId) setShownId(openAngle.id)
  const shownAngle = shownId ? (angleById.get(shownId) ?? null) : null

  const chartItems = performance.flatMap((aggregate) => {
    const value = hookMetricValue(aggregate, metric)
    return value === null ? [] : [{ id: aggregate.angle.id, label: aggregate.label, value, secondary: pluralize(aggregate.measured, "post"), href: `/ideas/angles?open=${aggregate.angle.id}` }]
  })
  const best = performance.filter((a) => a.measured >= 2 && a.avgViews !== null).sort((a, b) => (b.avgViews ?? 0) - (a.avgViews ?? 0))[0]
  const bestLift = best?.avgViews && overall.avgViews ? best.avgViews / overall.avgViews : null
  const metricMeta = ANGLE_METRICS.find((m) => m.id === metric)

  async function remove(angle: ContentAngle) {
    if (angle.is_default) return
    const s = stats.get(angle.id) ?? emptyAngleStats()
    const ok = await confirm({
      title: `Delete “${angle.name || "Untitled angle"}”?`,
      description: s.uses
        ? `${pluralize(s.ideaIds.length, "idea")} and ${pluralize(s.itemIds.length, "content piece")} use it — they keep everything else but lose the angle.`
        : "It isn't used by any idea or content yet.",
      confirmLabel: "Delete angle",
    })
    if (!ok) return
    if (openId === angle.id) setOpenId(null)
    dataActions.remove("angles", angle.id)
    toast.success("Angle deleted")
  }

  return (
    <PageContainer>
      <PageHeader
        title="Angle Library"
        description="The lens you take on a topic. Rotate angles to say the same expertise many ways — and see which ones your audience rewards."
        actions={
          <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
            <Plus aria-hidden />
            New angle
          </Button>
        }
      />

      {openId && !openAngle ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <span className="min-w-0 flex-1">The angle in this link no longer exists — it may have been deleted.</span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={() => setOpenId(null)}>
            <X aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <ChartFrame
          title="Which angles work best"
          description={`${metricMeta?.description ?? ""} · published posts with analytics, all time`}
          table={{
            columns: ["Angle", "Posts", "Avg views", "Engagement", "Leads / post"],
            rows: performance.map((a) => [
              a.label,
              a.measured,
              formatHookMetric(a.avgViews, "views"),
              formatHookMetric(a.engagementRate, "engagement"),
              formatHookMetric(a.leadsPerPost, "leads"),
            ]),
          }}
          footer={
            best && bestLift && bestLift >= 1.1 ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{best.label}</span> posts average {formatMultiple(bestLift)} your overall views.
              </p>
            ) : undefined
          }
        >
          <div className="flex min-w-0 flex-col gap-3">
            <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
              <ViewToggle value={metric} onChange={setMetric} options={ANGLE_METRICS.map((m) => ({ value: m.id, label: m.label }))} aria-label="Rank angles by" />
            </div>
            <BarList
              items={chartItems}
              limit={8}
              valueFormatter={(value) => formatHookMetric(value, metric)}
              emptyMessage="Log analytics on published posts to see which angles win."
              aria-label={`Angles ranked by ${metricMeta?.label.toLowerCase() ?? "views"}`}
            />
          </div>
        </ChartFrame>

        <SectionCard title="Untried angles" description="Never used in an idea or content yet — one click generates ideas with it." icon={Compass}>
          {untried.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {untried.map((angle) => (
                <li key={angle.id}>
                  <Link href={generatorHref(angle.id)} className={chipVariants({ size: "sm" })} title={angle.description || undefined}>
                    <Sparkles className="text-brand" aria-hidden />
                    {angle.name || "Untitled angle"}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-pretty text-muted-foreground">You&apos;ve used every angle in the library. Add a custom one to keep your range growing.</p>
          )}
        </SectionCard>
      </div>

      <section aria-label="Angles" className="flex min-w-0 flex-col gap-3">
        {angles.length ? (
          <>
            <FilterBar actions={<OptionSelect size="sm" options={SORT_OPTIONS} value={sort} onChange={(next) => next && setSort(next)} aria-label="Sort angles" className="w-40" />}>
              <SearchInput value={q} onChange={setQ} placeholder="Search angles…" />
              <ChipToggleGroup options={KIND_OPTIONS} value={kind} onChange={(next) => next && setKind(next)} required aria-label="Default or custom angles" />
            </FilterBar>
            <p className="text-xs text-muted-foreground num" aria-live="polite">
              {visible.length === angles.length ? pluralize(angles.length, "angle") : `${formatNumber(visible.length)} of ${pluralize(angles.length, "angle")}`}
              {" · "}
              {pluralize(angles.length - customCount, "default")} · {pluralize(customCount, "custom angle")}
            </p>
            {visible.length ? (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((angle) => (
                  <AngleCard key={angle.id} angle={angle} stats={stats.get(angle.id) ?? emptyAngleStats()} overall={overall} onOpen={setOpenId} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-card">
                <EmptyState
                  compact
                  icon={SearchX}
                  title={kind === "custom" && !q.trim() ? "No custom angles yet" : "No angles match"}
                  description={kind === "custom" && !q.trim() ? "Add a lens of your own — a format you keep coming back to, or a signature take." : "Try a different search or show all angles."}
                  action={
                    kind === "custom" && !q.trim() ? (
                      <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
                        <Plus aria-hidden />
                        New angle
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setQ("")
                          setKind("all")
                        }}
                      >
                        Show all angles
                      </Button>
                    )
                  }
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Compass}
            title="Your Angle Library is empty"
            description="Angles turn one topic into many pieces — a mistake, a story, a framework, a contrarian take. Add the lenses you want to rotate."
            action={
              <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
                <Plus aria-hidden />
                New angle
              </Button>
            }
          />
        )}
      </section>

      <AngleDetailSheet
        angle={shownAngle}
        open={Boolean(openAngle)}
        onOpenChange={(next) => {
          if (!next) setOpenId(null)
        }}
        stats={shownAngle ? (stats.get(shownAngle.id) ?? emptyAngleStats()) : emptyAngleStats()}
        overall={overall}
        onDelete={(angle) => void remove(angle)}
      />
      <AngleFormDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(angle) =>
          toast.success("Angle added", {
            description: angle.name,
            action: { label: "Generate ideas", onClick: () => router.push(generatorHref(angle.id)) },
          })
        }
      />
      {confirmDialog}
    </PageContainer>
  )
}
