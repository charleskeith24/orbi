"use client"

import { Columns3, Plus, Scale, Sparkles } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { EmptyState, PageContainer, PageHeader } from "@/components/common"
import { Button } from "@/components/ui/button"
import { ReadOnlyNotice } from "@/components/features/team/team-ui"
import { PILLAR_PRESETS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { useCanWrite, useSettings } from "@/lib/store"
import type { ContentPillar } from "@/lib/types"
import { addPresetPillars, movePillar, setPillarActive } from "./pillar-actions"
import { PillarCard } from "./pillar-card"
import { PillarDetailSheet } from "./pillar-detail-sheet"
import { PillarFormDialog } from "./pillar-form-dialog"
import { activeTargetTotal, missingPresets } from "./pillar-math"
import { pillarMessages } from "./pillar-messages"
import { PillarMixCard } from "./pillar-mix-card"
import { PillarTargetsDialog } from "./pillar-targets-dialog"
import { PausedPillars } from "./paused-pillars"
import { RecommendedPillars } from "./recommended-pillars"
import { windowDays, WindowToggle, type MixWindow } from "./segmented-toggle"
import { usePillarDelete } from "./use-pillar-delete"
import { usePillarOverview } from "./use-pillar-overview"

/** Content Pillars (spec §6): pillar cards with target vs actual mix, performance, CRUD, reorder and targets. */
export function PillarsView() {
  const t = useT(pillarMessages)
  const canWrite = useCanWrite("content_pillars")
  const router = useRouter()
  const searchParams = useSearchParams()
  const settings = useSettings()
  const [now] = useState(() => new Date())
  const [range, setRange] = useState<MixWindow>("30")
  const days = windowDays(range)
  const windowLabel = t("window_label", { days })
  const overview = usePillarOverview(days, now)

  const [form, setForm] = useState<{ open: boolean; pillar: ContentPillar | null }>({ open: false, pillar: null })
  const [targetsOpen, setTargetsOpen] = useState(false)

  // `?open=<id>` drives the detail sheet; keep the last pillar mounted while the sheet animates out.
  const openId = searchParams.get("open")
  const openStats = openId ? (overview.all.find((s) => s.pillar.id === openId) ?? null) : null
  const [shownId, setShownId] = useState<string | null>(openId)
  if (openStats && openId !== shownId) setShownId(openId)
  const shownStats = overview.all.find((s) => s.pillar.id === shownId) ?? null

  const setOpen = useCallback(
    (id: string | null) => router.replace(id ? `/pillars?open=${id}` : "/pillars", { scroll: false }),
    [router]
  )
  const openTargets = useCallback(() => setTargetsOpen(true), [])
  const openCreate = () => setForm({ open: true, pillar: null })
  const openEdit = useCallback((pillar: ContentPillar) => setForm({ open: true, pillar }), [])
  const toggleActive = useCallback(
    (pillar: ContentPillar) => setPillarActive(pillar, !pillar.is_active, openTargets),
    [openTargets]
  )
  const beforeDelete = useCallback(
    (pillar: ContentPillar) => {
      if (pillar.id === openId) setOpen(null)
    },
    [openId, setOpen]
  )
  const [requestDelete, deleteDialog] = usePillarDelete(beforeDelete)

  const pillars = useMemo(() => overview.all.map((s) => s.pillar), [overview.all])
  const activePillars = useMemo(() => overview.active.map((s) => s.pillar), [overview.active])
  const missing = useMemo(() => missingPresets(pillars), [pillars])
  const actualById = useMemo(() => new Map(overview.mix.rows.map((r) => [r.pillar.id, r.actualPct])), [overview.mix.rows])
  const scaleMax = useMemo(() => {
    const peak = Math.max(0, ...overview.active.map((s) => Math.max(s.mix?.actualPct ?? 0, s.pillar.target_percentage)))
    return Math.min(100, Math.max(40, Math.ceil(peak / 10) * 10))
  }, [overview.active])

  return (
    <PageContainer>
      <PageHeader
        title="Content Pillars"
        info={t("description")}
        actions={
          <>
            <WindowToggle value={range} onChange={setRange} />
            <Button type="button" size="sm" variant="outline" onClick={openTargets} disabled={!activePillars.length || !canWrite}>
              <Scale aria-hidden />
              {t("set_targets")}
            </Button>
            <Button type="button" size="sm" onClick={openCreate} disabled={!canWrite}>
              <Plus aria-hidden />
              {t("new_pillar")}
            </Button>
          </>
        }
      />

      <ReadOnlyNotice table="content_pillars" />

      {pillars.length ? (
        <>
          {activePillars.length ? (
            <PillarMixCard
              mix={overview.mix}
              windowLabel={windowLabel}
              targetTotal={activeTargetTotal(activePillars)}
              tolerance={settings.pillar_tolerance}
              onSetTargets={openTargets}
            />
          ) : null}

          {overview.active.length ? (
            <section aria-label={t("active_pillars")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {overview.active.map((stats, index) => (
                <PillarCard
                  key={stats.pillar.id}
                  stats={stats}
                  enoughData={overview.mix.enoughData}
                  scaleMax={scaleMax}
                  windowLabel={windowLabel}
                  canMoveUp={index > 0}
                  canMoveDown={index < overview.active.length - 1}
                  onOpen={() => setOpen(stats.pillar.id)}
                  onEdit={() => openEdit(stats.pillar)}
                  onMove={(direction) => movePillar(stats.pillar.id, direction)}
                  onToggleActive={() => toggleActive(stats.pillar)}
                  onDelete={() => void requestDelete(stats.pillar)}
                />
              ))}
            </section>
          ) : (
            <EmptyState
              compact
              icon={Columns3}
              title={t("all_paused_title")}
              description={t("all_paused_description")}
            />
          )}

          <PausedPillars
            pillars={overview.paused.map((s) => s.pillar)}
            onOpen={setOpen}
            onActivate={(pillar) => setPillarActive(pillar, true, openTargets)}
          />
          <RecommendedPillars presets={missing} onAdd={(presets) => addPresetPillars(presets, openTargets)} />
        </>
      ) : (
        <EmptyState
          icon={Columns3}
          title={t("empty_title")}
          description={t("empty_description")}
          action={
            <Button type="button" size="sm" onClick={() => addPresetPillars([...PILLAR_PRESETS], openTargets)}>
              <Sparkles aria-hidden />
              {t("add_recommended")}
            </Button>
          }
          secondaryAction={
            <Button type="button" size="sm" variant="outline" onClick={openCreate}>
              <Plus aria-hidden />
              {t("new_pillar")}
            </Button>
          }
        />
      )}

      <PillarDetailSheet
        stats={shownStats}
        open={Boolean(openStats)}
        onOpenChange={(open) => {
          if (!open) setOpen(null)
        }}
        enoughData={overview.mix.enoughData}
        windowLabel={windowLabel}
        mixTotal={overview.mix.total}
        now={now}
        onEdit={openEdit}
        onToggleActive={toggleActive}
        onDelete={(pillar) => void requestDelete(pillar)}
      />

      <PillarFormDialog
        open={form.open}
        pillar={form.pillar}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onSetTargets={openTargets}
      />

      <PillarTargetsDialog
        open={targetsOpen}
        onOpenChange={setTargetsOpen}
        pillars={activePillars}
        actualById={actualById}
        windowLabel={windowLabel}
      />

      {deleteDialog}
    </PageContainer>
  )
}
