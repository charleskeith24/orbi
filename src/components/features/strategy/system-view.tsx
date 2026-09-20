"use client"

import { useMemo } from "react"
import { PageContainer, PageHeader } from "@/components/common"
import { useT, useUiLang } from "@/lib/i18n"
import { useBrand, useDb, useSettings } from "@/lib/store"
import { brandCompleteness, brandFormValues } from "./brand-model"
import { FlywheelCard } from "./flywheel"
import { systemMessages } from "./system-messages"
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
  const lang = useUiLang()
  const t = useT(systemMessages)

  const completeness = useMemo(() => brandCompleteness(brandFormValues(brand)).pct, [brand])
  const wheel = useMemo(() => flywheel(db, now, brand, lang), [db, now, brand, lang])
  const principles = useMemo(() => principleMetrics(db, now, settings, completeness, lang), [db, now, settings, completeness, lang])
  const rhythm = useMemo(() => rhythmEvidence(db, now, settings, lang), [db, now, settings, lang])
  const loop = useMemo(() => coreLoop(db, now, settings, completeness, lang), [db, now, settings, completeness, lang])

  return (
    <PageContainer>
      <PageHeader title="Flywheel & System" info={t("description")} />
      <FlywheelCard summary={wheel} />
      <PrinciplesList metrics={principles} />
      <OperatingRhythm evidence={rhythm} />
      <CoreLoop steps={loop} />
    </PageContainer>
  )
}
