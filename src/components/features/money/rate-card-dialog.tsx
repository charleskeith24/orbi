"use client"

import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import { FormField, FormRow, InfoHint, ListEditor, NumberField, OptionSelect, PlatformIcon, type SelectOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { CURRENCY_CODES, PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { dataActions, useSettings, useTable } from "@/lib/store"
import type { PlatformId, RateCard } from "@/lib/types"
import { currencySymbol } from "@/lib/utils"
import { rateCardMessages } from "./media-kit-messages"
import { normalizeCurrency, roundMoney } from "./money-model"

export function RateCardDialog({ open, onOpenChange, card }: { open: boolean; onOpenChange: (open: boolean) => void; card: RateCard | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        {open ? <RateCardForm key={card?.id ?? "new"} card={card} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function RateCardForm({ card, onDone }: { card: RateCard | null; onDone: () => void }) {
  const t = useT(rateCardMessages)
  const settings = useSettings()
  const cards = useTable("rate_cards")
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const [name, setName] = useState(card?.name ?? "")
  const [platform, setPlatform] = useState<PlatformId | null>(card?.platform ?? null)
  const [description, setDescription] = useState(card?.description ?? "")
  const [deliverables, setDeliverables] = useState<string[]>(card?.deliverables ?? [])
  const [price, setPrice] = useState<number | null>(card?.price ?? null)
  const [currency, setCurrency] = useState(normalizeCurrency(card?.currency ?? settings.currency))
  const [active, setActive] = useState(card?.is_active ?? true)
  const [touched, setTouched] = useState(false)

  const platformOptions = useMemo<SelectOption<PlatformId>[]>(
    () =>
      PLATFORM_IDS.map((p) => ({
        value: p,
        label: PLATFORMS[p].label,
        icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
      })),
    []
  )
  const currencyOptions = useMemo<SelectOption[]>(
    () => [...new Set([...CURRENCY_CODES, currency])].map((code) => ({ value: code, label: `${code} · ${currencySymbol(code)}` })),
    [currency]
  )
  const errors = {
    name: name.trim() ? undefined : t("error_name"),
    price: price !== null && price < 0 ? t("error_price") : undefined,
  }
  const valid = !errors.name && !errors.price

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!valid) return
    const values = {
      name: name.trim(),
      platform,
      description: description.trim(),
      deliverables,
      price: price === null ? null : roundMoney(price),
      currency,
      is_active: active,
    }
    if (card) {
      dataActions.update("rate_cards", card.id, values)
      toast.success(t("updated"), { description: values.name })
    } else {
      const sortOrder = cards.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1
      dataActions.insert("rate_cards", { ...values, sort_order: sortOrder })
      toast.success(t("created"), { description: values.name })
    }
    onDone()
  }

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>{card ? t("title_edit") : t("title_new")}</DialogTitle>
        <DialogDescription className="text-xs">{t("description")}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="flex flex-col gap-4">
          <FormRow>
            <FormField label={t("name")} htmlFor={field("name")} required error={touched ? errors.name : undefined}>
              <Input
                id={field("name")}
                autoFocus
                value={name}
                maxLength={100}
                placeholder={t("name_placeholder")}
                aria-invalid={Boolean(touched && errors.name) || undefined}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setTouched(true)}
              />
            </FormField>
            <FormField label={t("platform")} htmlFor={field("platform")}>
              <OptionSelect<PlatformId>
                id={field("platform")}
                options={platformOptions}
                value={platform}
                allowNone
                noneLabel={t("multi_platform")}
                placeholder={t("multi_platform")}
                onChange={setPlatform}
              />
            </FormField>
          </FormRow>
          <FormField label={t("description_label")} htmlFor={field("description")}>
            <Textarea
              id={field("description")}
              rows={2}
              className="min-h-14"
              value={description}
              maxLength={400}
              placeholder={t("description_placeholder")}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <FormField label={t("deliverables")}>
            <ListEditor
              variant="lines"
              value={deliverables}
              onChange={setDeliverables}
              placeholder={t("deliverables_placeholder")}
              addLabel={t("add_deliverable")}
              maxItems={12}
              aria-label={t("deliverables")}
            />
          </FormField>
          <FormRow>
            <FormField label={t("price")} htmlFor={field("price")} description={t("price_help")} error={errors.price}>
              <NumberField
                id={field("price")}
                min={0}
                step={0.01}
                value={price}
                prefix={currencySymbol(currency)}
                placeholder="—"
                aria-invalid={Boolean(errors.price) || undefined}
                onChange={setPrice}
              />
            </FormField>
            <FormField label={t("currency")} htmlFor={field("currency")}>
              <OptionSelect id={field("currency")} options={currencyOptions} value={currency} onChange={(next) => next && setCurrency(next)} />
            </FormField>
          </FormRow>
          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-1">
              <Label htmlFor={field("active")} className="text-sm">
                {t("active")}
              </Label>
              <InfoHint title={t("active")}>{t("active_help")}</InfoHint>
            </div>
            <Switch id={field("active")} checked={active} onCheckedChange={setActive} />
          </div>
        </div>
      </div>
      <DialogFooter className="m-0 rounded-b-xl px-4 py-3">
        <Button type="button" variant="outline" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {card ? t("submit_edit") : t("submit_new")}
        </Button>
      </DialogFooter>
    </form>
  )
}
