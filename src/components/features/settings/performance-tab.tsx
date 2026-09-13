"use client"

import Link from "next/link"
import { useMemo } from "react"
import { toast } from "sonner"
import { Meter, NumberField, OptionSelect, SectionCard, StatusPill, TierBadge } from "@/components/common"
import { Label } from "@/components/ui/label"
import { contentBuffer, type BufferStatus } from "@/lib/analytics"
import { WINNER_METRIC_MAP, WINNER_METRICS } from "@/lib/constants"
import { updateSettings, useDb, useSettings } from "@/lib/store"
import type { PerformanceTier, WinnerMetric } from "@/lib/types"
import { pluralize } from "@/lib/utils"
import { SaveBar } from "./save-bar"
import { LIMITS, PERFORMANCE_DEFAULTS, performancePatch, validatePerformance, type PerformanceValues } from "./sections"
import { SettingRow, SettingRows } from "./setting-row"
import { formatTimes, tierFieldsFrom, TierPreview, TierScale } from "./tier-preview"
import { sameValues, type SettingsDraft } from "./use-settings-draft"

const METRIC_OPTIONS = WINNER_METRICS.map((m) => ({ value: m.id, label: m.label }))
const THRESHOLDS: { key: "tier_good" | "tier_winner" | "tier_breakout"; tier: PerformanceTier }[] = [
  { key: "tier_good", tier: "good" },
  { key: "tier_winner", tier: "winner" },
  { key: "tier_breakout", tier: "breakout" },
]
const BUFFER_TONE: Record<BufferStatus, "good" | "warning" | "serious"> = { healthy: "good", ok: "warning", low: "serious" }

