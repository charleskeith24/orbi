"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import {
  CampaignSelect,
  DatePicker,
  FormatSelect,
  FormField,
  FormRow,
  FunnelSelect,
  GoalSelect,
  PersonaSelect,
  PillarSelect,
  PlatformToggleGroup,
  SeriesSelect,
  StageSelect,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { createContentItem, useBrand, useSettings } from "@/lib/store"
import type { FunnelStage, ID, ISODate, PipelineStage, PlatformId } from "@/lib/types"
import { CaptureBody, CaptureFooter, ShortcutHint } from "./capture-dialog"
import { captureMessages, newContentMessages } from "./capture-messages"
import { submitOnModEnter } from "./capture-utils"
import { createLabel, platformsFor, withoutId, type ContentDefaults, type OnContentCreated } from "./new-content-shared"

interface ScratchValues {
  title: string
  platforms: PlatformId[]
  pillarId: ID | null
  formatId: ID | null
  personaId: ID | null
  goalId: ID | null
  funnel: FunnelStage | null
  stage: PipelineStage
  due: ISODate | null
  owner: string
  campaignId: ID | null
  seriesId: ID | null
}

/** "From scratch": the strategic fields up front; one item per platform (createContentItem, brief included). */
export function FromScratchForm({
  defaults,
  autoFocus,
  onCancel,
  onCreated,
}: {
  defaults?: ContentDefaults
  autoFocus: boolean
  onCancel: () => void
  onCreated: OnContentCreated
}) {
  const brand = useBrand()
  const settings = useSettings()
  const formId = useId()
  const t = useT(newContentMessages)
  const f = useT(captureMessages)
  const c = useT(commonMessages)
  const field = (name: string) => `${formId}-${name}`
  const [values, setValues] = useState<ScratchValues>(() => ({
    title: defaults?.title ?? "",
    platforms: platformsFor(undefined, defaults, brand),
    pillarId: defaults?.pillar_id ?? null,
    formatId: defaults?.format_id ?? null,
    personaId: defaults?.persona_id ?? null,
    goalId: defaults?.goal_id ?? null,
    funnel: defaults?.funnel_stage ?? null,
    stage: defaults?.stage ?? "brief",
    due: defaults?.due_date ?? null,
    owner: defaults?.owner ?? settings.default_owner,
    campaignId: defaults?.campaign_id ?? null,
    seriesId: defaults?.series_id ?? null,
  }))
  const [touched, setTouched] = useState<{ title?: boolean; platforms?: boolean }>({})

  const errors = {
    title: values.title.trim() ? null : t("title_required"),
    platforms: values.platforms.length ? null : t("pick_platform"),
  }
  const firstError = errors.title ?? errors.platforms
  const valid = firstError === null

  function set<K extends keyof ScratchValues>(key: K, value: ScratchValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    if (key === "platforms") setTouched((t) => ({ ...t, platforms: true }))
  }

  function submit() {
    setTouched({ title: true, platforms: true })
    if (!valid) return
    const base = withoutId(defaults)
    const title = values.title.trim()
    try {
      const items = values.platforms.map((platform) =>
        createContentItem({
          ...base,
          title,
          platform,
          pillar_id: values.pillarId,
          format_id: values.formatId,
          persona_id: values.personaId,
          goal_id: values.goalId,
          funnel_stage: values.funnel,
          stage: values.stage,
          due_date: values.due,
          owner: values.owner.trim(),
          campaign_id: values.campaignId,
          series_id: values.seriesId,
        })
      )
      onCreated(items, title)
    } catch (error) {
      toast.error(t("create_failed"), { description: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onKeyDown={(event) => submitOnModEnter(event, submit)}
    >
      <CaptureBody className="flex flex-col gap-4">
        <FormField label={t("working_title")} htmlFor={field("title")} required error={touched.title ? (errors.title ?? undefined) : undefined}>
          <Input
            id={field("title")}
            autoFocus={autoFocus}
            value={values.title}
            maxLength={200}
            placeholder={t("title_placeholder")}
            aria-invalid={Boolean(touched.title && errors.title) || undefined}
            onChange={(event) => set("title", event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
          />
        </FormField>

        <FormField
          label={f("platforms")}
          required
          description={t("per_platform")}
          error={touched.platforms ? (errors.platforms ?? undefined) : undefined}
        >
          <PlatformToggleGroup value={values.platforms} onChange={(next) => set("platforms", next)} aria-label={f("platforms")} />
        </FormField>

        <FormRow>
          <FormField label={f("pillar")} htmlFor={field("pillar")}>
            <PillarSelect id={field("pillar")} allowNone value={values.pillarId} onChange={(next) => set("pillarId", next)} />
          </FormField>
          <FormField label={f("format")} htmlFor={field("format")}>
            <FormatSelect id={field("format")} allowNone value={values.formatId} onChange={(next) => set("formatId", next)} />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label={f("persona")} htmlFor={field("persona")}>
            <PersonaSelect id={field("persona")} allowNone value={values.personaId} onChange={(next) => set("personaId", next)} />
          </FormField>
          <FormField label={f("goal")} htmlFor={field("goal")}>
            <GoalSelect id={field("goal")} allowNone value={values.goalId} onChange={(next) => set("goalId", next)} />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label={f("funnel_stage")} htmlFor={field("funnel")}>
            <FunnelSelect id={field("funnel")} allowNone value={values.funnel} onChange={(next) => set("funnel", next)} />
          </FormField>
          <FormField label={f("stage")} htmlFor={field("stage")}>
            <StageSelect id={field("stage")} value={values.stage} onChange={(next) => next && set("stage", next)} />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label={f("due_date")} htmlFor={field("due")}>
            <DatePicker id={field("due")} value={values.due} placeholder={f("no_deadline")} onChange={(next) => set("due", next)} />
          </FormField>
          <FormField label={f("owner")} htmlFor={field("owner")}>
            <Input
              id={field("owner")}
              value={values.owner}
              maxLength={80}
              placeholder={t("owner_placeholder")}
              autoComplete="off"
              onChange={(event) => set("owner", event.target.value)}
            />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label={f("campaign")} htmlFor={field("campaign")}>
            <CampaignSelect id={field("campaign")} allowNone value={values.campaignId} onChange={(next) => set("campaignId", next)} />
          </FormField>
          <FormField label={f("series")} htmlFor={field("series")}>
            <SeriesSelect id={field("series")} allowNone value={values.seriesId} onChange={(next) => set("seriesId", next)} />
          </FormField>
        </FormRow>
      </CaptureBody>
      <CaptureFooter status={valid ? <ShortcutHint label={f("to_create")} /> : <span className="truncate max-sm:hidden">{firstError}</span>}>
        <Button type="button" variant="outline" onClick={onCancel}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {createLabel(values.platforms.length, t)}
        </Button>
      </CaptureFooter>
    </form>
  )
}
