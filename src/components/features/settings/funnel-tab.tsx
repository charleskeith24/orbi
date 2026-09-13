"use client"

import Link from "next/link"
import { useMemo } from "react"
import { toast } from "sonner"
import { MixBar, type MixSegment } from "@/components/charts"
import { FunnelBadge, NumberField, SectionCard, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { funnelMix } from "@/lib/analytics"
import { FUNNEL_STAGES } from "@/lib/constants"
import { updateSettings, useDb, useSettings } from "@/lib/store"
import type { CategoricalColor, FunnelStage } from "@/lib/types"
import { formatNumber, pluralize } from "@/lib/utils"
import { SaveBar } from "./save-bar"
import { FUNNEL_DEFAULTS, FUNNEL_KEYS, funnelPatch, funnelTotal, normalizeFunnel, validateFunnel, type FunnelValues } from "./sections"
import { SettingRow, SettingRows } from "./setting-row"
import { sameValues, type SettingsDraft } from "./use-settings-draft"

/** Fixed categorical order for the three stages. */
const STAGE_COLORS: Record<FunnelStage, CategoricalColor> = { tofu: "blue", mofu: "orange", bofu: "aqua" }

export function FunnelTab({ draft, now }: { draft: SettingsDraft<FunnelValues>; now: Date }) {
  const { values, set } = draft
  const errors = validateFunnel(values)
  const valid = Object.keys(errors).length === 0
  const total = funnelTotal(values)
  const fieldsValid = !errors.tofu && !errors.mofu && !errors.bofu

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.dirty || !valid) return
    updateSettings(funnelPatch(values))
    draft.discard()
    toast.success("Funnel targets saved")
  }

  return (
    <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-4">
      <SectionCard
        title="Target mix"
        description="What share of your content should serve each stage. Content Funnel, the dashboard and AI recommendations compare your recent mix with these targets."
      >
        <SettingRows>
          {FUNNEL_KEYS.map((stage) => {
            const meta = FUNNEL_STAGES[stage]
            return (
              <SettingRow
                key={stage}
                htmlFor={`settings-funnel-${stage}`}
                label={
                  <span className="flex items-center gap-2">
                    <FunnelBadge stage={stage} />
                    {meta.name}
                  </span>
                }
                description={`${meta.goal} — ${meta.examples.slice(0, 4).join(", ").toLowerCase()}.`}
                error={errors[stage]}
              >
                <NumberField
                  id={`settings-funnel-${stage}`}
                  integer
                  min={0}
                  max={100}
                  value={values[stage]}
                  onChange={(next) => set(stage, next)}
                  suffix="%"
                  className="w-28"
                  aria-invalid={Boolean(errors[stage]) || undefined}
                />
              </SettingRow>
            )
          })}
        </SettingRows>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
          <StatusPill tone={total === 100 ? "good" : "warning"}>
            <span className="num">Total {formatNumber(total)}%</span>
          </StatusPill>
          {total !== 100 ? (
            <>
              <span className="text-xs text-muted-foreground">Targets must add up to 100%.</span>
              {fieldsValid && total > 0 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => draft.replace(normalizeFunnel(values))}>
                  Normalize to 100%
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </SectionCard>

      <FunnelPreview values={valid ? values : draft.saved} usingSaved={!valid} now={now} />

      <SaveBar
        dirty={draft.dirty}
        valid={valid}
        invalidMessage={errors.total ?? "Fix the highlighted fields to save."}
        onDiscard={draft.discard}
        onReset={() => draft.replace(FUNNEL_DEFAULTS)}
        resetDisabled={sameValues(values, FUNNEL_DEFAULTS)}
      />
    </form>
  )
}

function FunnelPreview({ values, usingSaved, now }: { values: FunnelValues; usingSaved: boolean; now: Date }) {
  const db = useDb()
  const settings = useSettings()
  const mix = useMemo(
    () =>
      funnelMix(db, now, {
        ...settings,
        funnel_targets: { tofu: values.tofu ?? 0, mofu: values.mofu ?? 0, bofu: values.bofu ?? 0 },
      }),
    [db, settings, values, now]
  )

  const segments: MixSegment[] = mix.rows.map((row) => ({
    id: row.stage,
    label: `${FUNNEL_STAGES[row.stage].label} · ${FUNNEL_STAGES[row.stage].name}`,
    value: row.count,
    color: STAGE_COLORS[row.stage],
  }))
  const targets = mix.rows.map((row) => ({ id: row.stage, value: row.targetPct }))

  return (
    <SectionCard
      title="Last 30 days vs target"
      description={
        usingSaved
          ? "Showing your saved targets until the edited ones add up to 100%."
          : "Published and upcoming content with a funnel stage, against the targets above."
      }
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/pillars/funnel">Content Funnel</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <MixBar
          segments={segments}
          targets={targets}
          valueLabel="Posts"
          emptyMessage="No content with a funnel stage in the last 30 days."
          aria-label="Funnel mix in the last 30 days against targets"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {mix.enoughData ? (
            mix.warnings.length ? (
              mix.warnings.map((w) => (
                <StatusPill key={w.key} tone="warning">
                  {w.message}
                </StatusPill>
              ))
            ) : (
              <StatusPill tone="good">Within tolerance of every target</StatusPill>
            )
          ) : (
            <span>Too little recent content to judge the mix yet.</span>
          )}
          {mix.unassigned ? (
            <span>
              {pluralize(mix.unassigned, "item")} in this window {mix.unassigned === 1 ? "has" : "have"} no funnel stage —{" "}
              <Link href="/pillars/funnel" className="font-medium text-foreground underline-offset-2 hover:underline">
                assign stages
              </Link>
              .
            </span>
          ) : null}
        </div>
      </div>
    </SectionCard>
  )
}
