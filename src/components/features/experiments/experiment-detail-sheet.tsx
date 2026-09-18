"use client"

import { Copy, Ellipsis, Pencil, Trash2 } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"
import { DetailSheet, Meter, PageSection, useConfirm } from "@/components/common"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { experimentResults } from "@/lib/analytics"
import { todayISO } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useDb } from "@/lib/store"
import type { ContentExperiment, ExperimentStatus } from "@/lib/types"
import { ExperimentConclusion } from "./experiment-conclusion"
import { experimentSheetMessages } from "./detail-messages"
import { dateRangeLabel, experimentTiming, metricLabel, TRANSITIONS, transitionPatch, transitionToast } from "./experiment-model"
import { ExperimentResultsPanel } from "./experiment-results"
import { ExperimentStatusPill, VariantMark } from "./experiment-status"
import { ExperimentVariants } from "./experiment-variants"
import { experimentsMessages } from "./messages"

function StatusBar({ experiment, now }: { experiment: ContentExperiment; now: Date }) {
  const t = useT(experimentSheetMessages)
  const tx = useT(experimentsMessages)
  const lang = useUiLang()
  const timing = experimentTiming(experiment, now, lang)

  function move(to: ExperimentStatus) {
    const before = { status: experiment.status, start_date: experiment.start_date, end_date: experiment.end_date }
    dataActions.update("content_experiments", experiment.id, transitionPatch(experiment, to, todayISO()))
    toast.success(transitionToast(to, lang), {
      description: experiment.name,
      action: { label: t("undo"), onClick: () => dataActions.update("content_experiments", experiment.id, before) },
    })
  }

  return (
    <section aria-label={t("status")} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 dark:bg-muted/15">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ExperimentStatusPill status={experiment.status} />
        <span className="min-w-0 flex-1 basis-40 text-xs text-muted-foreground">{timing.label}</span>
        <div className="flex flex-wrap items-center gap-2">
          {TRANSITIONS[experiment.status].map((transition) => (
            <Button
              key={transition.to}
              type="button"
              size="sm"
              variant={transition.primary ? "default" : "outline"}
              onClick={() => move(transition.to)}
            >
              {tx(transition.label)}
            </Button>
          ))}
        </div>
      </div>
      {timing.progress !== null ? <Meter value={Math.round(timing.progress * 100)} size="sm" aria-label={tx("time_elapsed")} /> : null}
    </section>
  )
}

function Design({ experiment }: { experiment: ContentExperiment }) {
  const t = useT(experimentSheetMessages)
  return (
    <PageSection id="experiment-design" title={t("design")} description={t("design_description")}>
      {experiment.hypothesis ? (
        <p className="text-sm text-pretty">{experiment.hypothesis}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("no_hypothesis")}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {(["a", "b"] as const).map((variant) => (
          <div key={variant} className="flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2.5">
            <VariantMark variant={variant} className="mt-px" />
            <span className="min-w-0 text-sm text-pretty">
              {(variant === "a" ? experiment.variant_a : experiment.variant_b) || (
                <span className="text-muted-foreground">{t("not_described")}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </PageSection>
  )
}

/** `/experiments?open=<id>` — status, design, results, linked posts and the conclusion of one experiment. */
export function ExperimentDetailSheet({
  experiment,
  open,
  now,
  onOpenChange,
  onEdit,
  onDuplicate,
  onBeforeDelete,
}: {
  experiment: ContentExperiment | null
  open: boolean
  now: Date
  onOpenChange: (open: boolean) => void
  onEdit: (experiment: ContentExperiment) => void
  onDuplicate: (experiment: ContentExperiment) => void
  onBeforeDelete: () => void
}) {
  const t = useT(experimentSheetMessages)
  const tx = useT(experimentsMessages)
  const c = useT(commonMessages)
  const lang = useUiLang()
  const db = useDb()
  const [confirm, confirmDialog] = useConfirm()
  const results = useMemo(() => (experiment ? experimentResults(db, experiment, lang) : null), [db, experiment, lang])
  if (!experiment || !results) return confirmDialog

  async function remove(target: ContentExperiment) {
    const ok = await confirm({
      title: t("delete_title"),
      description: t("delete_description"),
      confirmLabel: t("delete_confirm"),
    })
    if (!ok) return
    onBeforeDelete()
    dataActions.remove("content_experiments", target.id)
    toast.success(t("deleted"), { description: target.name })
  }

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        title={experiment.name || tx("untitled")}
        description={`${metricLabel(experiment.metric)} · ${dateRangeLabel(experiment, lang)}`}
        onOpenAutoFocus={(event) => event.preventDefault()}
        actions={
          <>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("edit_experiment")} onClick={() => onEdit(experiment)}>
              <Pencil aria-hidden />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("more_actions")}>
                  <Ellipsis aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onDuplicate(experiment)}>
                  <Copy aria-hidden />
                  {t("duplicate")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => void remove(experiment)}>
                  <Trash2 aria-hidden />
                  {c("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <div className="flex flex-col gap-7">
          <StatusBar experiment={experiment} now={now} />
          <Design experiment={experiment} />
          <ExperimentResultsPanel experiment={experiment} results={results} />
          <ExperimentVariants experiment={experiment} results={results} />
          <ExperimentConclusion key={experiment.id} experiment={experiment} results={results} />
        </div>
      </DetailSheet>
      {confirmDialog}
    </>
  )
}
