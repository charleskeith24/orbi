"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId, useMemo, useState } from "react"
import { toast } from "sonner"
import { DatePicker, FormField } from "@/components/common"
import { useNow } from "@/components/features/today/use-now"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { computeTiers, formatMultiple, isPublishedItem, latestMetricsByItem, publishedAtOf, type TierInfo } from "@/lib/analytics"
import { BUFFER_STAGES, PERFORMANCE_TIERS, PLATFORMS, WINNER_METRIC_MAP } from "@/lib/constants"
import { formatDate, toISODate } from "@/lib/dates"
import { translate, useT, useUiLang, type UiLang } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dataActions, logMetrics, useLookup, useSettings, useTable } from "@/lib/store"
import type { AppSettings, ContentItem, ID, ISODate } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { CaptureBody, CaptureDialog, CaptureFooter, CaptureHeader, ShortcutHint } from "./capture-dialog"
import { addMetricsMessages, captureMessages } from "./capture-messages"
import { draftFromSnapshot, hasAnyMetric, isVideoContent, submitOnModEnter, toMetricValues, type MetricDraft } from "./capture-utils"
import { ContentPicker, SelectedContent } from "./content-picker"
import { MetricFields, RatesPreview } from "./metric-fields"

/**
 * Add Analytics (spec §25): pick a post, update its numbers (pre-filled from the latest snapshot),
 * watch the rates recompute, save → the toast reports the post's new performance tier.
 */
export function AddMetricsDialog({
  open,
  onOpenChange,
  itemId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId?: ID
}) {
  return (
    <CaptureDialog open={open} onOpenChange={onOpenChange} size="lg">
      <AddMetricsForm key={itemId ?? "pick"} initialItemId={itemId} onClose={() => onOpenChange(false)} />
    </CaptureDialog>
  )
}

function tierMessage(tier: TierInfo | undefined, item: ContentItem, settings: AppSettings, markedPublished: boolean, lang: UiLang) {
  const t = (key: keyof (typeof addMetricsMessages)["en"] & string, vars?: Record<string, string | number>) =>
    translate(addMetricsMessages, lang, key, vars)
  const platform = PLATFORMS[item.platform]?.label ?? item.platform
  const title = truncate(item.title.trim() || translate(captureMessages, lang, "untitled_content"), 60)
  const published = markedPublished ? ` ${t("marked_published")}` : ""
  if (!tier || tier.ratio === null) {
    return {
      title: t("saved"),
      description: `${t("not_enough", { title, platform, min: settings.winner_min_sample })}${published}`,
    }
  }
  const metric =
    settings.winner_metric === "composite"
      ? t("metric_performance")
      : (WINNER_METRIC_MAP[settings.winner_metric]?.label.toLowerCase() ?? t("metric_views"))
  return {
    title: t("saved_tier", { tier: PERFORMANCE_TIERS[tier.tier].label }),
    description: `${t("tier_description", { title, ratio: formatMultiple(tier.ratio), platform, metric, count: tier.sampleSize })}${published}`,
  }
}

