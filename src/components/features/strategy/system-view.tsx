"use client"

import { Orbit } from "lucide-react"
import { useMemo } from "react"
import { PageContainer, PageHeader } from "@/components/common"
import { useBrand, useDb, useSettings } from "@/lib/store"
import { brandCompleteness, brandFormValues } from "./brand-model"
import { FlywheelCard } from "./flywheel"
import { StrategyTabs } from "./strategy-tabs"
import { flywheel, principleMetrics } from "./system-model"
import { coreLoop, rhythmEvidence } from "./system-rhythm"
import { CoreLoop, OperatingRhythm, PrinciplesList } from "./system-sections"
import { useNow } from "./use-now"

/** Strategy → Flywheel & System (spec §1, §50, §51, §52): how the system compounds, measured live. */
export function SystemView() {
  const db = useDb()
  const settings = useSettings()
  const brand = useBrand()
  const now = useNow()

  const completeness = useMemo(() => brandCompleteness(brandFormValues(brand)).pct, [brand])
  const wheel = useMemo(() => flywheel(db, now, brand), [db, now, brand])
  const principles = useMemo(() => principleMetrics(db, now, settings, completeness), [db, now, settings, completeness])
  const rhythm = useMemo(() => rhythmEvidence(db, now, settings), [db, now, settings])
  const loop = useMemo(() => coreLoop(db, now, settings, completeness), [db, now, settings, completeness])

  return (
    <PageContainer>
      <PageHeader
        title="Flywheel & System"
        icon={Orbit}
        description="How the pieces compound — the flywheel your content turns, the principles the system enforces and the rhythm that keeps it moving."
      >
        <StrategyTabs />
      </PageHeader>
      <FlywheelCard summary={wheel} />
      <PrinciplesList metrics={principles} />
      <OperatingRhythm evidence={rhythm} />
      <CoreLoop steps={loop} />
    </PageContainer>
  )
}
