"use client"

import { CircleCheck, Hourglass } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"
import { ChipToggleGroup, DatePicker, FormField, FormRow, NumberField, OptionSelect, PlatformIcon, type SelectOption } from "@/components/common"
import { CaptureBody, CaptureDialog, CaptureFooter, CaptureHeader, ShortcutHint } from "@/components/features/capture/capture-dialog"
import { submitOnModEnter } from "@/components/features/capture/capture-utils"
import { useNow } from "@/components/features/today/use-now"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AFFILIATE_PROGRAM_SUGGESTIONS, CURRENCY_CODES, INCOME_SOURCE_IDS, PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { incomeSourceMessages, incomeStatusMessages } from "@/lib/i18n/messages/money"
import { dataActions, useRow, useSettings, useTable } from "@/lib/store"
import type { ID, IncomeEntry, IncomeSource, IncomeStatus, ISODate, PlatformId } from "@/lib/types"
import { currencySymbol, formatMoney } from "@/lib/utils"
import { logIncomeMessages, moneyMessages } from "./messages"
import { normalizeCurrency, roundMoney } from "./money-model"
import { ContentCombobox } from "./money-ui"

const DESCRIPTION_MAX = 200

/**
 * Global "Log income" dialog (`uiActions.openDialog({ type: "log-income", dealId?, itemId? })`): amount,
 * currency, source, received/expected, date, description, platform, affiliate program and optional links to
 * a brand deal and a content item.
 */
export function LogIncomeDialog({
  open,
  onOpenChange,
  dealId,
  itemId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealId?: ID
  itemId?: ID
}) {
  return (
    <CaptureDialog open={open} onOpenChange={onOpenChange}>
      <IncomeForm dealId={dealId} itemId={itemId} onClose={() => onOpenChange(false)} />
    </CaptureDialog>
  )
}

/** The same form for editing an existing entry (Income page). */
export function IncomeFormDialog({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: IncomeEntry | null
}) {
  return (
    <CaptureDialog open={open} onOpenChange={onOpenChange}>
      {entry ? <IncomeForm key={entry.id} entry={entry} onClose={() => onOpenChange(false)} /> : null}
    </CaptureDialog>
  )
}

type FieldKey = "amount" | "source" | "date" | "description"

