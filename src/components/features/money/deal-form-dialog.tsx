"use client"

import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  CampaignSelect,
  DatePicker,
  FormField,
  FormRow,
  ListEditor,
  NumberField,
  OptionSelect,
  PlatformToggleGroup,
  type SelectOption,
} from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { CURRENCY_CODES, DEAL_SOURCE_IDS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { dealSourceMessages } from "@/lib/i18n/messages/money"
import { dataActions, useSettings } from "@/lib/store"
import type { BrandDeal, DealSource, DealStatus, ID, ISODate, PlatformId, UpdateRow } from "@/lib/types"
import { currencySymbol } from "@/lib/utils"
import { dealFormMessages } from "./deals-messages"
import { markDealPaid } from "./money-actions"
import { normalizeCurrency, roundMoney, statusPatch } from "./money-model"
import { useDealStatusOptions } from "./money-ui"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Values {
  brand: string
  status: DealStatus
  source: DealSource
  contactName: string
  contactEmail: string
  contactHandle: string
  fee: number | null
  currency: string
  platforms: PlatformId[]
  deliverables: string[]
  campaignId: ID | null
  start: ISODate | null
  due: ISODate | null
  usage: string
  notes: string
  mediaKit: boolean
}

type FieldKey = "brand" | "email" | "fee"

export function DealFormDialog({
  open,
  onOpenChange,
  deal,
  defaultStatus,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal?: BrandDeal | null
  defaultStatus?: DealStatus
  onSaved?: (deal: BrandDeal, created: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-2xl">
        {open ? (
          <DealForm
            key={deal?.id ?? "new"}
            deal={deal ?? null}
            defaultStatus={defaultStatus}
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

function DealForm({
  deal,
  defaultStatus,
  onCancel,
  onSaved,
}: {
  deal: BrandDeal | null
  defaultStatus?: DealStatus
  onCancel: () => void
  onSaved: (deal: BrandDeal, created: boolean) => void
}) {
  const t = useT(dealFormMessages)
  const sourceLabel = useT(dealSourceMessages)
  const settings = useSettings()
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const statusOptions = useDealStatusOptions()
  const sourceOptions = useMemo<SelectOption<DealSource>[]>(
    () => DEAL_SOURCE_IDS.map((s) => ({ value: s, label: sourceLabel(s) })),
    [sourceLabel]
  )

  const [values, setValues] = useState<Values>(() => ({
    brand: deal?.brand_name ?? "",
    status: deal?.status ?? defaultStatus ?? "lead",
    source: deal?.source ?? "inbound",
    contactName: deal?.contact_name ?? "",
    contactEmail: deal?.contact_email ?? "",
    contactHandle: deal?.contact_handle ?? "",
    fee: deal?.fee ?? null,
    currency: normalizeCurrency(deal?.currency ?? settings.currency),
    platforms: deal?.platforms ?? [],
    deliverables: deal?.deliverables ?? [],
    campaignId: deal?.campaign_id ?? null,
    start: deal?.start_date ?? null,
    due: deal?.due_date ?? null,
    usage: deal?.usage_rights ?? "",
    notes: deal?.notes ?? "",
    mediaKit: deal?.show_in_media_kit ?? false,
  }))
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const currencyOptions = useMemo<SelectOption[]>(
    () => [...new Set([...CURRENCY_CODES, values.currency])].map((code) => ({ value: code, label: `${code} · ${currencySymbol(code)}` })),
    [values.currency]
  )

  const errors: Partial<Record<FieldKey | "dates", string>> = {}
  if (!values.brand.trim()) errors.brand = t("error_brand")
  if (values.contactEmail.trim() && !EMAIL.test(values.contactEmail.trim())) errors.email = t("error_email")
  if (values.fee !== null && values.fee < 0) errors.fee = t("error_fee")
  if (values.start && values.due && values.due < values.start) errors.dates = t("error_dates")
  const valid = Object.keys(errors).length === 0
  const shown = (key: FieldKey) => (touched[key] ? errors[key] : undefined)

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ brand: true, email: true, fee: true })
    if (!valid) return
    const payload = {
      brand_name: values.brand.trim(),
      source: values.source,
      contact_name: values.contactName.trim(),
      contact_email: values.contactEmail.trim(),
      contact_handle: values.contactHandle.trim(),
      fee: values.fee === null ? null : roundMoney(values.fee),
      currency: values.currency,
      platforms: values.platforms,
      deliverables: values.deliverables,
      campaign_id: values.campaignId,
      start_date: values.start,
      due_date: values.due,
      usage_rights: values.usage.trim(),
      notes: values.notes.trim(),
      show_in_media_kit: values.mediaKit,
    } satisfies UpdateRow<"brand_deals">
    // Paid runs the "Mark paid" logic once the rest is saved, so the balance is recorded as income.
    const toPaid = values.status === "paid" && deal?.status !== "paid"
    if (deal) {
      const status = toPaid ? {} : values.status === deal.status ? {} : statusPatch(deal, values.status)
      dataActions.update("brand_deals", deal.id, { ...payload, ...status })
      if (toPaid) markDealPaid(deal.id)
      else toast.success(t("updated"), { description: payload.brand_name })
      onSaved({ ...deal, ...payload, ...status }, false)
    } else {
      const row = dataActions.insert("brand_deals", { ...payload, status: toPaid ? "delivered" : values.status })
      if (toPaid) markDealPaid(row.id)
      else toast.success(t("created"), { description: row.brand_name })
      onSaved(row, true)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{deal ? t("title_edit") : t("title_new")}</DialogTitle>
        <DialogDescription className="text-xs">{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormField label={t("brand")} htmlFor={field("brand")} required error={shown("brand")}>
            <Input
              id={field("brand")}
              value={values.brand}
              autoFocus
              maxLength={120}
              placeholder={t("brand_placeholder")}
              aria-invalid={Boolean(shown("brand")) || undefined}
              onChange={(event) => set("brand", event.target.value)}
              onBlur={() => setTouched((x) => ({ ...x, brand: true }))}
            />
          </FormField>

          <FormRow>
            <FormField label={t("status")} htmlFor={field("status")}>
              <OptionSelect id={field("status")} options={statusOptions} value={values.status} onChange={(next) => next && set("status", next)} />
            </FormField>
            <FormField label={t("source")} htmlFor={field("source")}>
              <OptionSelect id={field("source")} options={sourceOptions} value={values.source} onChange={(next) => next && set("source", next)} />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label={t("fee")} htmlFor={field("fee")} description={t("fee_help")} error={shown("fee")}>
              <NumberField
                id={field("fee")}
                min={0}
                step={0.01}
                value={values.fee}
                prefix={currencySymbol(values.currency)}
                placeholder="—"
                aria-invalid={Boolean(shown("fee")) || undefined}
                onChange={(next) => set("fee", next)}
                onBlur={() => setTouched((x) => ({ ...x, fee: true }))}
              />
            </FormField>
            <FormField label={t("currency")} htmlFor={field("currency")}>
              <OptionSelect id={field("currency")} options={currencyOptions} value={values.currency} onChange={(next) => next && set("currency", next)} />
            </FormField>
          </FormRow>

          <FormRow columns={3}>
            <FormField label={t("contact_name")} htmlFor={field("contact-name")}>
              <Input id={field("contact-name")} value={values.contactName} maxLength={120} onChange={(event) => set("contactName", event.target.value)} />
            </FormField>
            <FormField label={t("contact_email")} htmlFor={field("contact-email")} error={shown("email")}>
              <Input
                id={field("contact-email")}
                type="email"
                inputMode="email"
                value={values.contactEmail}
                maxLength={200}
                aria-invalid={Boolean(shown("email")) || undefined}
                onChange={(event) => set("contactEmail", event.target.value)}
                onBlur={() => setTouched((x) => ({ ...x, email: true }))}
              />
            </FormField>
            <FormField label={t("contact_handle")} htmlFor={field("contact-handle")}>
              <Input
                id={field("contact-handle")}
                value={values.contactHandle}
                maxLength={120}
                placeholder={t("handle_placeholder")}
                onChange={(event) => set("contactHandle", event.target.value)}
              />
            </FormField>
          </FormRow>

          <FormField label={t("platforms")}>
            <PlatformToggleGroup value={values.platforms} onChange={(next) => set("platforms", next)} aria-label={t("platforms")} />
          </FormField>

          <FormField label={t("deliverables")}>
            <ListEditor
              variant="lines"
              value={values.deliverables}
              onChange={(next) => set("deliverables", next)}
              placeholder={t("deliverables_placeholder")}
              addLabel={t("add_deliverable")}
              maxItems={20}
              aria-label={t("deliverables")}
            />
          </FormField>

          <FormRow columns={3}>
            <FormField label={t("start_date")} htmlFor={field("start")}>
              <DatePicker id={field("start")} value={values.start} onChange={(next) => set("start", next)} />
            </FormField>
            <FormField label={t("due_date")} htmlFor={field("due")} error={errors.dates}>
              <DatePicker
                id={field("due")}
                value={values.due}
                aria-invalid={Boolean(errors.dates) || undefined}
                onChange={(next) => set("due", next)}
              />
            </FormField>
            <FormField label={t("campaign")} htmlFor={field("campaign")}>
              <CampaignSelect
                id={field("campaign")}
                allowNone
                noneLabel={t("no_campaign")}
                placeholder={t("no_campaign")}
                value={values.campaignId}
                onChange={(next) => set("campaignId", next)}
              />
            </FormField>
          </FormRow>

          <FormField label={t("usage_rights")} htmlFor={field("usage")}>
            <Input id={field("usage")} value={values.usage} maxLength={300} placeholder={t("usage_placeholder")} onChange={(event) => set("usage", event.target.value)} />
          </FormField>

          <FormField label={t("notes")} htmlFor={field("notes")}>
            <Textarea
              id={field("notes")}
              rows={3}
              className="min-h-16"
              value={values.notes}
              placeholder={t("notes_placeholder")}
              onChange={(event) => set("notes", event.target.value)}
            />
          </FormField>

          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <Label htmlFor={field("media-kit")} className="text-sm">
                {t("show_in_media_kit")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("show_in_media_kit_help")}</p>
            </div>
            <Switch id={field("media-kit")} checked={values.mediaKit} onCheckedChange={(next) => set("mediaKit", next)} />
          </div>
        </div>
      </div>

      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {deal ? t("submit_edit") : t("submit_new")}
        </Button>
      </DialogFooter>
    </form>
  )
}
