"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { chipVariants, NumberField, OptionSelect, SectionCard, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { funnelMix, pillarMix } from "@/lib/analytics"
import { CURRENCIES } from "@/lib/constants"
import { translate, UI_LANG_LABELS, UI_LANGS, useT, type UiLang } from "@/lib/i18n"
import { updateSettings, useDb, useSettings } from "@/lib/store"
import { pluralize } from "@/lib/utils"
import { generalMessages } from "./general-messages"
import { SaveBar } from "./save-bar"
import { generalPatch, generalResetValues, LIMITS, validateGeneral, type GeneralValues } from "./sections"
import { SettingRow, SettingRows } from "./setting-row"
import { TimezoneSelect } from "./timezone-select"
import { sameValues, type SettingsDraft } from "./use-settings-draft"

const WEEK_START_OPTIONS = [
  { value: "1" as const, label: "Monday" },
  { value: "0" as const, label: "Sunday" },
]

const LANGUAGE_OPTIONS = UI_LANGS.map((lang) => ({ value: lang, label: UI_LANG_LABELS[lang] }))

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
  } catch {
    return ""
  }
}

export function GeneralTab({ draft, now }: { draft: SettingsDraft<GeneralValues>; now: Date }) {
  const { values, set } = draft
  const g = useT(generalMessages)
  const errors = validateGeneral(values)
  const valid = Object.keys(errors).length === 0
  const [deviceZone] = useState(deviceTimeZone)
  const resetValues = generalResetValues(values)
  // A stored code outside the list (e.g. from an import) stays selectable.
  const currencyOptions = useMemo(() => {
    const options = CURRENCIES.map((c) => ({ value: c.id, label: `${c.id} — ${c.label}` }))
    return options.some((o) => o.value === values.currency) ? options : [...options, { value: values.currency, label: values.currency }]
  }, [values.currency])

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.dirty || !valid) return
    updateSettings(generalPatch(values))
    draft.discard()
    // Confirm in the language just chosen.
    toast.success(translate(generalMessages, values.ui_language, "saved"))
  }

  return (
    <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-4">
      <SectionCard title={g("display_title")} description={g("display_description")}>
        <SettingRows>
          <SettingRow label={g("language_label")} htmlFor="settings-ui-language" description={g("language_description")}>
            <OptionSelect<UiLang>
              id="settings-ui-language"
              options={LANGUAGE_OPTIONS}
              value={values.ui_language}
              onChange={(next) => {
                if (next) set("ui_language", next)
              }}
              className="w-44"
            />
          </SettingRow>
          <SettingRow label={g("simple_label")} htmlFor="settings-simple-mode" description={g("simple_description")}>
            <div className="flex min-h-8 items-center gap-2.5">
              <Switch
                id="settings-simple-mode"
                checked={values.simple_mode}
                onCheckedChange={(checked) => set("simple_mode", checked)}
              />
              <span className="text-sm text-muted-foreground">{values.simple_mode ? g("simple_on") : g("simple_off")}</span>
            </div>
          </SettingRow>
          <SettingRow
            label={g("currency_label")}
            htmlFor="settings-currency"
            description={g("currency_description")}
            error={errors.currency}
          >
            <OptionSelect
              id="settings-currency"
              options={currencyOptions}
              value={values.currency}
              onChange={(next) => {
                if (next) set("currency", next)
              }}
              className="w-64 max-w-full"
              aria-invalid={Boolean(errors.currency) || undefined}
            />
          </SettingRow>
        </SettingRows>
      </SectionCard>

      <SectionCard title="Posting rhythm" description="The cadence every weekly number is measured against.">
        <SettingRows>
          <SettingRow
            label="Weekly post target"
            htmlFor="settings-weekly-target"
            description="Posts you aim to publish each week across all platforms. Drives posting progress, the Content Buffer and the Weekly Planner."
            error={errors.weekly_post_target}
          >
            <NumberField
              id="settings-weekly-target"
              integer
              min={LIMITS.weeklyTarget.min}
              max={LIMITS.weeklyTarget.max}
              value={values.weekly_post_target}
              onChange={(next) => set("weekly_post_target", next)}
              suffix="posts / week"
              className="w-44"
              aria-invalid={Boolean(errors.weekly_post_target) || undefined}
            />
            <PlanCrossCheck target={values.weekly_post_target} />
          </SettingRow>
          <SettingRow
            label="Week starts on"
            htmlFor="settings-week-start"
            description="Weekly posting progress, reports, the calendar and the planner all use this boundary."
          >
            <OptionSelect
              id="settings-week-start"
              options={WEEK_START_OPTIONS}
              value={values.week_starts_on === 0 ? "0" : "1"}
              onChange={(next) => {
                if (next) set("week_starts_on", next === "0" ? 0 : 1)
              }}
              className="w-44"
            />
          </SettingRow>
        </SettingRows>
      </SectionCard>

      <SectionCard title="Workspace" description="Defaults for new work.">
        <SettingRows>
          <SettingRow
            label="Timezone"
            htmlFor="settings-timezone"
            description="Given to the AI as your local context. Calendar dates follow this device's clock."
            error={errors.timezone}
          >
            <TimezoneSelect
              id="settings-timezone"
              value={values.timezone}
              onChange={(next) => set("timezone", next)}
              now={now}
              invalid={Boolean(errors.timezone)}
            />
            {deviceZone && deviceZone !== values.timezone ? (
              <p className="text-xs text-muted-foreground">
                This device is set to <span className="font-medium text-foreground">{deviceZone.replace(/_/g, " ")}</span>.{" "}
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto px-0 text-xs"
                  onClick={() => set("timezone", deviceZone)}
                >
                  Use it
                </Button>
              </p>
            ) : null}
          </SettingRow>
          <SettingRow
            label="Default owner"
            htmlFor="settings-default-owner"
            description="Assigned to new content items. Change it per item in Content Studio or on the Pipeline."
            error={errors.default_owner}
          >
            <Input
              id="settings-default-owner"
              value={values.default_owner}
              maxLength={LIMITS.ownerLength + 20}
              placeholder="e.g. Maria"
              className="max-w-xs"
              aria-invalid={Boolean(errors.default_owner) || undefined}
              onChange={(event) => set("default_owner", event.target.value)}
            />
            <OwnerSuggestions current={values.default_owner} onPick={(owner) => set("default_owner", owner)} />
          </SettingRow>
        </SettingRows>
      </SectionCard>

      <SectionCard title="Content mix" description="How strictly the pillar and funnel mix are checked.">
        <SettingRows>
          <SettingRow
            label="Mix tolerance"
            htmlFor="settings-pillar-tolerance"
            description="How far a pillar's share of the last 30 days may drift from its target before the dashboard flags an unbalanced mix. The funnel mix uses the same tolerance."
            error={errors.pillar_tolerance}
          >
            <NumberField
              id="settings-pillar-tolerance"
              min={LIMITS.tolerance.min}
              max={LIMITS.tolerance.max}
              value={values.pillar_tolerance}
              onChange={(next) => set("pillar_tolerance", next)}
              prefix="±"
              suffix="pts"
              className="w-36"
              aria-invalid={Boolean(errors.pillar_tolerance) || undefined}
            />
            <MixCheck tolerance={errors.pillar_tolerance ? null : values.pillar_tolerance} now={now} />
          </SettingRow>
        </SettingRows>
      </SectionCard>

      <SaveBar
        dirty={draft.dirty}
        valid={valid}
        onDiscard={draft.discard}
        onReset={() => draft.replace(resetValues)}
        resetDisabled={sameValues(values, resetValues)}
      />
    </form>
  )
}