function AddMetricsForm({ initialItemId, onClose }: { initialItemId?: ID; onClose: () => void }) {
  const router = useRouter()
  const t = useT(addMetricsMessages)
  const c = useT(commonMessages)
  const lang = useUiLang()
  const formId = useId()
  const now = useNow()
  const today = toISODate(now)
  const items = useTable("content_items")
  const metrics = useTable("content_metrics")
  const formats = useLookup("content_formats")
  const settings = useSettings()
  const latest = useMemo(() => latestMetricsByItem({ content_metrics: metrics }), [metrics])
  const pickable = useMemo(
    () => items.filter((i) => isPublishedItem(i) || BUFFER_STAGES.includes(i.stage) || i.id === initialItemId),
    [items, initialItemId]
  )

  const [itemId, setItemId] = useState<ID | null>(() =>
    initialItemId && items.some((i) => i.id === initialItemId) ? initialItemId : null
  )
  const [values, setValues] = useState<MetricDraft>(() => draftFromSnapshot(itemId ? latest.get(itemId) : null))
  const [recordedAt, setRecordedAt] = useState<ISODate | null>(today)
  const [notes, setNotes] = useState("")
  const [attempted, setAttempted] = useState(false)

  const item = itemId ? items.find((i) => i.id === itemId) : undefined
  const previous = item ? latest.get(item.id) : undefined
  const format = item?.format_id ? formats.get(item.format_id) : undefined
  const video = item ? isVideoContent(item.platform, format) : false
  const publishedAt = item && isPublishedItem(item) ? publishedAtOf(item) : null
  const minDate = publishedAt ? toISODate(publishedAt) : undefined

  const errors = {
    item: item ? null : t("choose_post"),
    date: !recordedAt
      ? t("pick_day")
      : recordedAt > today
        ? t("future_day")
        : minDate && recordedAt < minDate
          ? t("before_live", { date: formatDate(minDate, "MMM d") })
          : null,
    metrics: hasAnyMetric(values) ? null : t("enter_number"),
  }
  const firstError = errors.item ?? errors.date ?? errors.metrics
  const valid = firstError === null

  const focusFirstField = () => requestAnimationFrame(() => document.getElementById(`${formId}-views`)?.focus())

  // Opened for a specific post: start in the numbers, with the numeric keyboard up on phones.
  useEffect(() => {
    if (initialItemId) focusFirstField()
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function choose(id: ID) {
    setItemId(id)
    setValues(draftFromSnapshot(latest.get(id)))
    setRecordedAt(today)
    setAttempted(false)
    focusFirstField()
  }

  function submit() {
    setAttempted(true)
    if (!item || !recordedAt || !valid) return
    const wasLive = isPublishedItem(item)
    try {
      logMetrics(item.id, { ...toMetricValues(values), recorded_at: recordedAt, notes: notes.trim(), source: "manual" })
    } catch (error) {
      toast.error(t("save_failed"), { description: error instanceof Error ? error.message : String(error) })
      return
    }
    const tier = computeTiers(dataActions.getDb(), settings, new Date()).get(item.id)
    const message = tierMessage(tier, item, settings, !wasLive, lang)
    toast.success(message.title, {
      description: message.description,
      action: { label: t("open"), onClick: () => router.push(`/studio/${item.id}`) },
    })
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
      <CaptureHeader
        title={t("heading")}
        description={t("description")}
      />
      <CaptureBody className="flex flex-col gap-5">
        <FormField label={t("post")} required error={attempted ? errors.item : undefined}>
          {item ? (
            <SelectedContent item={item} previous={previous} onChange={() => setItemId(null)} />
          ) : (
            <ContentPicker items={pickable} latest={latest} onSelect={choose} />
          )}
        </FormField>

        {item ? (
          <>
            <FormField
              label={t("recorded_on")}
              htmlFor={`${formId}-date`}
              error={attempted ? errors.date : undefined}
              description={
                previous
                  ? t("prefilled", { date: formatDate(previous.recorded_at, "MMM d") })
                  : t("first_numbers")
              }
            >
              <DatePicker
                id={`${formId}-date`}
                value={recordedAt}
                clearable={false}
                maxDate={today}
                minDate={minDate}
                className="sm:max-w-64"
                aria-invalid={Boolean(attempted && errors.date) || undefined}
                onChange={setRecordedAt}
              />
            </FormField>

            <MetricFields
              values={values}
              showVideo={video}
              idPrefix={formId}
              onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
            />
            {attempted && errors.metrics ? (
              <p role="alert" className="-mt-2 text-xs text-destructive">
                {errors.metrics}
              </p>
            ) : null}

            <RatesPreview values={values} />

            <FormField label={t("notes")} htmlFor={`${formId}-notes`}>
              <Textarea
                id={`${formId}-notes`}
                rows={2}
                className="min-h-14"
                value={notes}
                maxLength={1000}
                placeholder={t("notes_placeholder")}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FormField>
          </>
        ) : null}
      </CaptureBody>
      <CaptureFooter status={valid ? <ShortcutHint /> : <span className="truncate max-sm:hidden">{firstError}</span>}>
        <Button type="button" variant="outline" onClick={onClose}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t("save")}
        </Button>
      </CaptureFooter>
    </form>
  )
}