function IncomeForm({ entry, dealId, itemId, onClose }: { entry?: IncomeEntry; dealId?: ID; itemId?: ID; onClose: () => void }) {
  const t = useT(logIncomeMessages)
  const m = useT(moneyMessages)
  const c = useT(commonMessages)
  const sourceLabel = useT(incomeSourceMessages)
  const statusLabel = useT(incomeStatusMessages)
  const router = useRouter()
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const now = useNow()
  const settings = useSettings()
  const deals = useTable("brand_deals")
  const presetDeal = useRow("brand_deals", entry ? null : dealId)
  const presetItem = useRow("content_items", entry ? null : itemId)

  const [amount, setAmount] = useState<number | null>(entry?.amount ?? null)
  const [currency, setCurrency] = useState(() => normalizeCurrency(entry?.currency ?? presetDeal?.currency ?? settings.currency))
  const [source, setSource] = useState<IncomeSource | null>(entry?.source ?? (presetDeal ? "brand_deal" : null))
  const [status, setStatus] = useState<IncomeStatus>(entry?.status ?? "received")
  const [date, setDate] = useState<ISODate | null>(() => entry?.date ?? toISODate(now))
  const [description, setDescription] = useState(entry?.description ?? presetDeal?.brand_name ?? "")
  const [program, setProgram] = useState(entry?.affiliate_program ?? "")
  const [platform, setPlatform] = useState<PlatformId | null>(
    entry ? entry.platform : (presetItem?.platform ?? (presetDeal?.platforms.length === 1 ? presetDeal.platforms[0] : null))
  )
  const [linkedDeal, setLinkedDeal] = useState<ID | null>(entry?.brand_deal_id ?? presetDeal?.id ?? null)
  const [linkedItem, setLinkedItem] = useState<ID | null>(entry?.content_item_id ?? presetItem?.id ?? null)
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const deal = linkedDeal ? deals.find((d) => d.id === linkedDeal) : undefined

  const sourceOptions = useMemo(() => INCOME_SOURCE_IDS.map((s) => ({ value: s, label: sourceLabel(s) })), [sourceLabel])
  const statusOptions = useMemo(
    () => [
      { value: "received" as const, label: statusLabel("received"), icon: CircleCheck },
      { value: "expected" as const, label: statusLabel("expected"), icon: Hourglass },
    ],
    [statusLabel]
  )
  const currencyOptions = useMemo<SelectOption[]>(
    () => [...new Set([...CURRENCY_CODES, currency])].map((code) => ({ value: code, label: `${code} · ${currencySymbol(code)}` })),
    [currency]
  )
  const platformOptions = useMemo<SelectOption<PlatformId>[]>(
    () =>
      PLATFORM_IDS.map((p) => ({
        value: p,
        label: PLATFORMS[p].label,
        icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
      })),
    []
  )
  const dealOptions = useMemo<SelectOption[]>(
    () =>
      [...deals]
        .sort((a, b) => Number(a.status === "lost") - Number(b.status === "lost") || a.brand_name.localeCompare(b.brand_name))
        .map((d) => ({ value: d.id, label: d.brand_name || m("untitled_deal") })),
    [deals, m]
  )

  const errors: Record<FieldKey, string | null> = {
    amount: amount !== null && amount > 0 ? null : t("error_amount"),
    source: source ? null : t("error_source"),
    date: date ? null : t("error_date"),
    description: description.trim().length > DESCRIPTION_MAX ? t("error_description", { max: DESCRIPTION_MAX }) : null,
  }
  const firstError = errors.amount ?? errors.source ?? errors.date ?? errors.description
  const valid = firstError === null
  const shown = (key: FieldKey) => (touched[key] ? (errors[key] ?? undefined) : undefined)
  const mismatch = deal && normalizeCurrency(deal.currency) !== currency

  function chooseDeal(next: ID | null) {
    setLinkedDeal(next)
    const chosen = next ? deals.find((d) => d.id === next) : undefined
    if (!chosen) return
    if (!source) setSource("brand_deal")
    if (amount === null) setCurrency(normalizeCurrency(chosen.currency))
    if (!description.trim()) setDescription(chosen.brand_name)
  }

  function submit() {
    setTouched({ amount: true, source: true, date: true, description: true })
    if (!valid || amount === null || !source || !date) return
    const values = {
      date,
      amount: roundMoney(amount),
      currency,
      source,
      status,
      affiliate_program: source === "affiliate" ? program.trim() : "",
      platform,
      brand_deal_id: linkedDeal,
      content_item_id: linkedItem,
      description: description.trim(),
    }
    const summary = `${formatMoney(values.amount, values.currency)} · ${sourceLabel(values.source)}`
    if (entry) {
      dataActions.update("income_entries", entry.id, values)
      toast.success(t("updated"), { description: summary })
    } else {
      const row = dataActions.insert("income_entries", values)
      toast.success(t("logged"), {
        description: summary,
        action: { label: t("view"), onClick: () => router.push(`/money/income?open=${row.id}`) },
      })
    }
    onClose()
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
      <CaptureHeader title={entry ? t("title_edit") : t("title")} description={entry ? t("description_edit") : t("description")} />
      <CaptureBody className="flex flex-col gap-4">
        <FormRow>
          <FormField label={t("amount")} htmlFor={field("amount")} required error={shown("amount")}>
            <NumberField
              id={field("amount")}
              min={0}
              step={0.01}
              value={amount}
              prefix={currencySymbol(currency)}
              placeholder="0"
              aria-invalid={Boolean(shown("amount")) || undefined}
              onChange={setAmount}
              onBlur={() => setTouched((x) => ({ ...x, amount: true }))}
            />
          </FormField>
          <FormField label={t("currency")} htmlFor={field("currency")}>
            <OptionSelect id={field("currency")} options={currencyOptions} value={currency} onChange={(next) => next && setCurrency(next)} />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label={t("source")} htmlFor={field("source")} required error={shown("source")}>
            <OptionSelect<IncomeSource>
              id={field("source")}
              options={sourceOptions}
              value={source}
              placeholder={t("source_placeholder")}
              aria-invalid={Boolean(shown("source")) || undefined}
              onChange={(next) => {
                setSource(next)
                setTouched((x) => ({ ...x, source: true }))
              }}
            />
          </FormField>
          <FormField label={t("status")}>
            <ChipToggleGroup
              options={statusOptions}
              value={status}
              required
              size="default"
              aria-label={t("status")}
              onChange={(next) => next && setStatus(next)}
            />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField
            label={status === "expected" ? t("date_expected") : t("date_received")}
            htmlFor={field("date")}
            required
            error={shown("date")}
          >
            <DatePicker
              id={field("date")}
              value={date}
              clearable={false}
              aria-invalid={Boolean(shown("date")) || undefined}
              onChange={(next) => {
                setDate(next)
                setTouched((x) => ({ ...x, date: true }))
              }}
            />
          </FormField>
          <FormField label={t("platform")} htmlFor={field("platform")}>
            <OptionSelect<PlatformId>
              id={field("platform")}
              options={platformOptions}
              value={platform}
              allowNone
              noneLabel={m("no_platform")}
              placeholder={m("no_platform")}
              onChange={setPlatform}
            />
          </FormField>
        </FormRow>

        {source === "affiliate" ? (
          <FormField label={t("program")} htmlFor={field("program")}>
            <Input
              id={field("program")}
              list={field("programs")}
              value={program}
              maxLength={80}
              placeholder={t("program_placeholder")}
              onChange={(event) => setProgram(event.target.value)}
            />
            <datalist id={field("programs")}>
              {AFFILIATE_PROGRAM_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </FormField>
        ) : null}

        <FormField label={t("description_label")} htmlFor={field("description")} error={shown("description")}>
          <Input
            id={field("description")}
            value={description}
            maxLength={DESCRIPTION_MAX + 20}
            placeholder={t("description_placeholder")}
            aria-invalid={Boolean(shown("description")) || undefined}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => setTouched((x) => ({ ...x, description: true }))}
          />
        </FormField>

        <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
          <legend className="px-1 text-xs text-muted-foreground">{t("links")}</legend>
          <FormRow>
            <FormField
              label={t("deal")}
              htmlFor={field("deal")}
              description={
                mismatch ? t("currency_mismatch", { brand: deal.brand_name || m("untitled_deal"), currency: normalizeCurrency(deal.currency) }) : undefined
              }
            >
              <OptionSelect
                id={field("deal")}
                options={dealOptions}
                value={linkedDeal}
                allowNone
                noneLabel={t("deal_none")}
                placeholder={t("deal_none")}
                onChange={chooseDeal}
              />
            </FormField>
            <FormField label={t("content")} htmlFor={field("content")}>
              <ContentCombobox
                id={field("content")}
                value={linkedItem}
                onChange={setLinkedItem}
                placeholder={t("content_placeholder")}
                searchPlaceholder={t("content_search")}
                emptyText={t("content_empty")}
                noneLabel={t("content_none")}
              />
            </FormField>
          </FormRow>
        </fieldset>
      </CaptureBody>
      <CaptureFooter status={valid ? <ShortcutHint /> : <span className="truncate max-sm:hidden">{firstError}</span>}>
        <Button type="button" variant="outline" onClick={onClose}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {entry ? t("submit_edit") : t("submit")}
        </Button>
      </CaptureFooter>
    </form>
  )
}
