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
import { translate, UI_LANG_LABELS, UI_LANGS, useT, useUiLang, type UiLang } from "@/lib/i18n"
import { updateSettings, useDb, useSettings } from "@/lib/store"
import { formatNumber } from "@/lib/utils"
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
  const lang = useUiLang()
  const errors = validateGeneral(values, lang)
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

      <SectionCard title={g("rhythm_title")} description={g("rhythm_description")}>
        <SettingRows>
          <SettingRow
            label={g("weekly_label")}
            htmlFor="settings-weekly-target"
            description={g("weekly_description")}
            error={errors.weekly_post_target}
          >
            <NumberField
              id="settings-weekly-target"
              integer
              min={LIMITS.weeklyTarget.min}
              max={LIMITS.weeklyTarget.max}
              value={values.weekly_post_target}
              onChange={(next) => set("weekly_post_target", next)}
              suffix={g("weekly_suffix")}
              className="w-44"
              aria-invalid={Boolean(errors.weekly_post_target) || undefined}
            />
            <PlanCrossCheck target={values.weekly_post_target} />
          </SettingRow>
          <SettingRow label={g("week_start_label")} htmlFor="settings-week-start" description={g("week_start_description")}>
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

      <SectionCard title={g("workspace_title")} description={g("workspace_description")}>
        <SettingRows>
          <SettingRow
            label={g("timezone_label")}
            htmlFor="settings-timezone"
            description={g("timezone_description")}
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
                <WithStrong text={g("device_zone")} name="zone" strong={deviceZone.replace(/_/g, " ")} />{" "}
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto px-0 text-xs"
                  onClick={() => set("timezone", deviceZone)}
                >
                  {g("use_it")}
                </Button>
              </p>
            ) : null}
          </SettingRow>
          <SettingRow
            label={g("owner_label")}
            htmlFor="settings-default-owner"
            description={g("owner_description")}
            error={errors.default_owner}
          >
            <Input
              id="settings-default-owner"
              value={values.default_owner}
              maxLength={LIMITS.ownerLength + 20}
              placeholder={g("owner_placeholder")}
              className="max-w-xs"
              aria-invalid={Boolean(errors.default_owner) || undefined}
              onChange={(event) => set("default_owner", event.target.value)}
            />
            <OwnerSuggestions current={values.default_owner} onPick={(owner) => set("default_owner", owner)} />
          </SettingRow>
        </SettingRows>
      </SectionCard>

      <SectionCard title={g("mix_title")} description={g("mix_description")}>
        <SettingRows>
          <SettingRow
            label={g("tolerance_label")}
            htmlFor="settings-pillar-tolerance"
            description={g("tolerance_description")}
            error={errors.pillar_tolerance}
          >
            <NumberField
              id="settings-pillar-tolerance"
              min={LIMITS.tolerance.min}
              max={LIMITS.tolerance.max}
              value={values.pillar_tolerance}
              onChange={(next) => set("pillar_tolerance", next)}
              prefix="±"
              suffix={g("tolerance_suffix")}
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

/** Renders a translated sentence with its `{name}` placeholder emphasised (e.g. the device timezone). */
function WithStrong({ text, name, strong, numeric = false }: { text: string; name: string; strong: React.ReactNode; numeric?: boolean }) {
  const [before, ...rest] = text.split(`{${name}}`)
  if (!rest.length) return <>{text}</>
  return (
    <>
      {before}
      <span className={numeric ? "font-medium text-foreground num" : "font-medium text-foreground"}>{strong}</span>
      {rest.join(`{${name}}`)}
    </>
  )
}

/** Compares the target with what the platform strategies and the Posting Schedule plan. */
function PlanCrossCheck({ target }: { target: number | null }) {
  const g = useT(generalMessages)
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
          <WithStrong
            text={g("plan_posts", {
              platforms: g.plural("plan_platforms", planned.platforms, { count: formatNumber(planned.platforms) }),
              gap: target !== null && gap !== 0 ? g(gap > 0 ? "plan_gap_more" : "plan_gap_fewer", { count: Math.abs(gap) }) : "",
            })}
            name="frequency"
            strong={planned.frequency}
            numeric
          />{" "}
        </>
      ) : null}
      {planned.slots ? (
        <>
          {g("plan_slots", { slots: g.plural("slots", planned.slots, { count: formatNumber(planned.slots) }) })}{" "}
        </>
      ) : null}
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
  const g = useT(generalMessages)
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
      <span className="text-xs text-muted-foreground">{g("used_on_content")}</span>
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
  const g = useT(generalMessages)
  const lang = useUiLang()
  const db = useDb()
  const settings = useSettings()
  const result = useMemo(() => {
    if (tolerance === null) return null
    const draft = { ...settings, pillar_tolerance: tolerance }
    // `lang` for the warning sentences shown below.
    return { pillars: pillarMix(db, now, draft, { lang }), funnel: funnelMix(db, now, draft, { lang }) }
  }, [db, settings, tolerance, now, lang])

  if (!result) return null
  const { pillars, funnel } = result
  if (!pillars.enoughData) {
    return <p className="text-xs text-muted-foreground">{g("mix_not_enough")}</p>
  }
  const flagged = pillars.warnings
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill tone={flagged.length ? "warning" : "good"}>
          {flagged.length
            ? g.plural("pillars_flagged", flagged.length, { count: formatNumber(flagged.length) })
            : g("pillars_balanced", { tolerance: String(tolerance) })}
        </StatusPill>
        {funnel.enoughData ? (
          <StatusPill tone={funnel.warnings.length ? "warning" : "good"}>
            {funnel.warnings.length
              ? g.plural("funnel_flagged", funnel.warnings.length, { count: formatNumber(funnel.warnings.length) })
              : g("funnel_balanced")}
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
