/**
 * First-run signals for a brand-new (empty) workspace, shared by Home, Calendar, Reports, Strategy and the
 * Strategist: has anything been published yet, when did the workspace start (posting slots before that
 * were never missed), and the first steps that turn it into a working system. Pure.
 */
import { isPublishedItem } from "@/lib/analytics"
import { parseDate, toISODate } from "@/lib/dates"
import { translator, type UiLang } from "@/lib/i18n/core"
import type { BrandProfile, ContentIdea, ContentItem, Database, ID, ISODate } from "@/lib/types"
import { firstStepMessages } from "./messages"

export function hasPublishedContent(items: readonly Pick<ContentItem, "stage">[]): boolean {
  return items.some(isPublishedItem)
}

type StartInput = Pick<Database, "app_settings" | "brand_profiles" | "content_items" | "content_ideas">

/** The first calendar day this workspace existed: its earliest settings, brand, idea or content date. */
export function workspaceStartKey(db: StartInput): ISODate | null {
  let min = Number.POSITIVE_INFINITY
  const consider = (value: string | null | undefined) => {
    const time = parseDate(value)?.getTime()
    if (time !== undefined && time < min) min = time
  }
  consider(db.app_settings[0]?.created_at)
  consider(db.brand_profiles[0]?.created_at)
  for (const item of db.content_items) {
    consider(item.created_at)
    consider(item.published_at)
    consider(item.scheduled_at)
    consider(item.due_date)
  }
  for (const idea of db.content_ideas) consider(idea.created_at)
  return Number.isFinite(min) ? toISODate(new Date(min)) : null
}

export type FirstStepAction =
  | { kind: "link"; href: string }
  /** `itemId` pre-selects the post in Add analytics. */
  | { kind: "dialog"; dialog: "quick-capture" | "new-content" | "log-post" | "add-metrics"; itemId?: ID }

/** Brand HQ has a voice once it has at least one tone or personality trait. */
export function hasVoice(brand: Pick<BrandProfile, "tones" | "personality_traits"> | null | undefined): boolean {
  return Boolean(brand && (brand.tones.length > 0 || brand.personality_traits.length > 0))
}

/** Ideas the creator added: everything except the starter ideas setup generates (`source: "onboarding"`). */
export function ownIdeas<T extends Pick<ContentIdea, "source">>(ideas: readonly T[]): T[] {
  return ideas.filter((idea) => idea.source !== "onboarding")
}

export interface FirstStep {
  key: "niche" | "pillars" | "voice" | "problems" | "idea" | "content" | "publish" | "analytics"
  label: string
  detail: string
  /** Short verb for the step's button. */
  cta: string
  done: boolean
  action: FirstStepAction
}

/**
 * Strategy → Ideas → Create → Publish → Measure, each ticked off from the workspace itself. Text in `lang`
 * (default English). Quick setup fills in everything it can; the strategy steps it can't decide for the
 * creator — their voice and their audience's problems — wait here.
 */
export function firstSteps(db: Database, lang: UiLang = "en"): FirstStep[] {
  const brand = db.brand_profiles[0]
  const t = translator(firstStepMessages, lang)
  return [
    {
      key: "niche",
      label: t("niche_label"),
      detail: t("niche_detail"),
      cta: t("niche_cta"),
      done: Boolean(brand?.niche.trim()),
      action: { kind: "link", href: "/strategy" },
    },
    {
      key: "pillars",
      label: t("pillars_label"),
      detail: t("pillars_detail"),
      cta: t("pillars_cta"),
      done: db.content_pillars.some((p) => p.is_active),
      action: { kind: "link", href: "/pillars" },
    },
    {
      key: "voice",
      label: t("voice_label"),
      detail: t("voice_detail"),
      cta: t("voice_cta"),
      done: hasVoice(brand),
      action: { kind: "link", href: "/strategy#personality" },
    },
    {
      key: "problems",
      label: t("problems_label"),
      detail: t("problems_detail"),
      cta: t("problems_cta"),
      done: db.audience_problems.length > 0,
      action: { kind: "link", href: "/audience/problems" },
    },
    {
      key: "idea",
      label: t("idea_label"),
      detail: t("idea_detail"),
      cta: t("idea_cta"),
      done: db.content_ideas.length > 0,
      action: { kind: "dialog", dialog: "quick-capture" },
    },
    {
      key: "content",
      label: t("content_label"),
      detail: t("content_detail"),
      cta: t("content_cta"),
      done: db.content_items.length > 0,
      action: { kind: "dialog", dialog: "new-content" },
    },
    {
      key: "publish",
      label: t("publish_label"),
      detail: t("publish_detail"),
      cta: t("publish_cta"),
      done: hasPublishedContent(db.content_items),
      action: { kind: "dialog", dialog: "log-post" },
    },
    {
      key: "analytics",
      label: t("analytics_label"),
      detail: t("analytics_detail"),
      cta: t("analytics_cta"),
      done: db.content_metrics.length > 0,
      action: { kind: "dialog", dialog: "add-metrics" },
    },
  ]
}
