"use client"

import { useState } from "react"
import { toast } from "sonner"
import { SeriesKey } from "@/components/charts"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { funnelGoalMessages } from "@/components/common/messages"
import { FUNNEL_STAGE_IDS, FUNNEL_STAGES } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { updateSettings } from "@/lib/store"
import type { FunnelStage, FunnelTargets } from "@/lib/types"
import { funnelMessages } from "./funnel-messages"
import { FUNNEL_COLORS } from "./funnel-utils"
import { sumValues, TARGET_TOTAL } from "./pillar-math"
import { pillarMessages } from "./pillar-messages"
import { TargetsEditor, type TargetValues } from "./targets-editor"

/** Edit settings.funnel_targets — whole numbers that must add up to exactly 100. */
export function FunnelTargetsDialog({
  open,
  onOpenChange,
  targets,
  actual,
  windowLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targets: FunnelTargets
  /** Actual share (0–100) per stage in the current window. */
  actual: Record<FunnelStage, number>
  windowLabel: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg">
        <TargetsForm targets={targets} actual={actual} windowLabel={windowLabel} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function TargetsForm({
  targets,
  actual,
  windowLabel,
  onDone,
}: {
  targets: FunnelTargets
  actual: Record<FunnelStage, number>
  windowLabel: string
  onDone: () => void
}) {
  const t = useT(funnelMessages)
  const p = useT(pillarMessages)
  const c = useT(commonMessages)
  const goal = useT(funnelGoalMessages)
  const [values, setValues] = useState<TargetValues>(() => ({ tofu: targets.tofu, mofu: targets.mofu, bofu: targets.bofu }))
  const valid = sumValues(FUNNEL_STAGE_IDS.map((s) => values[s])) === TARGET_TOTAL

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    const next: FunnelTargets = {
      tofu: Math.round(values.tofu ?? 0),
      mofu: Math.round(values.mofu ?? 0),
      bofu: Math.round(values.bofu ?? 0),
    }
    updateSettings({ funnel_targets: next })
    toast.success(t("targets_saved"), { description: `TOFU ${next.tofu}% · MOFU ${next.mofu}% · BOFU ${next.bofu}%` })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{t("targets_title")}</DialogTitle>
        <DialogDescription className="text-xs">{t("targets_description")}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <TargetsEditor
          idPrefix="funnel-target"
          values={values}
          onChange={setValues}
          rows={FUNNEL_STAGE_IDS.map((stage) => ({
            id: stage,
            label: `${FUNNEL_STAGES[stage].label} · ${FUNNEL_STAGES[stage].name}`,
            mark: <SeriesKey color={FUNNEL_COLORS[stage]} />,
            hint: t("target_hint", { goal: goal(stage), pct: Math.round(actual[stage]), window: windowLabel }),
          }))}
        />
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onDone}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {p("save_targets")}
        </Button>
      </DialogFooter>
    </form>
  )
}
