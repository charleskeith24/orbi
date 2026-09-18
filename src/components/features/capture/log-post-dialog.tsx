"use client"

import { ChartColumn, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { toast } from "sonner"
import {
  CampaignSelect,
  DateTimePicker,
  FormatSelect,
  FormField,
  FormRow,
  FunnelSelect,
  HookCategorySelect,
  PillarSelect,
  PlatformSelect,
} from "@/components/common"
import { useNow } from "@/components/features/today/use-now"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseDate, toISODate } from "@/lib/dates"
import { useT } from "@/lib/i18n"
import { commonMessages } from "@/lib/i18n/messages/common"
import { logPublishedPost, uiActions, useBrand, useLookup } from "@/lib/store"
import type { FunnelStage, HookCategory, ID, ISODateTime, PlatformId } from "@/lib/types"
import { truncate } from "@/lib/utils"
import { CaptureBody, CaptureDialog, CaptureFooter, CaptureHeader, ShortcutHint } from "./capture-dialog"
import { captureMessages, logPostMessages } from "./capture-messages"
import {
  emptyMetricDraft,
  hasAnyMetric,
  isValidUrl,
  isVideoContent,
  normalizeUrl,
  submitOnModEnter,
  toMetricValues,
  type MetricDraft,
} from "./capture-utils"
import { MetricFields, RatesPreview } from "./metric-fields"

/** A publish time this far past "now" is a typo or a plan, not a published post. */
const FUTURE_TOLERANCE_MS = 5 * 60_000

interface Values {
  title: string
  platform: PlatformId
  publishedAt: ISODateTime | null
  url: string
  pillarId: ID | null
  formatId: ID | null
  hook: string
  hookCategory: HookCategory | null
  funnel: FunnelStage | null
  campaignId: ID | null
}

type FieldKey = "title" | "publishedAt" | "url"

/** Log Published Post (spec §32): record a post that went out outside the app, optionally with its first numbers. */
export function LogPostDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <CaptureDialog open={open} onOpenChange={onOpenChange} size="lg">
      <LogPostForm onClose={() => onOpenChange(false)} />
    </CaptureDialog>
  )
}

function LogPostForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const t = useT(logPostMessages)
  const f = useT(captureMessages)
  const c = useT(commonMessages)
  const id = useId()
  const field = (name: string) => `${id}-${name}`
  const now = useNow()
  const brand = useBrand()
  const formats = useLookup("content_formats")
  const [values, setValues] = useState<Values>(() => {
    const at = new Date(now)
    at.setSeconds(0, 0)
    return {
      title: "",
      platform: brand.main_platforms[0] ?? "facebook",
      publishedAt: at.toISOString(),
      url: "",
      pillarId: null,
      formatId: null,
      hook: "",
      hookCategory: null,
      funnel: null,
      campaignId: null,
    }
  })
  const [showMetrics, setShowMetrics] = useState(false)
  const [metrics, setMetrics] = useState<MetricDraft>(emptyMetricDraft)
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})

  const publishedDate = parseDate(values.publishedAt)
  const errors: Record<FieldKey, string | null> = {
    title: values.title.trim() ? null : t("title_required"),
    publishedAt: !publishedDate
      ? t("when_live")
      : publishedDate.getTime() > now.getTime() + FUTURE_TOLERANCE_MS
        ? t("future")
        : null,
    url: isValidUrl(values.url) ? null : t("url_invalid"),
  }
  const firstError = errors.title ?? errors.publishedAt ?? errors.url
  const valid = firstError === null
  const shown = (key: FieldKey) => (touched[key] ? (errors[key] ?? undefined) : undefined)
  const format = values.formatId ? formats.get(values.formatId) : undefined

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    if (key === "publishedAt") setTouched((t) => ({ ...t, publishedAt: true }))
  }

  function submit() {
    setTouched({ title: true, publishedAt: true, url: true })
    if (!valid || !values.publishedAt) return
    const hook = values.hook.trim()
    const withNumbers = showMetrics && hasAnyMetric(metrics)
    const item = logPublishedPost({
      item: {
        title: values.title.trim(),
        platform: values.platform,
        published_at: values.publishedAt,
        published_url: normalizeUrl(values.url),
        pillar_id: values.pillarId,
        format_id: values.formatId,
        hook,
        hook_category: hook ? values.hookCategory : null,
        funnel_stage: values.funnel,
        campaign_id: values.campaignId,
      },
      metrics: withNumbers ? { ...toMetricValues(metrics), recorded_at: toISODate(new Date()) } : null,
    })
    const open = { label: t("open"), onClick: () => router.push(`/studio/${item.id}`) }
    const title = truncate(item.title, 60)
    toast.success(t("logged"), {
      description: withNumbers ? t("logged_with_numbers", { title }) : title,
      ...(withNumbers
        ? { action: open }
        : {
            action: { label: t("add_analytics"), onClick: () => uiActions.openDialog({ type: "add-metrics", itemId: item.id }) },
            cancel: open,
          }),
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
      <CaptureBody className="flex flex-col gap-4">
        <FormField label={f("title")} htmlFor={field("title")} required error={shown("title")}>
          <Input
            id={field("title")}
            autoFocus
            value={values.title}
            maxLength={200}
            placeholder={t("title_placeholder")}
            aria-invalid={Boolean(shown("title")) || undefined}
            onChange={(event) => set("title", event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
          />
        </FormField>

        <FormRow>
          <FormField label={t("platform")} htmlFor={field("platform")} required>
            <PlatformSelect id={field("platform")} value={values.platform} onChange={(next) => next && set("platform", next)} />
          </FormField>
          <FormField label={t("published")} htmlFor={field("published")} required error={shown("publishedAt")}>
            <DateTimePicker
              id={field("published")}
              value={values.publishedAt}
              clearable={false}
              maxDate={toISODate(now)}
              aria-invalid={Boolean(shown("publishedAt")) || undefined}
              onChange={(next) => set("publishedAt", next)}
            />
          </FormField>
        </FormRow>

        <FormField label={t("post_url")} htmlFor={field("url")} error={shown("url")}>
          <Input
            id={field("url")}
            type="url"
            inputMode="url"
            autoComplete="off"
            value={values.url}
            placeholder="https://"
            aria-invalid={Boolean(shown("url")) || undefined}
            onChange={(event) => set("url", event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, url: true }))}
          />
        </FormField>

        <FormRow>
          <FormField label={f("pillar")} htmlFor={field("pillar")}>
            <PillarSelect id={field("pillar")} allowNone value={values.pillarId} onChange={(next) => set("pillarId", next)} />
          </FormField>
          <FormField label={f("format")} htmlFor={field("format")}>
            <FormatSelect id={field("format")} allowNone value={values.formatId} onChange={(next) => set("formatId", next)} />
          </FormField>
        </FormRow>

        <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <FormField label={f("hook")} htmlFor={field("hook")}>
            <Input
              id={field("hook")}
              value={values.hook}
              maxLength={300}
              placeholder={t("hook_placeholder")}
              onChange={(event) => set("hook", event.target.value)}
            />
          </FormField>
          <FormField label={f("hook_type")} htmlFor={field("hook-type")}>
            <HookCategorySelect id={field("hook-type")} allowNone value={values.hookCategory} onChange={(next) => set("hookCategory", next)} />
          </FormField>
        </div>

        <FormRow>
          <FormField label={f("funnel_stage")} htmlFor={field("funnel")}>
            <FunnelSelect id={field("funnel")} allowNone value={values.funnel} onChange={(next) => set("funnel", next)} />
          </FormField>
          <FormField label={f("campaign")} htmlFor={field("campaign")}>
            <CampaignSelect id={field("campaign")} allowNone value={values.campaignId} onChange={(next) => set("campaignId", next)} />
          </FormField>
        </FormRow>

        {showMetrics ? (
          <section aria-label={t("first_numbers")} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-medium">{t("first_numbers")}</h3>
                <p className="text-xs text-muted-foreground">{t("first_numbers_hint")}</p>
              </div>
              <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setShowMetrics(false)}>
                <X aria-hidden />
                {t("remove")}
              </Button>
            </div>
            <MetricFields
              values={metrics}
              showVideo={isVideoContent(values.platform, format)}
              idPrefix={field("metric")}
              onChange={(key, value) => setMetrics((current) => ({ ...current, [key]: value }))}
            />
            <RatesPreview values={metrics} />
          </section>
        ) : (
          <Button type="button" variant="outline" className="self-start" onClick={() => setShowMetrics(true)}>
            <ChartColumn aria-hidden />
            {t("add_first_numbers")}
          </Button>
        )}
      </CaptureBody>
      <CaptureFooter status={valid ? <ShortcutHint /> : <span className="truncate max-sm:hidden">{firstError}</span>}>
        <Button type="button" variant="outline" onClick={onClose}>
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t("log_post")}
        </Button>
      </CaptureFooter>
    </form>
  )
}
