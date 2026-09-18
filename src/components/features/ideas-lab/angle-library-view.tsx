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
import { useT } from "@/lib/i18n"
import { dataActions, useDb } from "@/lib/store"
import type { ContentAngle, ID } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { AngleCard } from "./angle-card"
import { AngleDetailSheet } from "./angle-detail-sheet"
import { AngleFormDialog } from "./angle-form-dialog"
import { angleMessages } from "./angle-messages"
import {
  ANGLE_SORTS,
  anglesToRotate,
  angleStats,
  emptyAngleStats,
  filterAngles,
  generatorHref,
  sortAngles,
  type AngleKind,
  type AngleSort,
} from "./angle-model"
import { formatHookMetric, HOOK_METRICS, hookMetricValue, overallPerformance, type HookMetric } from "./hook-model"
import { labMessages } from "./messages"
import { useOpenParam } from "./use-open-param"

const ANGLE_KINDS: AngleKind[] = ["all", "default", "custom"]
const ANGLE_METRICS = HOOK_METRICS.filter((m) => m !== "retention")

/**
 * Angle Library (spec §11, §57): the default and custom angles with usage and average performance.
 * Custom angles can be deleted; defaults can only be edited. `?open=<angleId>` opens the detail sheet.
 */
export function AngleLibraryView() {
  const router = useRouter()
  const t = useT(angleMessages)
  const l = useT(labMessages)
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
  const rotate = useMemo(() => anglesToRotate(angles, stats), [angles, stats])
  const untried = useMemo(() => angles.filter((a) => (stats.get(a.id)?.uses ?? 0) === 0).length, [angles, stats])
  const customCount = useMemo(() => angles.filter((a) => !a.is_default).length, [angles])
  const sortOptions = useMemo<SelectOption<AngleSort>[]>(() => ANGLE_SORTS.map((id) => ({ value: id, label: l(`sort_${id}`) })), [l])
  const kindOptions = useMemo(() => ANGLE_KINDS.map((value) => ({ value, label: t(`kind_${value}`) })), [t])
  const count = (key: "ideas" | "pieces" | "angles" | "defaults" | "custom", n: number) => t.plural(key, n, { count: formatNumber(n) })

  const angleById = useMemo(() => new Map(angles.map((a) => [a.id, a])), [angles])
  const openAngle = openId ? angleById.get(openId) : undefined
  const [shownId, setShownId] = useState<ID | null>(openAngle ? openAngle.id : null)
  if (openAngle && openAngle.id !== shownId) setShownId(openAngle.id)
  const shownAngle = shownId ? (angleById.get(shownId) ?? null) : null

  const chartItems = performance.flatMap((aggregate) => {
    const value = hookMetricValue(aggregate, metric)
    return value === null
      ? []
      : [
          {
            id: aggregate.angle.id,
            label: aggregate.label,
            value,
            secondary: l.plural("posts_count", aggregate.measured, { count: formatNumber(aggregate.measured) }),
            href: `/ideas/angles?open=${aggregate.angle.id}`,
          },
        ]
  })
  const best = performance.filter((a) => a.measured >= 2 && a.avgViews !== null).sort((a, b) => (b.avgViews ?? 0) - (a.avgViews ?? 0))[0]
  const bestLift = best?.avgViews && overall.avgViews ? best.avgViews / overall.avgViews : null
  const [footerBefore, footerAfter] = t("chart_footer", { multiple: bestLift ? formatMultiple(bestLift) : "" }).split("{angle}")

  async function remove(angle: ContentAngle) {
    if (angle.is_default) return
    const s = stats.get(angle.id) ?? emptyAngleStats()
    const ok = await confirm({
      title: t("delete_title", { name: angle.name || t("untitled_angle") }),
      description: s.uses
        ? t("delete_used", { ideas: count("ideas", s.ideaIds.length), pieces: count("pieces", s.itemIds.length) })
        : t("delete_unused"),
      confirmLabel: t("delete_confirm"),
    })
    if (!ok) return
    if (openId === angle.id) setOpenId(null)
    dataActions.remove("angles", angle.id)
    toast.success(t("deleted"))
  }

  return (
    <PageContainer>
      <PageHeader
        title="Angle Library"
        description={t("description")}
        actions={
          <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
            <Plus aria-hidden />
            {t("new_angle")}
          </Button>
        }
      />

      {openId && !openAngle ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <span className="min-w-0 flex-1">{t("missing_link")}</span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={l("dismiss")} onClick={() => setOpenId(null)}>
            <X aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <ChartFrame
          title={t("chart_title")}
          description={l("analytics_scope", { description: l(`metric_${metric}_description`) })}
          table={{
            columns: [t("col_angle"), l("posts"), l("avg_views"), l("engagement"), l("leads_per_post")],
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
                {footerBefore}
                <span className="font-medium text-foreground">{best.label}</span>
                {footerAfter}
              </p>
            ) : undefined
          }
        >
          <div className="flex min-w-0 flex-col gap-3">
            <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
              <ViewToggle value={metric} onChange={setMetric} options={ANGLE_METRICS.map((m) => ({ value: m, label: l(`metric_${m}`) }))} aria-label={t("rank_by")} />
            </div>
            <BarList
              items={chartItems}
              limit={8}
              valueFormatter={(value) => formatHookMetric(value, metric)}
              emptyMessage={t("chart_empty")}
              aria-label={t("ranked_by", { metric: l(`metric_${metric}`).toLowerCase() })}
            />
          </div>
        </ChartFrame>

        <SectionCard
          title={t("rotate_title")}
          description={untried ? t.plural("rotate_untried", untried, { count: formatNumber(untried) }) : t("rotate_all_used")}
          icon={Compass}
        >
          {rotate.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {rotate.map((angle) => {
                const uses = stats.get(angle.id)?.uses ?? 0
                const name = angle.name || t("untitled_angle")
                return (
                  <li key={angle.id}>
                    <Link
                      href={generatorHref(angle.id)}
                      className={chipVariants({ size: "sm" })}
                      title={angle.description || undefined}
                      aria-label={t("rotate_chip", { name, uses: uses ? t.plural("uses", uses, { count: formatNumber(uses) }) : t("never_used") })}
                    >
                      <Sparkles className="text-brand" aria-hidden />
                      {name}
                      <span className="font-normal text-muted-foreground num">{uses ? formatNumber(uses) : t("new_chip")}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-pretty text-muted-foreground">{t("rotate_empty")}</p>
          )}
        </SectionCard>
      </div>

      <section aria-label={t("angles_label")} className="flex min-w-0 flex-col gap-3">
        {angles.length ? (
          <>
            <FilterBar
              actions={<OptionSelect size="sm" options={sortOptions} value={sort} onChange={(next) => next && setSort(next)} aria-label={t("sort_label")} className="w-40" />}
            >
              <SearchInput value={q} onChange={setQ} placeholder={t("search_placeholder")} />
              <ChipToggleGroup options={kindOptions} value={kind} onChange={(next) => next && setKind(next)} required aria-label={t("kind_label")} />
            </FilterBar>
            <p className="text-xs text-muted-foreground num" aria-live="polite">
              {visible.length === angles.length
                ? count("angles", angles.length)
                : t.plural("angles_of", angles.length, { shown: formatNumber(visible.length), count: formatNumber(angles.length) })}
              {" · "}
              {count("defaults", angles.length - customCount)} · {count("custom", customCount)}
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
                  title={kind === "custom" && !q.trim() ? t("no_custom_title") : t("nomatch_title")}
                  description={kind === "custom" && !q.trim() ? t("no_custom_description") : t("nomatch_description")}
                  action={
                    kind === "custom" && !q.trim() ? (
                      <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
                        <Plus aria-hidden />
                        {t("new_angle")}
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
                        {t("show_all")}
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
            title={t("empty_title")}
            description={t("empty_description")}
            action={
              <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
                <Plus aria-hidden />
                {t("new_angle")}
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
          toast.success(t("added"), {
            description: angle.name,
            action: { label: t("generate_ideas"), onClick: () => router.push(generatorHref(angle.id)) },
          })
        }
      />
      {confirmDialog}
    </PageContainer>
  )
}