export function PerformanceTab({ draft, now }: { draft: SettingsDraft<PerformanceValues>; now: Date }) {
  const { values, set } = draft
  const errors = validatePerformance(values)
  const valid = Object.keys(errors).length === 0
  const fields = useMemo(() => tierFieldsFrom(values), [values])
  const thresholdError = errors.tier_good ?? errors.tier_winner ?? errors.tier_breakout
  const metric = WINNER_METRIC_MAP[values.winner_metric]

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.dirty || !valid) return
    updateSettings(performancePatch(values))
    draft.discard()
    toast.success("Performance settings saved", { description: "Tiers, winners and the Content Buffer use the new rules." })
  }

  const rule = fields
    ? `Each post is compared with the average ${values.winner_metric === "composite" ? "performance" : (metric?.label.toLowerCase() ?? "performance")} of the previous ${fields.winner_window} measured posts on its platform · Good ≥ ${formatTimes(fields.tier_good)} · Winner ≥ ${formatTimes(fields.tier_winner)} · Breakout ≥ ${formatTimes(fields.tier_breakout)}`
    : null

  return (
    <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard
            title="Winner detection"
            description="Every measured post gets a ratio: its number ÷ the average of earlier posts on the same platform. The ratio sets its tier."
            footer={rule ? <span className="text-pretty">{rule}</span> : undefined}
          >
            <SettingRows>
              <SettingRow
                label="Compare by"
                htmlFor="settings-winner-metric"
                description="The number a post is judged on."
              >
                <OptionSelect
                  id="settings-winner-metric"
                  options={METRIC_OPTIONS}
                  value={values.winner_metric}
                  onChange={(next) => {
                    if (next) set("winner_metric", next as WinnerMetric)
                  }}
                  className="max-w-xs"
                />
                {metric?.description ? <p className="text-xs text-muted-foreground">{metric.description}.</p> : null}
              </SettingRow>
              <SettingRow
                label="Comparison window"
                htmlFor="settings-winner-window"
                description="How many earlier measured posts on the same platform make up the baseline."
                error={errors.winner_window}
              >
                <NumberField
                  id="settings-winner-window"
                  integer
                  min={LIMITS.window.min}
                  max={LIMITS.window.max}
                  value={values.winner_window}
                  onChange={(next) => set("winner_window", next)}
                  suffix="posts"
                  className="w-32"
                  aria-invalid={Boolean(errors.winner_window) || undefined}
                />
              </SettingRow>
              <SettingRow
                label="Minimum sample"
                htmlFor="settings-min-sample"
                description="A post is only tiered once its platform has at least this many earlier measured posts."
                error={errors.winner_min_sample}
              >
                <NumberField
                  id="settings-min-sample"
                  integer
                  min={1}
                  max={LIMITS.window.max}
                  value={values.winner_min_sample}
                  onChange={(next) => set("winner_min_sample", next)}
                  suffix="posts"
                  className="w-32"
                  aria-invalid={Boolean(errors.winner_min_sample) || undefined}
                />
              </SettingRow>
              <SettingRow
                label="Tier thresholds"
                labelId="settings-thresholds-label"
                description="Multiples of the platform average. Each tier must be higher than the one before."
                error={thresholdError}
              >
                <div role="group" aria-labelledby="settings-thresholds-label" className="grid max-w-md grid-cols-3 gap-2">
                  {THRESHOLDS.map(({ key, tier }) => (
                    <div key={key} className="flex min-w-0 flex-col gap-1.5">
                      <Label htmlFor={`settings-${key}`} className="font-normal">
                        <TierBadge tier={tier} />
                      </Label>
                      <NumberField
                        id={`settings-${key}`}
                        min={1}
                        max={LIMITS.threshold.max}
                        step={0.1}
                        value={values[key]}
                        onChange={(next) => set(key, next)}
                        suffix="×"
                        aria-invalid={Boolean(errors[key]) || undefined}
                      />
                    </div>
                  ))}
                </div>
                {fields ? <TierScale good={fields.tier_good} winner={fields.tier_winner} breakout={fields.tier_breakout} /> : null}
              </SettingRow>
            </SettingRows>
          </SectionCard>

          <SectionCard
            title="Content Buffer"
            description="Days of ready-to-post and scheduled content at your weekly post target."
          >
            <SettingRows>
              <SettingRow
                label="Healthy at"
                htmlFor="settings-buffer-healthy"
                description="At or above this many days the buffer shows as Healthy."
                error={errors.buffer_healthy_days}
              >
                <NumberField
                  id="settings-buffer-healthy"
                  integer
                  min={1}
                  max={LIMITS.bufferDays.max}
                  value={values.buffer_healthy_days}
                  onChange={(next) => set("buffer_healthy_days", next)}
                  suffix="days"
                  className="w-32"
                  aria-invalid={Boolean(errors.buffer_healthy_days) || undefined}
                />
              </SettingRow>
              <SettingRow
                label="Low below"
                htmlFor="settings-buffer-warning"
                description="Under this many days you'll see “Content Buffer Low”. In between, the buffer shows as OK."
                error={errors.buffer_warning_days}
              >
                <NumberField
                  id="settings-buffer-warning"
                  integer
                  min={0}
                  max={LIMITS.bufferDays.max}
                  value={values.buffer_warning_days}
                  onChange={(next) => set("buffer_warning_days", next)}
                  suffix="days"
                  className="w-32"
                  aria-invalid={Boolean(errors.buffer_warning_days) || undefined}
                />
              </SettingRow>
            </SettingRows>
            <BufferCheck
              healthy={errors.buffer_healthy_days || errors.buffer_warning_days ? null : values.buffer_healthy_days}
              warning={values.buffer_warning_days}
              now={now}
            />
          </SectionCard>
        </div>

        <TierPreview fields={fields} dirty={draft.dirty} now={now} className="xl:sticky xl:top-4" />
      </div>

      <SaveBar
        dirty={draft.dirty}
        valid={valid}
        onDiscard={draft.discard}
        onReset={() => draft.replace(PERFORMANCE_DEFAULTS)}
        resetDisabled={sameValues(values, PERFORMANCE_DEFAULTS)}
      />
    </form>
  )
}

/** Today's buffer judged with the edited thresholds. */
function BufferCheck({ healthy, warning, now }: { healthy: number | null; warning: number | null; now: Date }) {
  const db = useDb()
  const settings = useSettings()
  const buffer = useMemo(
    () =>
      healthy === null || warning === null
        ? null
        : contentBuffer(db, now, { ...settings, buffer_healthy_days: healthy, buffer_warning_days: warning }),
    [db, settings, healthy, warning, now]
  )
  if (!buffer || healthy === null) return null
  const tone = BUFFER_TONE[buffer.status]
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          <span className="font-semibold num">{buffer.days}</span> days of ready content today
        </span>
        <StatusPill tone={tone}>{buffer.label}</StatusPill>
      </div>
      <Meter
        value={buffer.days}
        max={Math.max(healthy * 1.5, buffer.days, 1)}
        target={healthy}
        tone={tone}
        size="sm"
        aria-label="Content Buffer days"
        valueText={`${buffer.days} days`}
      />
      <p className="text-xs text-muted-foreground">
        {pluralize(buffer.readyCount, "post")} ready to post or scheduled, at {settings.weekly_post_target} posts a week. The tick
        marks the healthy threshold.{" "}
        <Link href="/pipeline" className="font-medium text-foreground underline-offset-2 hover:underline">
          Pipeline
        </Link>
      </p>
    </div>
  )
}
