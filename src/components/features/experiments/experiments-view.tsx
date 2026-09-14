"use client"

import { FlaskConical, Plus } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, FilterBar, PageContainer, PageHeader, PageSection, SearchInput, StatTile } from "@/components/common"
import { Button } from "@/components/ui/button"
import { EXPERIMENT_STATUS_MAP } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { dataActions, useTable } from "@/lib/store"
import type { ContentExperiment } from "@/lib/types"
import { formatNumber, matchesQuery, pluralize } from "@/lib/utils"
import { ExperimentCard } from "./experiment-card"
import { ExperimentDetailSheet } from "./experiment-detail-sheet"
import { ExperimentFormDialog } from "./experiment-form-dialog"
import { experimentStats, groupExperiments, STATUS_COPY } from "./experiment-model"

export function ExperimentsView() {
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
        name: `${source.name} (again)`,
        hypothesis: source.hypothesis,
        variant_a: source.variant_a,
        variant_b: source.variant_b,
        metric: source.metric,
        status: "planned",
      })
      toast.success("Experiment duplicated", { description: "Set new dates and link fresh posts to run it again." })
      setOpen(copy.id)
    },
    [setOpen]
  )

  const newButton = (
    <Button type="button" size="sm" onClick={openCreate}>
      <Plus aria-hidden />
      New experiment
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Experiments"
        description="Test one variable at a time — hook length, video length, language, CTA — and turn every result into a rule you reuse."
        actions={newButton}
      />

      {experiments.length ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Running"
              value={formatNumber(stats.running)}
              sublabel={
                stats.nextEnd?.end_date ? `Next ends ${formatDate(stats.nextEnd.end_date, "MMM d")}` : stats.running ? "No end dates set" : "Nothing running"
              }
              href={stats.nextEnd ? `/experiments?open=${stats.nextEnd.id}` : undefined}
            />
            <StatTile
              label="Planned"
              value={formatNumber(stats.planned)}
              sublabel={
                stats.nextStart?.start_date
                  ? `Next starts ${formatDate(stats.nextStart.start_date, "MMM d")}`
                  : stats.planned
                    ? "No start dates set"
                    : "Nothing planned"
              }
              href={stats.nextStart ? `/experiments?open=${stats.nextStart.id}` : undefined}
            />
            <StatTile
              label="Completed"
              value={formatNumber(stats.completed)}
              sublabel={
                stats.completed
                  ? `${formatNumber(stats.decided)} with a winner${stats.completed > stats.decided ? ` · ${formatNumber(stats.completed - stats.decided)} inconclusive` : ""}`
                  : "No results yet"
              }
            />
            <StatTile
              label="Lessons learned"
              value={formatNumber(stats.lessons)}
              sublabel={stats.lessons ? `${formatNumber(stats.lessonIdeas)} turned into ideas` : "Record a lesson when a test ends"}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <FilterBar
              actions={
                <span className="text-xs text-muted-foreground num">
                  {filtered.length === experiments.length ? pluralize(experiments.length, "experiment") : `${filtered.length} of ${experiments.length}`}
                </span>
              }
            >
              <SearchInput value={query} onChange={setQuery} placeholder="Search experiments…" />
            </FilterBar>

            {groups.length ? (
              groups.map((group) => (
                <PageSection
                  key={group.status}
                  id={`experiments-${group.status}`}
                  title={`${EXPERIMENT_STATUS_MAP[group.status]?.label ?? group.status} · ${group.experiments.length}`}
                  description={STATUS_COPY[group.status]}
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
                title="No experiments match"
                description="Try a different word — search covers names, hypotheses, variants, results and lessons."
                action={
                  <Button type="button" size="sm" variant="outline" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={FlaskConical}
          title="No experiments yet"
          description="An experiment compares two versions of one variable — short vs long hooks, Taglish vs English — across real posts, so you stop guessing what works."
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
