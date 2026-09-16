"use client"

import {
  BadgeCheck,
  ChevronsUpDown,
  CircleCheck,
  CircleDashed,
  CircleX,
  FileSignature,
  Hammer,
  Hourglass,
  MessagesSquare,
  PackageCheck,
  Send,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { keywordFilter, PlatformIcon, type SelectOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DEAL_STATUS_IDS, PIPELINE_STAGE_MAP, PLATFORMS } from "@/lib/constants"
import { useT } from "@/lib/i18n"
import { dealStatusMessages, incomeStatusMessages } from "@/lib/i18n/messages/money"
import { useTable } from "@/lib/store"
import type { ContentItem, DealStatus, ID, IncomeStatus } from "@/lib/types"
import { cn, formatMoney } from "@/lib/utils"
import { moneyMessages } from "./messages"
import type { CurrencyTotal } from "./money-model"

export const DEAL_STATUS_ICONS: Record<DealStatus, LucideIcon> = {
  lead: CircleDashed,
  pitched: Send,
  negotiating: MessagesSquare,
  contracted: FileSignature,
  in_progress: Hammer,
  delivered: PackageCheck,
  paid: BadgeCheck,
  lost: CircleX,
}

const PILL =
  "inline-flex h-5 w-fit max-w-full shrink-0 items-center gap-1 rounded-md border bg-card px-1.5 text-xs font-medium whitespace-nowrap text-foreground/85 dark:bg-input/30 [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground"

export function DealStatusIcon({ status, className }: { status: DealStatus; className?: string }) {
  const Icon = DEAL_STATUS_ICONS[status]
  return <Icon className={cn("size-3.5 shrink-0 text-muted-foreground", className)} aria-hidden />
}

export function DealStatusBadge({ status, className }: { status: DealStatus; className?: string }) {
  const label = useT(dealStatusMessages)
  const Icon = DEAL_STATUS_ICONS[status]
  return (
    <span className={cn(PILL, className)}>
      <Icon aria-hidden />
      <span className="truncate">{label(status)}</span>
    </span>
  )
}

export function IncomeStatusBadge({ status, className }: { status: IncomeStatus; className?: string }) {
  const label = useT(incomeStatusMessages)
  const Icon = status === "received" ? CircleCheck : Hourglass
  return (
    <span className={cn(PILL, className)}>
      <Icon aria-hidden />
      <span className="truncate">{label(status)}</span>
    </span>
  )
}

export function useDealStatusOptions(): SelectOption<DealStatus>[] {
  const label = useT(dealStatusMessages)
  return useMemo(
    () => DEAL_STATUS_IDS.map((s) => ({ value: s, label: label(s), icon: <DealStatusIcon status={s} /> })),
    [label]
  )
}

/** "₱12,500 + $800" — totals stay per currency. `lead` renders the first amount stronger. */
export function MoneyTotals({
  totals,
  empty = "—",
  compact = false,
  className,
}: {
  totals: readonly CurrencyTotal[]
  empty?: React.ReactNode
  compact?: boolean
  className?: string
}) {
  if (!totals.length) return <span className={className}>{empty}</span>
  return (
    <span className={cn("num", className)}>
      {totals.map((t, i) => (
        <span key={t.currency}>
          {i > 0 ? " + " : null}
          {formatMoney(t.amount, t.currency, { compact })}
        </span>
      ))}
    </span>
  )
}

/** Hero value for a stat tile: the first currency; the rest as a quiet "+ $800" line. */
export function useSplitTotals(totals: readonly CurrencyTotal[], primary: string) {
  const m = useT(moneyMessages)
  const lead = totals[0] ?? { currency: primary, amount: 0 }
  const rest = totals.slice(1)
  return {
    value: formatMoney(lead.amount, lead.currency),
    lead,
    others: rest.length ? m("also", { amounts: rest.map((t) => formatMoney(t.amount, t.currency)).join(" + ") }) : null,
  }
}

/** Searchable content picker (popover). `excludeIds` hides items that are already linked. */
export function ContentCombobox({
  value,
  onChange,
  excludeIds,
  placeholder,
  searchPlaceholder,
  emptyText,
  noneLabel,
  id,
  className,
  trigger,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  value: ID | null
  onChange: (id: ID | null) => void
  excludeIds?: readonly ID[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  /** Adds a "none" row that clears the value. */
  noneLabel?: string
  id?: string
  className?: string
  /** Custom trigger (e.g. a "Link content" button); defaults to a select-like button. */
  trigger?: React.ReactElement
  "aria-label"?: string
  "aria-invalid"?: boolean
}) {
  const m = useT(moneyMessages)
  const [open, setOpen] = useState(false)
  const items = useTable("content_items")
  const selected = value ? items.find((i) => i.id === value) : undefined
  const options = useMemo(() => {
    const hidden = new Set(excludeIds ?? [])
    const at = (i: ContentItem) => i.published_at ?? i.scheduled_at ?? i.due_date ?? i.created_at
    return items.filter((i) => !hidden.has(i.id)).sort((a, b) => at(b).localeCompare(at(a)))
  }, [items, excludeIds])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            className={cn("w-full min-w-0 justify-between font-normal", !selected && "text-muted-foreground", className)}
          >
            <span className="flex min-w-0 items-center gap-2">
              {selected ? <PlatformIcon platform={selected.platform} className="size-3.5 shrink-0 text-muted-foreground" /> : null}
              <span className="truncate">{selected ? selected.title.trim() || m("untitled_content") : placeholder}</span>
            </span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] gap-0 p-0">
        <Command filter={keywordFilter}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {noneLabel && value ? (
                <CommandItem
                  value="__none__"
                  keywords={[noneLabel]}
                  onSelect={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                  className="text-muted-foreground"
                >
                  {noneLabel}
                </CommandItem>
              ) : null}
              {options.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  keywords={[item.title, PLATFORMS[item.platform].label]}
                  onSelect={() => {
                    onChange(item.id)
                    setOpen(false)
                  }}
                  className="gap-2"
                >
                  <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.title.trim() || m("untitled_content")}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{PIPELINE_STAGE_MAP[item.stage]?.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
