"use client"

import { Scale } from "lucide-react"
import { useMemo, useState } from "react"
import { PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { funnelMix, funnelPerformance, type FunnelAggregate, type FunnelMixRow } from "@/lib/analytics"
import { FUNNEL_STAGE_IDS } from "@/lib/constants"
import { useDb, useSettings } from "@/lib/store"
import type { FunnelStage, FunnelTargets } from "@/lib/types"
import { FunnelDistributionCard, FunnelPerformanceCard } from "./funnel-charts"
import { FunnelStageCard } from "./funnel-stage-card"
import { FunnelTargetsDialog } from "./funnel-targets-dialog"
import { contentByStage } from "./funnel-utils"
import { PillarsTabs } from "./pillars-tabs"
import { windowDays, WindowToggle, type MixWindow } from "./segmented-toggle"
import { UnassignedItems } from "./unassigned-items"

/** Content Funnel (spec §8): TOFU / MOFU / BOFU distribution vs targets, performance per stage and quick-assign. */
export function FunnelView() {
  const db = useDb()
  const settings = useSettings()
  const [now] = useState(() => new Date())
  const [range, setRange] = useState<MixWindow>("30")
  const [targetsOpen, setTargetsOpen] = useState(false)
  const days = windowDays(range)
  const windowLabel = `last ${days} days`

  const targets: FunnelTargets = {
    tofu: settings.funnel_targets?.tofu ?? 0,
    mofu: settings.funnel_targets?.mofu ?? 0,
    bofu: settings.funnel_targets?.bofu ?? 0,
  }

  const data = useMemo(() => {
    const mix = funnelMix(db, now, settings, { days })
    const perf = funnelPerformance(db, now, { days, settings })
    const mixByStage = new Map<FunnelStage, FunnelMixRow>(mix.rows.map((r) => [r.stage, r]))
    const perfByStage = new Map<FunnelStage, FunnelAggregate>()
    for (const row of perf) if (row.stage) perfByStage.set(row.stage, row)
    return { mix, perf, mixByStage, perfByStage, content: contentByStage(db.content_items) }
  }, [db, now, settings, days])

  const actual = Object.fromEntries(
    FUNNEL_STAGE_IDS.map((s) => [s, data.mixByStage.get(s)?.actualPct ?? 0])
  ) as Record<FunnelStage, number>
  const peak = Math.max(0, ...FUNNEL_STAGE_IDS.map((s) => Math.max(actual[s], targets[s])))
  const scaleMax = Math.min(100, Math.max(60, Math.ceil(peak / 10) * 10))

  return (
    <PageContainer>
      <PageHeader
        title="Content Funnel"
        description="Awareness brings new people in, trust turns them into followers who believe you, conversion creates an action. Balance all three."
        actions={
          <>
            <WindowToggle value={range} onChange={setRange} />
            <Button type="button" size="sm" variant="outline" onClick={() => setTargetsOpen(true)}>
              <Scale aria-hidden />
              Edit targets
            </Button>
          </>
        }
      >
        <PillarsTabs />
      </PageHeader>

      <section aria-label="Funnel stages" className="grid gap-4 xl:grid-cols-3">
        {FUNNEL_STAGE_IDS.map((stage) => (
          <FunnelStageCard
            key={stage}
            stage={stage}
            mix={data.mixByStage.get(stage)}
            perf={data.perfByStage.get(stage)}
            target={targets[stage]}
            content={data.content[stage]}
            enoughData={data.mix.enoughData}
            scaleMax={scaleMax}
            windowLabel={windowLabel}
          />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelDistributionCard
          mix={data.mix}
          windowLabel={windowLabel}
          targetTotal={targets.tofu + targets.mofu + targets.bofu}
          onEditTargets={() => setTargetsOpen(true)}
        />
        <FunnelPerformanceCard perf={data.perf} windowLabel={windowLabel} />
      </div>

      <UnassignedItems />

      <FunnelTargetsDialog
        open={targetsOpen}
        onOpenChange={setTargetsOpen}
        targets={targets}
        actual={actual}
        windowLabel={windowLabel}
      />
    </PageContainer>
  )
}
