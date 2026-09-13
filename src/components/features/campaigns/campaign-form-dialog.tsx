"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  ColorSwatchPicker,
  DatePicker,
  FormField,
  FormRow,
  GoalSelect,
  NumberField,
  PersonaSelect,
  PillarSelect,
  PlatformToggleGroup,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { dataActions, useBrand, useTable } from "@/lib/store"
import type { CampaignStatus, CategoricalColor, ContentCampaign, ID, ISODate, PlatformId, UpdateRow } from "@/lib/types"
import { CampaignStatusSelect } from "./campaign-status"
import { defaultCampaignDates, nextCampaignColor } from "./campaign-utils"

interface FormValues {
  name: string
  objective: string
  description: string
  message: string
  start: ISODate | null
  end: ISODate | null
  personaId: ID | null
  pillarId: ID | null
  goalId: ID | null
  platforms: PlatformId[]
  status: CampaignStatus
  target: number | null
  color: CategoricalColor
}

type FieldKey = "name" | "start" | "end" | "target"

function validate(values: FormValues): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {}
  if (!values.name.trim()) errors.name = "Give the campaign a name."
  if (!values.start) errors.start = "Pick a start date."
  if (!values.end) errors.end = "Pick an end date."
  else if (values.start && values.end < values.start) errors.end = "End date must be on or after the start date."
  if (values.target !== null && values.target < 1) errors.target = "Target must be at least 1 post."
  return errors
}

