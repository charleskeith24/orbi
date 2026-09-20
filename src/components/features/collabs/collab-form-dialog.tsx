"use client"

import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  CampaignSelect,
  DatePicker,
  FormField,
  FormRow,
  GoalSelect,
  InfoHint,
  NumberField,
  OptionSelect,
  PillarSelect,
  PlatformSelect,
  type SelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { dataActions, useTable } from "@/lib/store"
import type { Collab, CollabStatus, CollabType, ID, InsertRow, ISODate, PlatformId, UpdateRow } from "@/lib/types"
import { isValidLink, statusPatch } from "./collab-model"
import { useCollabStatusOptions, useCollabTypeOptions } from "./collab-ui"
import { collabFormMessages } from "./messages"

interface Values {
  title: string
  type: CollabType
  status: CollabStatus
  partnerName: string
  partnerHandle: string
  partnerPlatform: PlatformId | null
  partnerLink: string
  partnerNiche: string
  partnerFollowers: number | null
  date: ISODate | null
  followUp: ISODate | null
  pillarId: ID | null
  goalId: ID | null
  campaignId: ID | null
  dealId: ID | null
  notes: string
}

type FieldKey = "title" | "link" | "followers"

export function CollabFormDialog({
  open,
  onOpenChange,
  collab,
  defaults,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collab?: Collab | null
  /** Prefill for a new collab (e.g. from a campaign or a brand deal). */
  defaults?: InsertRow<"collabs">
  onSaved?: (collab: Collab, created: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-2xl">
        {open ? (
          <CollabForm
            key={collab?.id ?? "new"}
            collab={collab ?? null}
            defaults={defaults}
            onCancel={() => onOpenChange(false)}
            onSaved={(row, created) => {
              onOpenChange(false)
              onSaved?.(row, created)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CollabForm({
  collab,
  defaults,
  onCancel,
  onSaved,
}: {
  collab: Collab | null
  defaults?: InsertRow<"collabs">
  onCancel: () => void
  onSaved: (collab: Collab, created: boolean) => void
}) {
  const t = useT(collabFormMessages)
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const statusOptions = useCollabStatusOptions()
  const typeOptions = useCollabTypeOptions()
  const deals = useTable("brand_deals")
  const dealOptions = useMemo<SelectOption[]>(
    () =>
      [...deals]
        .filter((d) => d.status !== "lost" || d.id === (collab?.brand_deal_id ?? defaults?.brand_deal_id))
        .sort((a, b) => a.brand_name.localeCompare(b.brand_name))
        .map((d) => ({ value: d.id, label: d.brand_name || t("untitled_deal") })),
    [deals, collab, defaults, t]
  )

  const source = { ...defaults, ...collab }
  const [values, setValues] = useState<Values>(() => ({
    title: source.title ?? "",
    type: source.type ?? "joint_live",
    status: source.status ?? "idea",
    partnerName: source.partner_name ?? "",
    partnerHandle: source.partner_handle ?? "",
    partnerPlatform: source.partner_platform ?? null,
    partnerLink: source.partner_link ?? "",
    partnerNiche: source.partner_niche ?? "",
    partnerFollowers: source.partner_followers ?? null,
    date: source.collab_date ?? null,
    followUp: source.follow_up_on ?? null,
    pillarId: source.pillar_id ?? null,
    goalId: source.goal_id ?? null,
    campaignId: source.campaign_id ?? null,
    dealId: source.brand_deal_id ?? null,
    notes: source.notes ?? "",
  }))
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})

  const errors: Partial<Record<FieldKey, string>> = {}
  if (!values.title.trim() && !values.partnerName.trim() && !values.partnerHandle.trim() && !values.partnerNiche.trim()) errors.title = t("error_title")
  if (!isValidLink(values.partnerLink)) errors.link = t("error_link")
  if (values.partnerFollowers !== null && (values.partnerFollowers < 0 || !Number.isInteger(values.partnerFollowers))) errors.followers = t("error_followers")
  const valid = Object.keys(errors).length === 0
  const shown = (key: FieldKey) => (touched[key] ? errors[key] : undefined)

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ title: true, link: true, followers: true })
    if (!valid) return
    const payload = {
      title: values.title.trim(),
      type: values.type,
      partner_name: values.partnerName.trim(),
      partner_handle: values.partnerHandle.trim(),
      partner_platform: values.partnerPlatform,
      partner_link: values.partnerLink.trim(),
      partner_niche: values.partnerNiche.trim(),
      partner_followers: values.partnerFollowers,
      collab_date: values.date,
      follow_up_on: values.followUp,
      pillar_id: values.pillarId,
      goal_id: values.goalId,
      campaign_id: values.campaignId,
      brand_deal_id: values.dealId,
      notes: values.notes.trim(),
    } satisfies UpdateRow<"collabs">
    const now = new Date()
    if (collab) {
      const status = values.status === collab.status ? {} : statusPatch({ ...collab, follow_up_on: values.followUp }, values.status, now)
      dataActions.update("collabs", collab.id, { ...payload, ...status })
      toast.success(t("updated"), { description: payload.title || payload.partner_handle || payload.partner_name })
      onSaved({ ...collab, ...payload, ...status }, false)
    } else {
      const status = statusPatch({ status: "idea", follow_up_on: values.followUp }, values.status, now)
      const row = dataActions.insert("collabs", { ...payload, ...status })
      toast.success(t("created"), { description: row.title || row.partner_handle || row.partner_name })
      onSaved(row, true)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{collab ? t("title_edit") : t("title_new")}</DialogTitle>
        <DialogDescription className="text-xs">{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label={t("collab_title")} htmlFor={field("title")} error={shown("title")}>
            <Input
              id={field("title")}
              value={values.title}
              autoFocus
              maxLength={200}
              placeholder={t("title_placeholder")}
              aria-invalid={Boolean(shown("title")) || undefined}
              onChange={(event) => set("title", event.target.value)}
              onBlur={() => setTouched((x) => ({ ...x, title: true }))}
            />
          </FormField>

          <FormRow>
            <FormField label={t("type")} htmlFor={field("type")}>
              <OptionSelect id={field("type")} options={typeOptions} value={values.type} onChange={(next) => next && set("type", next)} />
            </FormField>
            <FormField label={t("status")} htmlFor={field("status")}>
              <OptionSelect id={field("status")} options={statusOptions} value={values.status} onChange={(next) => next && set("status", next)} />
            </FormField>
          </FormRow>

          <fieldset className="flex min-w-0 flex-col gap-4 rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">{t("partner")}</legend>
            <FormRow>
              <FormField label={t("partner_name")} htmlFor={field("partner-name")}>
                <Input id={field("partner-name")} value={values.partnerName} maxLength={120} onChange={(event) => set("partnerName", event.target.value)} />
              </FormField>
              <FormField label={t("partner_handle")} htmlFor={field("partner-handle")}>
                <Input
                  id={field("partner-handle")}
                  value={values.partnerHandle}
                  maxLength={120}
                  placeholder={t("handle_placeholder")}
                  onChange={(event) => set("partnerHandle", event.target.value)}
                />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label={t("partner_platform")} htmlFor={field("partner-platform")}>
                <PlatformSelect
                  id={field("partner-platform")}
                  value={values.partnerPlatform}
                  allowNone
                  noneLabel={t("no_platform")}
                  placeholder={t("no_platform")}
                  onChange={(next) => set("partnerPlatform", next)}
                />
              </FormField>
              <FormField label={t("partner_followers")} htmlFor={field("followers")} error={shown("followers")}>
                <NumberField
                  id={field("followers")}
                  min={0}
                  step={1}
                  value={values.partnerFollowers}
                  placeholder="—"
                  aria-invalid={Boolean(shown("followers")) || undefined}
                  onChange={(next) => set("partnerFollowers", next)}
                  onBlur={() => setTouched((x) => ({ ...x, followers: true }))}
                />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label={t("partner_niche")} htmlFor={field("niche")}>
                <Input id={field("niche")} value={values.partnerNiche} maxLength={160} placeholder={t("niche_placeholder")} onChange={(event) => set("partnerNiche", event.target.value)} />
              </FormField>
              <FormField label={t("partner_link")} htmlFor={field("link")} error={shown("link")}>
                <Input
                  id={field("link")}
                  type="url"
                  inputMode="url"
                  value={values.partnerLink}
                  maxLength={300}
                  placeholder={t("link_placeholder")}
                  aria-invalid={Boolean(shown("link")) || undefined}
                  onChange={(event) => set("partnerLink", event.target.value)}
                  onBlur={() => setTouched((x) => ({ ...x, link: true }))}
                />
              </FormField>
            </FormRow>
          </fieldset>

          <FormRow>
            <FormField label={t("collab_date")} htmlFor={field("date")}>
              <DatePicker id={field("date")} value={values.date} onChange={(next) => set("date", next)} />
            </FormField>
            <FormField label={t("follow_up_on")} htmlFor={field("follow-up")} labelAction={<InfoHint title={t("follow_up_on")}>{t("follow_up_help")}</InfoHint>}>
              <DatePicker id={field("follow-up")} value={values.followUp} onChange={(next) => set("followUp", next)} />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label={t("pillar")} htmlFor={field("pillar")}>
              <PillarSelect id={field("pillar")} allowNone noneLabel={t("none")} placeholder={t("none")} value={values.pillarId} onChange={(next) => set("pillarId", next)} />
            </FormField>
            <FormField label={t("goal")} htmlFor={field("goal")}>
              <GoalSelect id={field("goal")} allowNone noneLabel={t("none")} placeholder={t("none")} value={values.goalId} onChange={(next) => set("goalId", next)} />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label={t("campaign")} htmlFor={field("campaign")}>
              <CampaignSelect id={field("campaign")} allowNone noneLabel={t("none")} placeholder={t("none")} value={values.campaignId} onChange={(next) => set("campaignId", next)} />
            </FormField>
            <FormField label={t("brand_deal")} htmlFor={field("deal")}>
              <OptionSelect
                id={field("deal")}
                options={dealOptions}
                allowNone
                noneLabel={t("none")}
                placeholder={t("none")}
                emptyText={t("no_deals")}
                value={values.dealId}
                onChange={(next) => set("dealId", next)}
              />
            </FormField>
          </FormRow>

          <FormField label={t("notes")} htmlFor={field("notes")}>
            <Textarea id={field("notes")} rows={3} className="min-h-16" value={values.notes} placeholder={t("notes_placeholder")} onChange={(event) => set("notes", event.target.value)} />
          </FormField>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {collab ? t("submit_edit") : t("submit_new")}
        </Button>
      </DialogFooter>
    </form>
  )
}
