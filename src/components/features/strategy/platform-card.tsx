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
import { dataActions } from "@/lib/store"
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

export interface PlatformOptions {
  formats: MultiSelectOption[]
  pillars: MultiSelectOption[]
}

function ActiveSwitch({ strategy }: { strategy: PlatformStrategy }) {
  const label = platformLabel(strategy.platform)
  return (
    <Switch
      checked={strategy.is_active}
      aria-label={`${label} active`}
      onCheckedChange={(checked) => {
        dataActions.update("content_platforms", strategy.id, { is_active: checked })
        toast.success(checked ? `${label} is active` : `${label} paused`, {
          description: checked ? "It now counts toward your weekly plan." : "It no longer counts toward your weekly plan.",
        })
      }}
    />
  )
}

function CardHeader({ strategy, className }: { strategy: PlatformStrategy; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card dark:bg-input/30">
          <PlatformIcon platform={strategy.platform} colored={strategy.is_active} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm leading-5 font-medium">{platformLabel(strategy.platform)}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {strategy.handle ? `@${strategy.handle}` : "No handle yet"}
            {strategy.current_followers !== null ? ` · ${formatCompact(strategy.current_followers)} followers` : ""}
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
  return (
    <div id={`platform-${row.platform}`} className="flex min-w-0 scroll-mt-20 flex-col gap-2 rounded-lg border bg-card p-4">
      <CardHeader strategy={row.strategy} />
      <p className="line-clamp-2 text-xs text-pretty text-muted-foreground">
        {row.strategy.notes || "Paused — not part of your weekly plan. Switch it on to plan posts for it."}
      </p>
      {row.perf ? (
        <p className="text-xs text-muted-foreground">
          Still published <span className="font-medium text-foreground num">{row.perf.posts}</span> in the last 30 days.
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
  const errors = validatePlatform(values)
  const invalid = Object.keys(errors).length > 0
  const id = (field: string) => `platform-${strategy.platform}-${field}`
  const behind = paceVsPlan(row) === "behind"

  function set<K extends keyof PlatformFormValues>(key: K, value: PlatformFormValues[K]) {
    setEdits((current) => ({ ...current, [key]: value }))
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty || invalid) return
    dataActions.update("content_platforms", strategy.id, platformPatch(values))
    setEdits({})
    toast.success(`${label} strategy saved`)
  }

  return (
    <form
      id={`platform-${strategy.platform}`}
      onSubmit={save}
      noValidate
      aria-label={`${label} strategy`}
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
            label="Posts · 30 days"
            value={formatNumber(perf?.posts ?? 0)}
            sub={row.planned30 ? `plan ≈ ${Math.round(row.planned30)}` : "no plan"}
            warn={behind ? `behind plan ≈ ${Math.round(row.planned30)}` : undefined}
          />
          <Stat label="Views" value={formatCompact(perf?.views ?? 0)} sub={perf?.avgViews ? `${formatCompact(perf.avgViews)} avg / post` : "no analytics"} />
          <Stat label="Engagement" value={formatPercent(perf?.engagementRate)} sub={perf ? `${formatNumber(perf.leads)} leads` : undefined} />
          <Stat label="Followers" value={perf ? `+${formatNumber(perf.followersGained)}` : "—"} sub="gained" />
        </dl>

        <FormRow>
          <FormField label="Handle" htmlFor={id("handle")}>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>@</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id={id("handle")}
                value={values.handle}
                placeholder="yourhandle"
                autoComplete="off"
                onChange={(event) => set("handle", event.target.value)}
              />
            </InputGroup>
          </FormField>
          <FormField label="Current followers" htmlFor={id("followers")} error={errors.current_followers}>
            <NumberField
              id={id("followers")}
              integer
              min={0}
              value={values.current_followers}
              placeholder="e.g. 48,200"
              suffix="followers"
              aria-invalid={Boolean(errors.current_followers) || undefined}
              onChange={(next) => set("current_followers", next)}
            />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Posting frequency" htmlFor={id("frequency")} error={errors.posting_frequency}>
            <NumberField
              id={id("frequency")}
              min={0}
              max={50}
              value={values.posting_frequency}
              suffix="/ week"
              aria-invalid={Boolean(errors.posting_frequency) || undefined}
              onChange={(next) => set("posting_frequency", next)}
            />
          </FormField>
          <FormField label="Primary goal" htmlFor={id("goal")}>
            <GoalSelect id={id("goal")} allowNone value={values.primary_goal_id} onChange={(next) => set("primary_goal_id", next)} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Preferred formats" htmlFor={id("formats")}>
            <MultiSelect
              id={id("formats")}
              options={options.formats}
              value={values.preferred_format_ids}
              placeholder="Choose formats"
              maxChips={2}
              aria-label={`${label} preferred formats`}
              onChange={(next) => set("preferred_format_ids", next)}
            />
          </FormField>
          <FormField label="Preferred pillars" htmlFor={id("pillars")}>
            <MultiSelect
              id={id("pillars")}
              options={options.pillars}
              value={values.preferred_pillar_ids}
              placeholder="Choose pillars"
              maxChips={2}
              aria-label={`${label} preferred pillars`}
              onChange={(next) => set("preferred_pillar_ids", next)}
            />
          </FormField>
        </FormRow>
        <FormField label="Audience" htmlFor={id("audience")} description="Who you reach here and what they expect.">
          <Textarea
            id={id("audience")}
            rows={2}
            className="min-h-14 leading-relaxed"
            value={values.audience}
            placeholder="e.g. Cold audience discovering you for the first time."
            onChange={(event) => set("audience", event.target.value)}
          />
        </FormField>
        <FormField label="CTA style" htmlFor={id("cta")}>
          <Textarea
            id={id("cta")}
            rows={2}
            className="min-h-14 leading-relaxed"
            value={values.cta_style}
            placeholder="e.g. Follow for part 2, or comment a keyword to get the resource."
            onChange={(event) => set("cta_style", event.target.value)}
          />
        </FormField>
        <FormField label="Notes" htmlFor={id("notes")}>
          <Textarea
            id={id("notes")}
            rows={2}
            className="min-h-14 leading-relaxed"
            value={values.notes}
            placeholder="What works here, timing, formatting rules…"
            onChange={(event) => set("notes", event.target.value)}
          />
        </FormField>
      </div>

      <div className="mt-auto flex min-h-11 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          Manual analytics · API connection in{" "}
          <Link href="/settings?tab=integrations" className="font-medium text-foreground underline-offset-2 hover:underline">
            Settings → Integrations
          </Link>
        </p>
        {dirty ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEdits({})}>
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={invalid}>
              Save {label}
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  )
}
