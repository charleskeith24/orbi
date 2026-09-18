"use client"

import { TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { FormField, FormRow, GoalSelect, MultiSelect, NumberField, PlatformIcon, type MultiSelectOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { hasPublishedContent } from "@/components/features/dashboard/first-run"
import { useT, useUiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, useTable } from "@/lib/store"
import type { PlatformStrategy } from "@/lib/types"
import { cn, formatCompact, formatNumber, formatPercent } from "@/lib/utils"
import {
  paceVsPlan,
  platformFormValues,
  platformLabel,
  platformPatch,
  samePlatformValues,
  validatePlatform,
  type PlatformFormValues,
  type PlatformPlanRow,
} from "./platforms-model"
import { platformsMessages } from "./platforms-messages"

export interface PlatformOptions {
  formats: MultiSelectOption[]
  pillars: MultiSelectOption[]
}

function ActiveSwitch({ strategy }: { strategy: PlatformStrategy }) {
  const label = platformLabel(strategy.platform)
  const t = useT(platformsMessages)
  return (
    <Switch
      checked={strategy.is_active}
      aria-label={t("active_label", { platform: label })}
      onCheckedChange={(checked) => {
        dataActions.update("content_platforms", strategy.id, { is_active: checked })
        toast.success(checked ? t("now_active", { platform: label }) : t("now_paused", { platform: label }), {
          description: checked ? t("now_active_description") : t("now_paused_description"),
        })
      }}
    />
  )
}

function CardHeader({ strategy, className }: { strategy: PlatformStrategy; className?: string }) {
  const t = useT(platformsMessages)
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card dark:bg-input/30">
          <PlatformIcon platform={strategy.platform} colored={strategy.is_active} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm leading-5 font-medium">{platformLabel(strategy.platform)}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {strategy.handle ? `@${strategy.handle}` : t("no_handle")}
            {strategy.current_followers !== null ? t("followers_suffix", { count: formatCompact(strategy.current_followers) }) : ""}
          </p>
        </div>
      </div>
      <ActiveSwitch strategy={strategy} />
    </div>
  )
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold num">{value}</dd>
      {warn ? (
        <p className="flex items-center gap-1 text-xs text-warning-fg">
          <TriangleAlert className="size-3 shrink-0" aria-hidden />
          {warn}
        </p>
      ) : sub ? (
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  )
}

/** Paused platform: header, the note on why, and its switch. */
export function PausedPlatformCard({ row }: { row: PlatformPlanRow & { strategy: PlatformStrategy } }) {
  const t = useT(platformsMessages)
  return (
    <div id={`platform-${row.platform}`} className="flex min-w-0 scroll-mt-20 flex-col gap-2 rounded-lg border bg-card p-4">
      <CardHeader strategy={row.strategy} />
      <p className="line-clamp-2 text-xs text-pretty text-muted-foreground">
        {row.strategy.notes || t("paused_note")}
      </p>
      {row.perf ? (
        <p className="text-xs text-muted-foreground">
          {t("still_published_before")}
          <span className="font-medium text-foreground num">{row.perf.posts}</span>
          {t("still_published_after")}
        </p>
      ) : null}
    </div>
  )
}

/** Active platform: the editable strategy (saved per card) plus its last 30 days. */
export function PlatformCard({
  row,
  options,
  highlighted = false,
}: {
  row: PlatformPlanRow & { strategy: PlatformStrategy }
  options: PlatformOptions
  highlighted?: boolean
}) {
  const { strategy, perf } = row
  const label = platformLabel(strategy.platform)
  const saved = useMemo(() => platformFormValues(strategy), [strategy])
  const [edits, setEdits] = useState<Partial<PlatformFormValues>>({})
  const values = useMemo(() => ({ ...saved, ...edits }), [saved, edits])
  const dirty = !samePlatformValues(values, saved)
  const lang = useUiLang()
  const t = useT(platformsMessages)
  const c = useT(commonMessages)
  const errors = validatePlatform(values, lang)
  const invalid = Object.keys(errors).length > 0
  const id = (field: string) => `platform-${strategy.platform}-${field}`
  const items = useTable("content_items")
  // Nothing published anywhere yet: every platform is at zero by definition, not behind.
  const started = useMemo(() => hasPublishedContent(items), [items])
  const behind = started && paceVsPlan(row) === "behind"

  function set<K extends keyof PlatformFormValues>(key: K, value: PlatformFormValues[K]) {
    setEdits((current) => ({ ...current, [key]: value }))
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty || invalid) return
    dataActions.update("content_platforms", strategy.id, platformPatch(values))
    setEdits({})
    toast.success(t("saved", { platform: label }))
  }

  return (
    <form
      id={`platform-${strategy.platform}`}
      onSubmit={save}
      noValidate
      aria-label={t("form_label", { platform: label })}
      className={cn(
        "flex min-w-0 scroll-mt-20 flex-col overflow-hidden rounded-lg border bg-card transition-shadow",
        highlighted && "ring-3 ring-brand/40",
        dirty && "border-brand/40"
      )}
    >
      <CardHeader strategy={strategy} className="px-4 pt-4" />

      <div className="flex flex-col gap-4 p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4 dark:bg-input/10">
          <Stat
            label={t("stat_posts")}
            value={formatNumber(perf?.posts ?? 0)}
            sub={row.planned30 ? t("stat_plan", { count: Math.round(row.planned30) }) : t("stat_no_plan")}
            warn={behind ? t("stat_behind", { count: Math.round(row.planned30) }) : undefined}
          />
          <Stat
            label={t("stat_views")}
            value={formatCompact(perf?.views ?? 0)}
            sub={perf?.avgViews ? t("stat_avg", { count: formatCompact(perf.avgViews) }) : t("stat_no_analytics")}
          />
          <Stat
            label={t("stat_engagement")}
            value={formatPercent(perf?.engagementRate)}
            sub={perf ? t("stat_leads", { count: formatNumber(perf.leads) }) : undefined}
          />
          <Stat label={t("stat_followers")} value={perf ? `+${formatNumber(perf.followersGained)}` : "—"} sub={t("stat_gained")} />
        </dl>

        <FormRow>
          <FormField label={t("handle")} htmlFor={id("handle")}>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>@</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id={id("handle")}
                value={values.handle}
                placeholder={t("handle_placeholder")}
                autoComplete="off"
                onChange={(event) => set("handle", event.target.value)}
              />
            </InputGroup>
          </FormField>
          <FormField label={t("current_followers")} htmlFor={id("followers")} error={errors.current_followers}>
            <NumberField
              id={id("followers")}
              integer
              min={0}
              value={values.current_followers}
              placeholder={t("followers_placeholder")}
              suffix={t("followers_unit")}
              aria-invalid={Boolean(errors.current_followers) || undefined}
              onChange={(next) => set("current_followers", next)}
            />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label={t("frequency")} htmlFor={id("frequency")} error={errors.posting_frequency}>
            <NumberField
              id={id("frequency")}
              min={0}
              max={50}
              value={values.posting_frequency}
              suffix={t("per_week")}
              aria-invalid={Boolean(errors.posting_frequency) || undefined}
              onChange={(next) => set("posting_frequency", next)}
            />
          </FormField>
          <FormField label={t("primary_goal")} htmlFor={id("goal")}>
            <GoalSelect id={id("goal")} allowNone value={values.primary_goal_id} onChange={(next) => set("primary_goal_id", next)} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label={t("formats")} htmlFor={id("formats")}>
            <MultiSelect
              id={id("formats")}
              options={options.formats}
              value={values.preferred_format_ids}
              placeholder={t("formats_placeholder")}
              maxChips={2}
              aria-label={t("formats_label", { platform: label })}
              onChange={(next) => set("preferred_format_ids", next)}
            />
          </FormField>
          <FormField label={t("pillars")} htmlFor={id("pillars")}>
            <MultiSelect
              id={id("pillars")}
              options={options.pillars}
              value={values.preferred_pillar_ids}
              placeholder={t("pillars_placeholder")}
              maxChips={2}
              aria-label={t("pillars_label", { platform: label })}
              onChange={(next) => set("preferred_pillar_ids", next)}
            />
          </FormField>
        </FormRow>
        <FormField label={t("audience")} htmlFor={id("audience")} description={t("audience_description")}>
          <Textarea
            id={id("audience")}
            rows={2}
            className="min-h-14 leading-relaxed"
            value={values.audience}
            placeholder={t("audience_placeholder")}
            onChange={(event) => set("audience", event.target.value)}
          />
        </FormField>
        <FormField label={t("cta")} htmlFor={id("cta")}>
          <Textarea
            id={id("cta")}
            rows={2}
            className="min-h-14 leading-relaxed"
            value={values.cta_style}
            placeholder={t("cta_placeholder")}
            onChange={(event) => set("cta_style", event.target.value)}
          />
        </FormField>
        <FormField label={t("notes")} htmlFor={id("notes")}>
          <Textarea
            id={id("notes")}
            rows={2}
            className="min-h-14 leading-relaxed"
            value={values.notes}
            placeholder={t("notes_placeholder")}
            onChange={(event) => set("notes", event.target.value)}
          />
        </FormField>
      </div>

      <div className="mt-auto flex min-h-11 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {t("manual_analytics")}
          <Link href="/settings?tab=integrations" className="font-medium text-foreground underline-offset-2 hover:underline">
            Settings → Integrations
          </Link>
        </p>
        {dirty ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEdits({})}>
              {c("discard")}
            </Button>
            <Button type="submit" size="sm" disabled={invalid}>
              {t("save_platform", { platform: label })}
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  )
}
