/**
 * Builds the Starter Kit rows. Ids are named (`format:<name>`, `angle:<name>`,
 * `hook:<category>:<n>`, `goal:<category>`, `tag:<name>`, `platform:<id>`,
 * `slot:<day>`) so the demo workspace can reference them.
 */
import { GOAL_CATEGORIES, GOAL_CATEGORY_IDS, PLATFORM_IDS } from "@/lib/constants"
import { emptyDatabase } from "@/lib/data/defaults"
import type { Database, HookCategory } from "@/lib/types"
import type { SeedContext } from "./context"
import {
  ANGLE_NAMES,
  ANGLES,
  FORMAT_NAMES,
  FORMATS,
  GOALS,
  HOOK_TEMPLATES,
  PLATFORM_STRATEGIES,
  POSTING_SLOTS,
  TAG_COLORS,
  TAG_NAMES,
  type AngleName,
  type FormatName,
  type TagName,
} from "./starter-data"

export const formatKey = (name: FormatName) => `format:${name}`
export const angleKey = (name: AngleName) => `angle:${name}`
export const hookTemplateKey = (category: HookCategory, index: number) => `hook:${category}:${index}`
export const tagKey = (name: TagName) => `tag:${name}`

export function buildStarterKit(ctx: SeedContext, createdAt: Date): Database {
  const db = emptyDatabase()
  const build = ctx.build

  // New creators start in Simple mode, in English, earning in pesos (all switchable in Settings → General).
  db.app_settings = [
    build(
      "app_settings",
      { id: ctx.id("settings"), weekly_post_target: 10, simple_mode: true, ui_language: "en", currency: "PHP" },
      createdAt
    ),
  ]
  db.brand_profiles = [build("brand_profiles", { id: ctx.id("brand"), onboarding_completed: false }, createdAt)]

  db.content_goals = GOAL_CATEGORY_IDS.map((category) => {
    const goal = GOALS[category]
    return build(
      "content_goals",
      {
        id: ctx.id(`goal:${category}`),
        category,
        name: goal.name,
        description: goal.description,
        kpis: [...GOAL_CATEGORIES[category].kpis],
        target_metric: goal.metric,
        target_value: goal.target,
        period: "monthly",
        is_active: true,
      },
      createdAt
    )
  })

  db.content_formats = FORMAT_NAMES.map((name, i) =>
    build(
      "content_formats",
      {
        id: ctx.id(formatKey(name)),
        name,
        category: FORMATS[name].category,
        description: FORMATS[name].description,
        script_format: FORMATS[name].script,
        is_default: true,
        sort_order: i,
      },
      createdAt
    )
  )

  db.angles = ANGLE_NAMES.map((name) =>
    build(
      "angles",
      { id: ctx.id(angleKey(name)), name, description: ANGLES[name].description, example: ANGLES[name].example, is_default: true },
      createdAt
    )
  )

  db.hooks = (Object.keys(HOOK_TEMPLATES) as (keyof typeof HOOK_TEMPLATES)[]).flatMap((category) =>
    HOOK_TEMPLATES[category].map((text, i) =>
      build(
        "hooks",
        { id: ctx.id(hookTemplateKey(category, i)), text, category, is_template: true, source: "library" },
        createdAt
      )
    )
  )

  db.content_platforms = PLATFORM_IDS.map((platform) => {
    const s = PLATFORM_STRATEGIES[platform]
    return build(
      "content_platforms",
      {
        id: ctx.id(`platform:${platform}`),
        platform,
        is_active: s.active,
        primary_goal_id: ctx.id(`goal:${s.goal}`),
        posting_frequency: s.frequency,
        preferred_format_ids: s.formats.map((f) => ctx.id(formatKey(f))),
        audience: s.audience,
        cta_style: s.cta,
        notes: s.notes,
      },
      createdAt
    )
  })

  db.content_calendar = POSTING_SLOTS.map((slot, i) =>
    build(
      "content_calendar",
      {
        id: ctx.id(`slot:${slot.day}`),
        day_of_week: slot.day,
        label: slot.label,
        pillar_id: null,
        format_id: ctx.id(formatKey(slot.format)),
        platforms: [...slot.platforms],
        time: slot.time,
        sort_order: i,
        is_active: true,
      },
      createdAt
    )
  )

  db.tags = TAG_NAMES.map((name) => build("tags", { id: ctx.id(tagKey(name)), name, color: TAG_COLORS[name] }, createdAt))

  return db
}
