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
import { dataActions, logMetrics, useLookup, useSettings, useTable } from "@/lib/store"
import type { AppSettings, ContentItem, ID, ISODate } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { CaptureBody, CaptureDialog, CaptureFooter, CaptureHeader, ShortcutHint } from "./capture-dialog"
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

function tierMessage(tier: TierInfo | undefined, item: ContentItem, settings: AppSettings, markedPublished: boolean) {
  const platform = PLATFORMS[item.platform]?.label ?? item.platform
  const title = truncate(item.title.trim() || "Untitled content", 60)
  const published = markedPublished ? " Marked as published." : ""
  if (!tier || tier.ratio === null) {
    return {
      title: "Analytics saved",
      description: `${title} — not enough ${platform} posts to compare yet (tiers start after ${settings.winner_min_sample}).${published}`,
    }
  }
  const metric = settings.winner_metric === "composite" ? "performance" : (WINNER_METRIC_MAP[settings.winner_metric]?.label.toLowerCase() ?? "views")
  return {
    title: `Analytics saved · ${PERFORMANCE_TIERS[tier.tier].label}`,
    description: `${title} — ${formatMultiple(tier.ratio)} your ${platform} average ${metric} over the last ${tier.sampleSize} posts.${published}`,
  }
}

function AddMetricsForm({ initialItemId, onClose }: { initialItemId?: ID; onClose: () => void }) {
  const router = useRouter()
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
    item: item ? null : "Choose the post these numbers belong to.",
    date: !recordedAt
      ? "Pick the day you read these numbers."
      : recordedAt > today
        ? "That day hasn't happened yet."
        : minDate && recordedAt < minDate
          ? `That's before it went live (${formatDate(minDate, "MMM d")}).`
          : null,
    metrics: hasAnyMetric(values) ? null : "Enter at least one number.",
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
      toast.error("Couldn't save analytics", { description: error instanceof Error ? error.message : String(error) })
      return
    }
    const tier = computeTiers(dataActions.getDb(), settings, new Date()).get(item.id)
    const message = tierMessage(tier, item, settings, !wasLive)
    toast.success(message.title, {
      description: message.description,
      action: { label: "Open", onClick: () => router.push(`/studio/${item.id}`) },
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
        title="Add analytics"
        description="Log the latest numbers for a post. Analytics, winner detection and reports update right away."
      />
      <CaptureBody className="flex flex-col gap-5">
        <FormField label="Post" required error={attempted ? errors.item : undefined}>
          {item ? (
            <SelectedContent item={item} previous={previous} onChange={() => setItemId(null)} />
          ) : (
            <ContentPicker items={pickable} latest={latest} onSelect={choose} />
          )}
        </FormField>

        {item ? (
          <>
            <FormField
              label="Recorded on"
              htmlFor={`${formId}-date`}
              error={attempted ? errors.date : undefined}
              description={
                previous
                  ? `Pre-filled from the ${formatDate(previous.recorded_at, "MMM d")} snapshot — update what changed.`
                  : "First numbers for this post."
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

            <FormField label="Notes" htmlFor={`${formId}-notes`}>
              <Textarea
                id={`${formId}-notes`}
                rows={2}
                className="min-h-14"
                value={notes}
                maxLength={1000}
                placeholder="Anything behind these numbers — a boost, a repost, a comment that took off…"
                onChange={(event) => setNotes(event.target.value)}
              />
            </FormField>
          </>
        ) : null}
      </CaptureBody>
      <CaptureFooter status={valid ? <ShortcutHint /> : <span className="truncate max-sm:hidden">{firstError}</span>}>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Save analytics
        </Button>
      </CaptureFooter>
    </form>
  )
}
