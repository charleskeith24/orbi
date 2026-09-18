"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState, FacetFilter, PlatformIcon, SearchInput, type FacetOption } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PLATFORM_IDS, PLATFORMS } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT, useUiLang } from "@/lib/i18n"
import { dataActions, useDb } from "@/lib/store"
import type { ContentExperiment, ID } from "@/lib/types"
import { cn, formatNumber, matchesQuery } from "@/lib/utils"
import { experimentPickerMessages } from "./detail-messages"
import { dateRangeLabel, formatMetricValue, metricLabel, pickerCandidates, variantIds, variantPatch, type Variant } from "./experiment-model"

const MAX_ROWS = 80

/** Choose the published posts that tested one variant (the selection replaces the variant's list). */
export function ExperimentItemPicker({
  open,
  onOpenChange,
  experiment,
  variant,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  experiment: ContentExperiment
  variant: Variant
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(42rem,calc(100dvh-2rem))] flex-col gap-0 p-0 sm:max-w-xl">
        <PickerForm key={`${experiment.id}-${variant}`} experiment={experiment} variant={variant} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function PickerForm({ experiment, variant, onDone }: { experiment: ContentExperiment; variant: Variant; onDone: () => void }) {
  const t = useT(experimentPickerMessages)
  const lang = useUiLang()
  const db = useDb()
  const current = variantIds(experiment, variant)
  const hasDates = Boolean(experiment.start_date || experiment.end_date)
  const [query, setQuery] = useState("")
  const [withinDates, setWithinDates] = useState(hasDates)
  const [platforms, setPlatforms] = useState<string[]>([])
  const [selected, setSelected] = useState<ID[]>(current)
  const letter = variant.toUpperCase()
  const name = variant === "a" ? experiment.variant_a : experiment.variant_b
  const windowLabel = !hasDates
    ? t("window_none")
    : experiment.start_date && experiment.end_date
      ? t("window_range", { range: dateRangeLabel(experiment, lang) })
      : experiment.start_date
        ? t("window_from", { date: formatDate(experiment.start_date, "MMM d") })
        : t("window_until", { date: formatDate(experiment.end_date, "MMM d") })

  const candidates = useMemo(() => pickerCandidates(db, experiment, variant), [db, experiment, variant])
  const chosen = new Set(selected)
  const visible = candidates.filter(
    (c) =>
      (!withinDates || c.inWindow || chosen.has(c.item.id)) &&
      (!platforms.length || platforms.includes(c.item.platform)) &&
      matchesQuery(query, c.item.title, c.item.hook)
  )
  const shown = visible.slice(0, MAX_ROWS)
  const measured = candidates.filter((c) => chosen.has(c.item.id) && c.value !== null).length
  const changed = selected.length !== current.length || selected.some((id) => !current.includes(id))

  const platformOptions: FacetOption[] = PLATFORM_IDS.filter((p) => candidates.some((c) => c.item.platform === p)).map((p) => ({
    value: p,
    label: PLATFORMS[p].label,
    count: candidates.filter((c) => c.item.platform === p).length,
    icon: <PlatformIcon platform={p} className="size-3.5 text-muted-foreground" />,
  }))

  function toggle(id: ID) {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  function save() {
    dataActions.update("content_experiments", experiment.id, variantPatch(variant, selected))
    toast.success(t.plural("linked", selected.length, { letter, count: formatNumber(selected.length) }), {
      description:
        measured === selected.length
          ? undefined
          : t("without_data", { count: selected.length - measured, metric: metricLabel(experiment.metric).toLowerCase() }),
    })
    onDone()
  }

  return (
    <>
      <DialogHeader className="gap-1 border-b py-3.5 pr-12 pl-4">
        <DialogTitle>
          {t("title", { letter })}
          {name ? <span className="font-normal text-muted-foreground"> · {name}</span> : null}
        </DialogTitle>
        <DialogDescription className="text-xs">{t("description", { metric: metricLabel(experiment.metric).toLowerCase() })}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5">
        <SearchInput value={query} onChange={setQuery} placeholder={t("search_posts")} className="sm:w-56" autoFocus />
        <FacetFilter title={t("platform")} options={platformOptions} value={platforms} onChange={setPlatforms} />
        <div className="flex items-center gap-2 sm:ml-auto">
          <Switch id="picker-within-dates" size="sm" checked={withinDates} onCheckedChange={setWithinDates} disabled={!hasDates} />
          <Label htmlFor="picker-within-dates" className="text-xs font-normal text-muted-foreground">
            {windowLabel}
          </Label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {shown.length ? (
          <ul className="divide-y" aria-label={t("list_aria")}>
            {shown.map(({ item, date, value, inWindow, inOther }) => {
              const checked = chosen.has(item.id)
              const inputId = `pick-${variant}-${item.id}`
              return (
                <li
                  key={item.id}
                  className={cn("flex items-center gap-3 px-4 py-2", inOther ? "opacity-60" : "hover:bg-muted/40 has-[[data-state=checked]]:bg-muted/40")}
                >
                  <Checkbox id={inputId} checked={checked} disabled={inOther} onCheckedChange={() => toggle(item.id)} />
                  <label htmlFor={inputId} className={cn("flex min-w-0 flex-1 items-center gap-3", inOther ? "cursor-not-allowed" : "cursor-pointer")}>
                    <PlatformIcon platform={item.platform} label className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.title || t("untitled_content")}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {date ? formatDate(date, "MMM d, yyyy") : t("no_date")}
                        {inWindow ? t("in_window") : ""}
                        {inOther ? t("in_variant", { letter: variant === "a" ? "B" : "A" }) : ""}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-xs num", value === null ? "text-muted-foreground" : "font-medium")}>
                      {value === null ? t("no_data") : formatMetricValue(experiment.metric, value)}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            compact
            title={t("empty_title")}
            description={withinDates && hasDates ? t("empty_window") : t("empty_search")}
          />
        )}
        {visible.length > shown.length ? (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            {t("showing", { shown: MAX_ROWS, total: visible.length })}
          </p>
        ) : null}
      </div>

      <DialogFooter className="m-0 items-center rounded-b-xl px-4 py-3 sm:justify-between">
        <span className="text-xs text-muted-foreground num">
          {selected.length
            ? t.plural("selected", selected.length, { count: formatNumber(selected.length), measured })
            : t("none_selected")}
        </span>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={!changed}>
            {t("save_selection")}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
