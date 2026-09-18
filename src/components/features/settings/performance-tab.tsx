"use client"

import Link from "next/link"
import { useMemo } from "react"
import { toast } from "sonner"
import { Meter, NumberField, OptionSelect, SectionCard, StatusPill, TierBadge } from "@/components/common"
import { Label } from "@/components/ui/label"
import { contentBuffer, type BufferStatus } from "@/lib/analytics"
import { WINNER_METRIC_MAP, WINNER_METRICS } from "@/lib/constants"
import { useT, useUiLang } from "@/lib/i18n"
import { updateSettings, useDb, useSettings } from "@/lib/store"
import type { PerformanceTier, WinnerMetric } from "@/lib/types"
import { formatNumber } from "@/lib/utils"
import { performanceMessages } from "./performance-messages"
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
  const lang = useUiLang()
  const t = useT(performanceMessages)
  const errors = validatePerformance(values, lang)
  const valid = Object.keys(errors).length === 0
  const fields = useMemo(() => tierFieldsFrom(values), [values])
  const thresholdError = errors.tier_good ?? errors.tier_winner ?? errors.tier_breakout
  const metric = WINNER_METRIC_MAP[values.winner_metric]

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.dirty || !valid) return
    updateSettings(performancePatch(values))
    draft.discard()
    toast.success(t("saved"), { description: t("saved_description") })
  }

  const rule = fields
    ? t("rule", {
        metric: values.winner_metric === "composite" ? t("metric_performance") : (metric?.label.toLowerCase() ?? t("metric_performance")),
        window: fields.winner_window,
        good: formatTimes(fields.tier_good),
        winner: formatTimes(fields.tier_winner),
        breakout: formatTimes(fields.tier_breakout),
      })
    : null

  return (
    <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard
            title={t("winner_title")}
            description={t("winner_description")}
            footer={rule ? <span className="text-pretty">{rule}</span> : undefined}
          >
            <SettingRows>
              <SettingRow
                label={t("compare_label")}
                htmlFor="settings-winner-metric"
                description={t("compare_description")}
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
                label={t("window_label")}
                htmlFor="settings-winner-window"
                description={t("window_description")}
                error={errors.winner_window}
              >
                <NumberField
                  id="settings-winner-window"
                  integer
                  min={LIMITS.window.min}
                  max={LIMITS.window.max}
                  value={values.winner_window}
                  onChange={(next) => set("winner_window", next)}
                  suffix={t("suffix_posts")}
                  className="w-32"
                  aria-invalid={Boolean(errors.winner_window) || undefined}
                />
              </SettingRow>
              <SettingRow
                label={t("min_sample_label")}
                htmlFor="settings-min-sample"
                description={t("min_sample_description")}
                error={errors.winner_min_sample}
              >
                <NumberField
                  id="settings-min-sample"
                  integer
                  min={1}
                  max={LIMITS.window.max}
                  value={values.winner_min_sample}
                  onChange={(next) => set("winner_min_sample", next)}
                  suffix={t("suffix_posts")}
                  className="w-32"
                  aria-invalid={Boolean(errors.winner_min_sample) || undefined}
                />
              </SettingRow>
              <SettingRow
                label={t("thresholds_label")}
                labelId="settings-thresholds-label"
                description={t("thresholds_description")}
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
            description={t("buffer_description")}
          >
            <SettingRows>
              <SettingRow
                label={t("healthy_label")}
                htmlFor="settings-buffer-healthy"
                description={t("healthy_description")}
                error={errors.buffer_healthy_days}
              >
                <NumberField
                  id="settings-buffer-healthy"
                  integer
                  min={1}
                  max={LIMITS.bufferDays.max}
                  value={values.buffer_healthy_days}
                  onChange={(next) => set("buffer_healthy_days", next)}
                  suffix={t("suffix_days")}
                  className="w-32"
                  aria-invalid={Boolean(errors.buffer_healthy_days) || undefined}
                />
              </SettingRow>
              <SettingRow
                label={t("low_label")}
                htmlFor="settings-buffer-warning"
                description={t("low_description")}
                error={errors.buffer_warning_days}
              >
                <NumberField
                  id="settings-buffer-warning"
                  integer
                  min={0}
                  max={LIMITS.bufferDays.max}
                  value={values.buffer_warning_days}
                  onChange={(next) => set("buffer_warning_days", next)}
                  suffix={t("suffix_days")}
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
  const lang = useUiLang()
  const t = useT(performanceMessages)
  const buffer = useMemo(
    () =>
      healthy === null || warning === null
        ? null
        : contentBuffer(db, now, { ...settings, buffer_healthy_days: healthy, buffer_warning_days: warning }, lang),
    [db, settings, healthy, warning, now, lang]
  )
  if (!buffer || healthy === null) return null
  const tone = BUFFER_TONE[buffer.status]
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          <span className="font-semibold num">{buffer.days}</span> {t("buffer_days")}
        </span>
        <StatusPill tone={tone}>{buffer.label}</StatusPill>
      </div>
      <Meter
        value={buffer.days}
        max={Math.max(healthy * 1.5, buffer.days, 1)}
        target={healthy}
        tone={tone}
        size="sm"
        aria-label={t("buffer_aria")}
        valueText={t("buffer_value", { days: buffer.days })}
      />
      <p className="text-xs text-muted-foreground">
        {t("buffer_note", {
          posts: t.plural("posts", buffer.readyCount, { count: formatNumber(buffer.readyCount) }),
          target: settings.weekly_post_target,
        })}{" "}
        <Link href="/pipeline" className="font-medium text-foreground underline-offset-2 hover:underline">
          Pipeline
        </Link>
      </p>
    </div>
  )
}