/** Create / edit a campaign. The form remounts per campaign so it always starts from saved values. */
export function CampaignFormDialog({
  open,
  onOpenChange,
  campaign,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign?: ContentCampaign | null
  onSaved?: (campaign: ContentCampaign, created: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-2xl">
        <CampaignForm
          key={campaign?.id ?? "new"}
          campaign={campaign ?? null}
          onCancel={() => onOpenChange(false)}
          onSaved={(row, created) => {
            onOpenChange(false)
            onSaved?.(row, created)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function CampaignForm({
  campaign,
  onCancel,
  onSaved,
}: {
  campaign: ContentCampaign | null
  onCancel: () => void
  onSaved: (campaign: ContentCampaign, created: boolean) => void
}) {
  const campaigns = useTable("content_campaigns")
  const brand = useBrand()
  const [values, setValues] = useState<FormValues>(() => {
    if (campaign) {
      return {
        name: campaign.name,
        objective: campaign.objective,
        description: campaign.description,
        message: campaign.message,
        start: campaign.start_date || null,
        end: campaign.end_date || null,
        personaId: campaign.persona_id,
        pillarId: campaign.pillar_id,
        goalId: campaign.goal_id,
        platforms: campaign.platforms,
        status: campaign.status,
        target: campaign.target_posts,
        color: campaign.color,
      }
    }
    const dates = defaultCampaignDates(new Date())
    return {
      name: "",
      objective: "",
      description: "",
      message: "",
      start: dates.start,
      end: dates.end,
      personaId: null,
      pillarId: null,
      goalId: null,
      platforms: brand.main_platforms,
      status: "planning",
      target: null,
      color: nextCampaignColor(campaigns),
    }
  })
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const errors = validate(values)
  const valid = Object.keys(errors).length === 0
  const shown = (key: FieldKey) => (touched[key] ? errors[key] : undefined)

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    if (key === "start" || key === "end" || key === "target") setTouched((t) => ({ ...t, [key]: true }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ name: true, start: true, end: true, target: true })
    if (!valid || !values.start || !values.end) return
    const payload = {
      name: values.name.trim(),
      objective: values.objective.trim(),
      description: values.description.trim(),
      message: values.message.trim(),
      start_date: values.start,
      end_date: values.end,
      persona_id: values.personaId,
      pillar_id: values.pillarId,
      goal_id: values.goalId,
      platforms: values.platforms,
      status: values.status,
      target_posts: values.target === null ? null : Math.round(values.target),
      color: values.color,
    } satisfies UpdateRow<"content_campaigns">
    if (campaign) {
      dataActions.update("content_campaigns", campaign.id, payload)
      toast.success("Campaign updated", { description: payload.name })
      onSaved({ ...campaign, ...payload }, false)
    } else {
      const row = dataActions.insert("content_campaigns", payload)
      toast.success("Campaign created", { description: row.name })
      onSaved(row, true)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
        <DialogDescription className="text-xs">
          A focused push with one message, a date window and a target number of posts.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label="Name" htmlFor="campaign-name" required error={shown("name")}>
            <Input
              id="campaign-name"
              value={values.name}
              autoFocus
              maxLength={120}
              placeholder="e.g. Q4 Holiday Scale Sprint"
              aria-invalid={Boolean(shown("name")) || undefined}
              onChange={(event) => set("name", event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
          </FormField>

          <FormField
            label="Objective"
            htmlFor="campaign-objective"
            description="What should this campaign achieve, and how will you know it worked?"
          >
            <Textarea
              id="campaign-objective"
              rows={2}
              className="min-h-14"
              value={values.objective}
              placeholder="e.g. Book 20 discovery calls from founders running their own ads."
              onChange={(event) => set("objective", event.target.value)}
            />
          </FormField>

          <FormField label="Campaign message" htmlFor="campaign-message" description="The one idea every piece reinforces.">
            <Textarea
              id="campaign-message"
              rows={2}
              className="min-h-14"
              value={values.message}
              placeholder="e.g. Scaling isn’t raising budgets. It’s removing bottlenecks."
              onChange={(event) => set("message", event.target.value)}
            />
          </FormField>

          <FormField label="Description" htmlFor="campaign-description">
            <Textarea
              id="campaign-description"
              rows={3}
              value={values.description}
              placeholder="How the campaign unfolds — themes, beats, the offer at the end."
              onChange={(event) => set("description", event.target.value)}
            />
          </FormField>

          <FormRow>
            <FormField label="Start date" htmlFor="campaign-start" required error={shown("start")}>
              <DatePicker
                id="campaign-start"
                value={values.start}
                clearable={false}
                aria-invalid={Boolean(shown("start")) || undefined}
                onChange={(next) => set("start", next)}
              />
            </FormField>
            <FormField label="End date" htmlFor="campaign-end" required error={shown("end")}>
              <DatePicker
                id="campaign-end"
                value={values.end}
                clearable={false}
                minDate={values.start ?? undefined}
                aria-invalid={Boolean(shown("end")) || undefined}
                onChange={(next) => set("end", next)}
              />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Status" htmlFor="campaign-status">
              <CampaignStatusSelect
                id="campaign-status"
                size="default"
                value={values.status}
                onChange={(next) => set("status", next)}
              />
            </FormField>
            <FormField
              label="Target posts"
              htmlFor="campaign-target"
              description="Pieces you plan to publish in the window."
              error={shown("target")}
            >
              <NumberField
                id="campaign-target"
                integer
                min={1}
                max={999}
                value={values.target}
                placeholder="e.g. 12"
                suffix="posts"
                aria-invalid={Boolean(shown("target")) || undefined}
                onChange={(next) => set("target", next)}
              />
            </FormField>
          </FormRow>

          <FormRow columns={3}>
            <FormField label="Audience" htmlFor="campaign-persona">
              <PersonaSelect
                id="campaign-persona"
                allowNone
                noneLabel="No persona"
                placeholder="Choose a persona"
                value={values.personaId}
                onChange={(next) => set("personaId", next)}
              />
            </FormField>
            <FormField label="Primary pillar" htmlFor="campaign-pillar">
              <PillarSelect
                id="campaign-pillar"
                allowNone
                noneLabel="No pillar"
                placeholder="Choose a pillar"
                value={values.pillarId}
                onChange={(next) => set("pillarId", next)}
              />
            </FormField>
            <FormField label="Goal" htmlFor="campaign-goal">
              <GoalSelect
                id="campaign-goal"
                allowNone
                noneLabel="No goal"
                placeholder="Choose a goal"
                value={values.goalId}
                onChange={(next) => set("goalId", next)}
              />
            </FormField>
          </FormRow>

          <FormField label="Platforms">
            <PlatformToggleGroup value={values.platforms} onChange={(next) => set("platforms", next)} aria-label="Campaign platforms" />
          </FormField>

          <FormField label="Colour" description="Identifies the campaign on calendars, timelines and charts.">
            <ColorSwatchPicker value={values.color} onChange={(next) => set("color", next)} aria-label="Campaign colour" />
          </FormField>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          {campaign ? "Save changes" : "Create campaign"}
        </Button>
      </DialogFooter>
    </form>
  )
}
