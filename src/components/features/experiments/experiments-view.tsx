"use client"

import { FlaskConical, Plus } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, FilterBar, PageContainer, PageHeader, PageSection, SearchInput, StatTile } from "@/components/common"
import { Button } from "@/components/ui/button"
import { EXPERIMENT_STATUS_MAP } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { dataActions, useTable } from "@/lib/store"
import type { ContentExperiment } from "@/lib/types"
import { formatNumber, matchesQuery } from "@/lib/utils"
import { ExperimentCard } from "./experiment-card"
import { ExperimentDetailSheet } from "./experiment-detail-sheet"
import { ExperimentFormDialog } from "./experiment-form-dialog"
import { experimentStats, groupExperiments, statusCopy } from "./experiment-model"
import { experimentsMessages } from "./messages"

export function ExperimentsView() {
  const t = useT(experimentsMessages)
  const lang = useUiLang()
  const router = useRouter()
  const searchParams = useSearchParams()
  const experiments = useTable("content_experiments")
  const ideas = useTable("content_ideas")
  const [now] = useState(() => new Date())
  const [query, setQuery] = useState("")
  const [form, setForm] = useState<{ open: boolean; experiment: ContentExperiment | null }>({ open: false, experiment: null })

  const stats = useMemo(() => experimentStats(experiments, ideas), [experiments, ideas])
  const filtered = useMemo(
    () => experiments.filter((e) => matchesQuery(query, e.name, e.hypothesis, e.variant_a, e.variant_b, e.result, e.lesson)),
    [experiments, query]
  )
  const groups = useMemo(() => groupExperiments(filtered), [filtered])

  // `?open=<id>` drives the detail sheet; keep the last one mounted while the sheet animates out.
  const openId = searchParams.get("open")
  const openExperiment = openId ? (experiments.find((e) => e.id === openId) ?? null) : null
  const [shownId, setShownId] = useState<string | null>(openId)
  if (openExperiment && openId !== shownId) setShownId(openId)
  const shownExperiment = experiments.find((e) => e.id === shownId) ?? null

  const setOpen = useCallback(
    (id: string | null) => router.replace(id ? `/experiments?open=${id}` : "/experiments", { scroll: false }),
    [router]
  )

  const openCreate = () => setForm({ open: true, experiment: null })
  const openEdit = useCallback((experiment: ContentExperiment) => setForm({ open: true, experiment }), [])
  const duplicate = useCallback(
    (source: ContentExperiment) => {
      const copy = dataActions.insert("content_experiments", {
        name: t("duplicate_name", { name: source.name }),
        hypothesis: source.hypothesis,
        variant_a: source.variant_a,
        variant_b: source.variant_b,
        metric: source.metric,
        status: "planned",
      })
      toast.success(t("duplicated"), { description: t("duplicated_description") })
      setOpen(copy.id)
    },
    [setOpen, t]
  )

  const newButton = (
    <Button type="button" size="sm" onClick={openCreate}>
      <Plus aria-hidden />
      {t("new_experiment")}
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Experiments"
        description={t("description")}
        actions={newButton}
      />

      {experiments.length ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Running"
              value={formatNumber(stats.running)}
              sublabel={
                stats.nextEnd?.end_date
                  ? t("next_ends", { date: formatDate(stats.nextEnd.end_date, "MMM d") })
                  : stats.running
                    ? t("no_end_dates")
                    : t("nothing_running")
              }
              href={stats.nextEnd ? `/experiments?open=${stats.nextEnd.id}` : undefined}
            />
            <StatTile
              label="Planned"
              value={formatNumber(stats.planned)}
              sublabel={
                stats.nextStart?.start_date
                  ? t("next_starts", { date: formatDate(stats.nextStart.start_date, "MMM d") })
                  : stats.planned
                    ? t("no_start_dates")
                    : t("nothing_planned")
              }
              href={stats.nextStart ? `/experiments?open=${stats.nextStart.id}` : undefined}
            />
            <StatTile
              label="Completed"
              value={formatNumber(stats.completed)}
              sublabel={
                stats.completed
                  ? `${t("with_winner", { count: formatNumber(stats.decided) })}${stats.completed > stats.decided ? t("inconclusive_count", { count: formatNumber(stats.completed - stats.decided) }) : ""}`
                  : t("no_results_yet")
              }
            />
            <StatTile
              label={t("lessons_learned")}
              value={formatNumber(stats.lessons)}
              sublabel={stats.lessons ? t("lessons_ideas", { count: formatNumber(stats.lessonIdeas) }) : t("lessons_hint")}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <FilterBar
              actions={
                <span className="text-xs text-muted-foreground num">
                  {filtered.length === experiments.length
                    ? t.plural("count", experiments.length, { count: formatNumber(experiments.length) })
                    : t("shown_of", { shown: filtered.length, total: experiments.length })}
                </span>
              }
            >
              <SearchInput value={query} onChange={setQuery} placeholder={t("search_placeholder")} />
            </FilterBar>

            {groups.length ? (
              groups.map((group) => (
                <PageSection
                  key={group.status}
                  id={`experiments-${group.status}`}
                  title={`${EXPERIMENT_STATUS_MAP[group.status]?.label ?? group.status} · ${group.experiments.length}`}
                  description={statusCopy(group.status, lang)}
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.experiments.map((experiment) => (
                      <ExperimentCard key={experiment.id} experiment={experiment} now={now} onOpen={setOpen} />
                    ))}
                  </div>
                </PageSection>
              ))
            ) : (
              <EmptyState
                compact
                icon={FlaskConical}
                title={t("nomatch_title")}
                description={t("nomatch_description")}
                action={
                  <Button type="button" size="sm" variant="outline" onClick={() => setQuery("")}>
                    {t("clear_search")}
                  </Button>
                }
              />
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={FlaskConical}
          title={t("empty_title")}
          description={t("empty_description")}
          action={newButton}
        />
      )}

      <ExperimentDetailSheet
        experiment={shownExperiment}
        open={Boolean(openExperiment)}
        now={now}
        onOpenChange={(open) => {
          if (!open) setOpen(null)
        }}
        onEdit={openEdit}
        onDuplicate={duplicate}
        onBeforeDelete={() => setOpen(null)}
      />

      <ExperimentFormDialog
        open={form.open}
        experiment={form.experiment}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={(row, created) => {
          if (created) setOpen(row.id)
        }}
      />
    </PageContainer>
  )
}
