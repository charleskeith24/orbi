/**
 * First-run signals for a brand-new (empty) workspace, shared by Home, Calendar, Reports, Strategy and the
 * Strategist: has anything been published yet, when did the workspace start (posting slots before that
 * were never missed), and the first steps that turn it into a working system. Pure.
 */
import { isPublishedItem } from "@/lib/analytics"
import { parseDate, toISODate } from "@/lib/dates"
import type { ContentItem, Database, ISODate } from "@/lib/types"

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
  | { kind: "dialog"; dialog: "quick-capture" | "new-content" | "log-post" | "add-metrics" }

export interface FirstStep {
  key: "niche" | "pillars" | "idea" | "content" | "publish" | "analytics"
  label: string
  detail: string
  /** Short verb for the step's button. */
  cta: string
  done: boolean
  action: FirstStepAction
}

/** Strategy → Ideas → Create → Publish → Measure, each ticked off from the workspace itself. */
export function firstSteps(db: Database): FirstStep[] {
  const brand = db.brand_profiles[0]
  return [
    {
      key: "niche",
      label: "Set your niche",
      detail: "Brand HQ — every AI draft reads it.",
      cta: "Open Brand HQ",
      done: Boolean(brand?.niche.trim()),
      action: { kind: "link", href: "/strategy" },
    },
    {
      key: "pillars",
      label: "Add your Content Pillars",
      detail: "The 3–6 themes you want to be known for.",
      cta: "Set up pillars",
      done: db.content_pillars.some((p) => p.is_active),
      action: { kind: "link", href: "/pillars" },
    },
    {
      key: "idea",
      label: "Capture your first idea",
      detail: "Ideas feed What to post next.",
      cta: "Capture idea",
      done: db.content_ideas.length > 0,
      action: { kind: "dialog", dialog: "quick-capture" },
    },
    {
      key: "content",
      label: "Create your first piece of content",
      detail: "Brief, script and schedule it in the Studio.",
      cta: "New content",
      done: db.content_items.length > 0,
      action: { kind: "dialog", dialog: "new-content" },
    },
    {
      key: "publish",
      label: "Log your first post",
      detail: "Already posted somewhere? Log it here.",
      cta: "Log a post",
      done: hasPublishedContent(db.content_items),
      action: { kind: "dialog", dialog: "log-post" },
    },
    {
      key: "analytics",
      label: "Add analytics to a post",
      detail: "Unlocks winners, reports and your Content Health Score.",
      cta: "Add analytics",
      done: db.content_metrics.length > 0,
      action: { kind: "dialog", dialog: "add-metrics" },
    },
  ]
}