/** Compares the target with what the platform strategies and the Posting Schedule plan. */
function PlanCrossCheck({ target }: { target: number | null }) {
  const db = useDb()
  const planned = useMemo(() => {
    const platforms = db.content_platforms.filter((p) => p.is_active)
    return {
      platforms: platforms.length,
      frequency: Math.round(platforms.reduce((acc, p) => acc + (p.posting_frequency || 0), 0) * 10) / 10,
      slots: db.content_calendar.filter((s) => s.is_active).length,
    }
  }, [db.content_platforms, db.content_calendar])

  if (!planned.platforms && !planned.slots) return null
  const gap = target !== null ? Math.round((planned.frequency - target) * 10) / 10 : 0
  return (
    <p className="text-xs text-pretty text-muted-foreground">
      {planned.platforms ? (
        <>
          Your {pluralize(planned.platforms, "active platform strategy", "active platform strategies")} plan{" "}
          <span className="font-medium text-foreground num">{planned.frequency}</span> posts a week
          {target !== null && gap !== 0 ? ` — ${Math.abs(gap)} ${gap > 0 ? "more" : "fewer"} than this target` : ""}.{" "}
        </>
      ) : null}
      {planned.slots ? <>The Posting Schedule has {pluralize(planned.slots, "slot")} a week. </> : null}
      <Link href="/strategy/platforms" className="font-medium text-foreground underline-offset-2 hover:underline">
        Platforms
      </Link>
      {" · "}
      <Link href="/calendar/schedule" className="font-medium text-foreground underline-offset-2 hover:underline">
        Posting Schedule
      </Link>
    </p>
  )
}

/** Owners already used on content, most frequent first. */
function OwnerSuggestions({ current, onPick }: { current: string; onPick: (owner: string) => void }) {
  const db = useDb()
  const owners = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of db.content_items) {
      const owner = item.owner.trim()
      if (owner) counts.set(owner, (counts.get(owner) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([owner]) => owner)
  }, [db.content_items])
  const options = owners.filter((o) => o !== current.trim()).slice(0, 5)
  if (!options.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Used on content:</span>
      {options.map((owner) => (
        <button key={owner} type="button" className={chipVariants({ size: "xs", selected: false })} onClick={() => onPick(owner)}>
          {owner}
        </button>
      ))}
    </div>
  )
}

/** Live check of the current pillar and funnel mix with the edited tolerance. */
function MixCheck({ tolerance, now }: { tolerance: number | null; now: Date }) {
  const db = useDb()
  const settings = useSettings()
  const result = useMemo(() => {
    if (tolerance === null) return null
    const draft = { ...settings, pillar_tolerance: tolerance }
    return { pillars: pillarMix(db, now, draft), funnel: funnelMix(db, now, draft) }
  }, [db, settings, tolerance, now])

  if (!result) return null
  const { pillars, funnel } = result
  if (!pillars.enoughData) {
    return <p className="text-xs text-muted-foreground">Not enough content in the last 30 days to check the mix yet.</p>
  }
  const flagged = pillars.warnings
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill tone={flagged.length ? "warning" : "good"}>
          {flagged.length
            ? `${pluralize(flagged.length, "pillar")} flagged right now`
            : `Pillar mix balanced within ±${tolerance} pts`}
        </StatusPill>
        {funnel.enoughData ? (
          <StatusPill tone={funnel.warnings.length ? "warning" : "good"}>
            {funnel.warnings.length ? `${pluralize(funnel.warnings.length, "funnel stage")} flagged` : "Funnel mix balanced"}
          </StatusPill>
        ) : null}
      </div>
      {flagged.length ? (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {flagged.slice(0, 3).map((w) => (
            <li key={w.key}>{w.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
