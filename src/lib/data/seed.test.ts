import { describe, expect, it } from "vitest"
import { funnelMix, pillarMix } from "@/lib/analytics"
import {
  DEAL_SOURCE_IDS,
  DEAL_STATUS_IDS,
  HOOK_CATEGORIES,
  HOOK_CATEGORY_IDS,
  IDEA_SOURCES,
  INCOME_SOURCE_IDS,
  IDEA_STATUSES,
  PIPELINE_STAGES,
  PUBLISHED_STAGES,
  REPURPOSE_TYPES,
  SCRIPT_FORMATS,
} from "@/lib/constants"
import { TABLE_DEFAULTS, TABLE_NAMES } from "@/lib/data/defaults"
import { REFERENCES } from "@/lib/data/relations"
import { createDemoDatabase, createStarterDatabase } from "@/lib/data/seed"
import { isSameDay, toISODate } from "@/lib/dates"
import type { ContentExperiment, ContentMetric, Database, PlatformId, TableName } from "@/lib/types"

const USER = "00000000-0000-4000-8000-000000000001"
const NOW = new Date(2026, 8, 10, 14, 30)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const DAY = 86_400_000

type AnyRow = Record<string, unknown> & { id: string }
const rowsOf = (db: Database, table: TableName) => db[table] as unknown as AnyRow[]
const dayOf = (iso: string) => toISODate(new Date(iso))

function structuralProblems(db: Database): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const table of TABLE_NAMES) {
    if (!Array.isArray(db[table])) {
      problems.push(`${table}: missing table`)
      continue
    }
    const required = [...Object.keys(TABLE_DEFAULTS[table]), "id", "user_id", "created_at", "updated_at"]
    for (const row of rowsOf(db, table)) {
      for (const key of required) if (!(key in row)) problems.push(`${table}.${key} missing on ${row.id}`)
      if (!UUID.test(row.id)) problems.push(`${table}: malformed id ${row.id}`)
      if (seen.has(row.id)) problems.push(`${table}: duplicate id ${row.id}`)
      seen.add(row.id)
      if (row.user_id !== USER) problems.push(`${table}: wrong user_id on ${row.id}`)
      if ((row.updated_at as string) < (row.created_at as string)) problems.push(`${table}: ${row.id} updated before it was created`)
    }
  }
  return problems
}

function referenceProblems(db: Database): string[] {
  const ids = new Map(TABLE_NAMES.map((t) => [t, new Set(rowsOf(db, t).map((r) => r.id))]))
  const everything = new Set(TABLE_NAMES.flatMap((t) => [...ids.get(t)!]))
  const problems: string[] = []
  for (const [parent, refs] of Object.entries(REFERENCES) as [TableName, NonNullable<(typeof REFERENCES)[TableName]>][]) {
    const parentIds = ids.get(parent)!
    for (const ref of refs) {
      for (const row of rowsOf(db, ref.table)) {
        const value = row[ref.column]
        const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
        for (const v of values) {
          if (typeof v !== "string" || !parentIds.has(v)) problems.push(`${ref.table}.${ref.column} (${row.id}) → missing ${parent} ${String(v)}`)
        }
      }
    }
  }
  for (const link of db.content_tags) {
    if (!ids.get(link.entity_type)?.has(link.entity_id)) problems.push(`content_tags ${link.id} → missing ${link.entity_type} ${link.entity_id}`)
  }
  const links = db.content_tags.map((l) => `${l.tag_id}:${l.entity_type}:${l.entity_id}`)
  if (new Set(links).size !== links.length) problems.push("content_tags: duplicate links")
  for (const idea of db.content_ideas) {
    if (idea.source_ref_id && !everything.has(idea.source_ref_id)) problems.push(`content_ideas.source_ref_id (${idea.id}) → missing row`)
    if (idea.status === "converted" && !idea.converted_item_id) problems.push(`converted idea ${idea.id} has no converted_item_id`)
    if (idea.status !== "converted" && idea.converted_item_id) problems.push(`${idea.status} idea ${idea.id} points at a converted item`)
  }
  for (const item of db.content_items) {
    if (item.parent_id && !item.repurpose_type) problems.push(`item ${item.id} has parent_id but no repurpose_type`)
  }
  return problems
}

/** Series episodes land on the series weekday; campaign posts fall inside the campaign dates. */
function linkProblems(db: Database): string[] {
  const problems: string[] = []
  const series = new Map(db.content_series.map((s) => [s.id, s]))
  const campaigns = new Map(db.content_campaigns.map((c) => [c.id, c]))
  for (const item of db.content_items) {
    const at = item.published_at ?? item.scheduled_at
    if (!at) continue
    const s = item.series_id ? series.get(item.series_id) : undefined
    if (s && s.day_of_week !== null && new Date(at).getDay() !== s.day_of_week) problems.push(`${item.title} is off the ${s.name} weekday`)
    const c = item.campaign_id ? campaigns.get(item.campaign_id) : undefined
    if (c && (dayOf(at) < c.start_date || dayOf(at) > c.end_date)) problems.push(`${item.title} (${dayOf(at)}) is outside ${c.name}`)
  }
  return problems
}

function latestMetrics(db: Database): Map<string, ContentMetric> {
  const latest = new Map<string, ContentMetric>()
  for (const m of db.content_metrics) {
    const cur = latest.get(m.content_item_id)
    if (!cur || m.recorded_at > cur.recorded_at || (m.recorded_at === cur.recorded_at && m.updated_at > cur.updated_at)) {
      latest.set(m.content_item_id, m)
    }
  }
  return latest
}

/** Views ÷ mean views of the previous 20 measured posts on the same platform (≥ 3 in the window). */
function winnerRatios(db: Database): { ratio: number; platform: PlatformId }[] {
  const latest = latestMetrics(db)
  const published = db.content_items
    .filter((i) => PUBLISHED_STAGES.includes(i.stage) && i.published_at && latest.has(i.id))
    .sort(
      (a, b) =>
        Date.parse(a.published_at!) - Date.parse(b.published_at!) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id)
    )
  const history = new Map<string, number[]>()
  const ratios: { ratio: number; platform: PlatformId }[] = []
  for (const item of published) {
    const views = latest.get(item.id)!.views
    const list = history.get(item.platform) ?? []
    const window = list.slice(-20)
    if (window.length >= 3) ratios.push({ ratio: views / (window.reduce((a, b) => a + b, 0) / window.length), platform: item.platform })
    history.set(item.platform, [...list, views])
  }
  return ratios
}

function publishedInLast7Days(db: Database, now: Date): number {
  return db.content_items.filter((i) => {
    if (!PUBLISHED_STAGES.includes(i.stage) || !i.published_at) return false
    const t = Date.parse(i.published_at)
    return t <= now.getTime() && t > now.getTime() - 7 * DAY
  }).length
}

function bufferDays(db: Database, now: Date): number {
  const ready = db.content_items.filter(
    (i) => i.stage === "ready_to_post" || (i.stage === "scheduled" && (!i.scheduled_at || Date.parse(i.scheduled_at) > now.getTime()))
  ).length
  return ready / (db.app_settings[0].weekly_post_target / 7)
}

function demoSanity(db: Database, now: Date): string[] {
  const problems: string[] = []
  const today = toISODate(now)
  const unpublished = db.content_items.filter((i) => !PUBLISHED_STAGES.includes(i.stage))
  const stages = new Set(db.content_items.map((i) => i.stage))
  for (const s of PIPELINE_STAGES) if (!stages.has(s.id)) problems.push(`stage ${s.id} missing`)
  if (!unpublished.some((i) => i.due_date === today)) problems.push("nothing due today")
  const scheduledToday = unpublished.filter((i) => i.stage === "scheduled" && isSameDay(i.scheduled_at, now) && Date.parse(i.scheduled_at!) > now.getTime())
  if (!scheduledToday.length) problems.push("nothing scheduled later today")
  const overdue = unpublished.filter(
    (i) => (i.due_date && i.due_date < today) || (i.scheduled_at && Date.parse(i.scheduled_at) < now.getTime())
  )
  if (overdue.length < 2) problems.push(`only ${overdue.length} overdue`)
  const ideasToday = db.content_ideas.filter((i) => isSameDay(i.created_at, now)).length
  if (ideasToday < 3) problems.push(`only ${ideasToday} ideas created today`)
  const lastWeek = publishedInLast7Days(db, now)
  if (lastWeek < 7 || lastWeek > 12) problems.push(`${lastWeek} published in the last 7 days`)
  const ratios = winnerRatios(db)
  const winners = ratios.filter((r) => r.ratio >= 2)
  const breakouts = ratios.filter((r) => r.ratio >= 3)
  if (winners.length < 5) problems.push(`only ${winners.length} winners`)
  if (breakouts.length < 2) problems.push(`only ${breakouts.length} breakouts`)
  if (new Set(winners.map((w) => w.platform)).size < 3) problems.push("winners on fewer than 3 platforms")
  const buffer = bufferDays(db, now)
  if (buffer < 8 || buffer > 11.5) problems.push(`buffer ${buffer.toFixed(1)} days`)

  // Pillar and funnel mix exactly as the dashboards compute them: one deliberate warning (Business
  // slightly under its 5% target), every other pillar within tolerance, funnel on target.
  const settings = db.app_settings[0]
  const pillars = pillarMix(db, now, settings)
  const pillarWarnings = pillars.warnings.map((w) => `${w.label} ${w.direction}`).join(", ")
  if (pillarWarnings !== "Business under") problems.push(`pillar warnings: ${pillarWarnings || "none"}`)
  for (const row of pillars.rows) {
    if (row.label !== "Business" && Math.abs(row.deviation) > settings.pillar_tolerance) {
      problems.push(`${row.label} at ${row.actualPct}% vs ${row.targetPct}%`)
    }
  }
  const funnel = funnelMix(db, now, settings)
  if (funnel.warnings.length) problems.push(`funnel: ${funnel.warnings.map((w) => w.message).join("; ")}`)

  problems.push(...linkProblems(db))
  for (const row of TABLE_NAMES.flatMap((t) => rowsOf(db, t))) {
    if (Date.parse(row.created_at as string) > now.getTime()) problems.push(`${row.id} created in the future`)
  }
  for (const item of db.content_items) {
    if (item.published_at && Date.parse(item.published_at) > now.getTime()) problems.push(`${item.title} published in the future`)
  }
  return problems
}

function metricOf(m: ContentMetric, metric: ContentExperiment["metric"]): number {
  if (metric === "engagement_rate") return m.reach ? ((m.likes + m.comments + m.shares + m.saves) / m.reach) * 100 : 0
  if (metric === "engagements") return m.likes + m.comments + m.shares + m.saves
  const value = m[metric as keyof ContentMetric]
  if (typeof value !== "number") throw new Error(`no numeric ${metric} on metrics`)
  return value
}

describe("createStarterDatabase", () => {
  const db = createStarterDatabase(USER, NOW)

  it("has every table, complete rows and unique ids", () => {
    expect(structuralProblems(db)).toEqual([])
  })

  it("only references existing rows", () => {
    expect(referenceProblems(db)).toEqual([])
  })

  it("contains the library and no personal content", () => {
    expect(db.app_settings).toHaveLength(1)
    expect(db.app_settings[0].weekly_post_target).toBe(10)
    expect(db.brand_profiles).toHaveLength(1)
    expect(db.brand_profiles[0].onboarding_completed).toBe(false)
    expect(db.brand_profiles[0].name).toBe("")
    expect(db.content_formats).toHaveLength(15)
    expect(db.content_formats.find((f) => f.name === "Case Study")?.script_format).toBe("linkedin_post")
    expect(db.angles).toHaveLength(22)
    expect(db.angles.every((a) => a.is_default && a.example && a.description)).toBe(true)
    expect(db.content_goals.map((g) => g.category)).toEqual(["awareness", "authority", "community", "leads", "business"])
    expect(db.content_platforms).toHaveLength(7)
    expect(db.content_platforms.filter((p) => !p.is_active).map((p) => p.platform).sort()).toEqual(["threads", "x"])
    expect(db.content_calendar.map((s) => s.day_of_week).sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(db.content_calendar.every((s) => s.pillar_id === null)).toBe(true)
    expect(db.tags.map((t) => t.name)).toEqual(["marketing", "leadership", "ecommerce", "business", "ai", "story", "lesson", "founder", "team", "growth"])
    expect(db.content_items).toHaveLength(0)
    expect(db.content_ideas).toHaveLength(0)
    expect(db.content_pillars).toHaveLength(0)
    expect(db.audience_personas).toHaveLength(0)
    expect(db.stories).toHaveLength(0)
    expect([db.brand_deals, db.income_entries, db.rate_cards].map((t) => t.length)).toEqual([0, 0, 0])
  })

  it("starts new creators in Simple mode, in English, earning in pesos", () => {
    expect(db.app_settings[0]).toMatchObject({ simple_mode: true, ui_language: "en", currency: "PHP" })
    expect(db.app_settings[0]).toMatchObject({ reminders_daily_enabled: false, reminders_slot_enabled: false, reminders_review_enabled: false })
  })

  it("ships a Hook Library of fill-in templates in every category", () => {
    expect(db.hooks.length).toBeGreaterThanOrEqual(40)
    expect(db.hooks.every((h) => h.is_template && h.source === "library" && !h.is_favorite && h.pillar_id === null)).toBe(true)
    const categories = HOOK_CATEGORY_IDS.filter((c) => c !== "custom")
    for (const category of categories) {
      const inCategory = db.hooks.filter((h) => h.category === category)
      expect(inCategory.length, category).toBeGreaterThanOrEqual(4)
      expect(inCategory[0].text, category).toBe(HOOK_CATEGORIES[category].example)
    }
    expect(db.hooks.filter((h) => !h.text.includes("___")).length).toBeLessThanOrEqual(2)
    expect(new Set(db.hooks.map((h) => h.text)).size).toBe(db.hooks.length)
  })

  it("is deterministic for a fixed date", () => {
    expect(JSON.stringify(createStarterDatabase(USER, new Date(NOW)))).toBe(JSON.stringify(db))
  })
})

describe("createDemoDatabase", () => {
  const db = createDemoDatabase(USER, NOW)
  const items = new Map(db.content_items.map((i) => [i.id, i]))

  it("has every table, complete rows and unique ids", () => {
    expect(structuralProblems(db)).toEqual([])
  })

  it("only references existing rows (FKs, id arrays, tag links, converted items)", () => {
    expect(referenceProblems(db)).toEqual([])
  })

  it("is deterministic for a fixed date", () => {
    expect(JSON.stringify(createDemoDatabase(USER, new Date(NOW)))).toBe(JSON.stringify(db))
  })

  it("makes every dashboard meaningful", () => {
    expect(demoSanity(db, NOW)).toEqual([])
  })

  it("stays meaningful on any day and time of the week", () => {
    const problems: string[] = []
    for (let d = 0; d < 7; d++) {
      for (const [h, m] of [
        [0, 10],
        [8, 5],
        [21, 20],
        [23, 58],
      ]) {
        const now = new Date(2026, 8, 10 + d, h, m)
        const found = demoSanity(createDemoDatabase(USER, now), now)
        problems.push(...found.map((p) => `${now.toString().slice(0, 21)}: ${p}`))
      }
    }
    expect(problems).toEqual([])
  })

  it("has a complete, realistic brand", () => {
    const brand = db.brand_profiles[0]
    expect(brand.onboarding_completed).toBe(true)
    expect(brand.language).toBe("taglish")
    expect(brand.primary_goal_id).toBe(db.content_goals.find((g) => g.category === "authority")!.id)
    expect(brand.secondary_goal_id).toBe(db.content_goals.find((g) => g.category === "leads")!.id)
    for (const [key, value] of Object.entries(brand)) {
      if (typeof value === "string" || Array.isArray(value)) expect(value.length, key).toBeGreaterThan(0)
    }
    expect(db.content_pillars.map((p) => p.target_percentage)).toEqual([30, 20, 20, 15, 10, 5])
    expect(db.content_calendar.every((s) => s.pillar_id !== null)).toBe(true)
    expect(db.audience_personas).toHaveLength(3)
    expect(db.audience_personas.filter((p) => p.is_primary)).toHaveLength(1)
    expect(db.app_settings[0].default_owner).toBe("Raf")
  })

  it("keeps every module visible, in English, earning in pesos", () => {
    expect(db.app_settings[0]).toMatchObject({ simple_mode: false, ui_language: "en", currency: "PHP" })
  })

  it("has brand deals in every status and source, linked to real content", () => {
    expect(new Set(db.brand_deals.map((d) => d.status))).toEqual(new Set(DEAL_STATUS_IDS))
    expect(new Set(db.brand_deals.map((d) => d.source))).toEqual(new Set(DEAL_SOURCE_IDS))
    // One foreign-currency deal keeps Money honest about mixed currencies.
    expect(db.brand_deals.some((d) => d.currency !== "PHP")).toBe(true)
    for (const deal of db.brand_deals) {
      expect(deal.paid_at !== null, `${deal.brand_name} paid_at`).toBe(deal.status === "paid")
      if (deal.show_in_media_kit) expect(["paid", "delivered"], deal.brand_name).toContain(deal.status)
      if (["paid", "delivered", "in_progress"].includes(deal.status)) expect(deal.content_item_ids.length, deal.brand_name).toBeGreaterThan(0)
      for (const id of deal.content_item_ids) expect(deal.platforms, deal.brand_name).toContain(items.get(id)!.platform)
      if (deal.start_date && deal.due_date) expect(deal.start_date <= deal.due_date, deal.brand_name).toBe(true)
    }
    expect(db.brand_deals.filter((d) => d.show_in_media_kit).length).toBeGreaterThanOrEqual(3)
  })

  it("records ~6 months of income across every source, and every paid deal's payment", () => {
    const entries = db.income_entries
    expect(new Set(entries.map((e) => e.source))).toEqual(new Set(INCOME_SOURCE_IDS))
    expect(new Set(entries.map((e) => e.status))).toEqual(new Set(["received", "expected"]))
    expect(new Set(entries.map((e) => e.date.slice(0, 7))).size).toBeGreaterThanOrEqual(6)
    const programs = new Set(entries.filter((e) => e.source === "affiliate").map((e) => e.affiliate_program))
    for (const program of ["TikTok Shop", "Shopee"]) expect(programs).toContain(program)
    for (const e of entries) {
      expect(e.affiliate_program !== "", e.description).toBe(e.source === "affiliate")
      expect(e.amount, e.description).toBeGreaterThan(0)
      if (e.source === "platform_payout" || e.source === "tip") expect(e.platform, e.description).not.toBeNull()
      if (e.status === "received") expect(e.date <= toISODate(NOW), e.description).toBe(true)
    }
    for (const deal of db.brand_deals.filter((d) => d.status === "paid")) {
      const paid = entries.filter((e) => e.brand_deal_id === deal.id && e.status === "received")
      expect(paid.reduce((sum, e) => sum + e.amount, 0), deal.brand_name).toBe(deal.fee)
      expect(paid.map((e) => e.date), deal.brand_name).toContain(deal.paid_at)
    }
    expect(entries.some((e) => e.content_item_id !== null)).toBe(true)
  })

  it("has rate cards for the media kit, including a quote-only package", () => {
    const active = db.rate_cards.filter((r) => r.is_active)
    expect(active.length).toBeGreaterThanOrEqual(4)
    expect(active.some((r) => r.price === null)).toBe(true)
    expect(active.some((r) => r.platform === null)).toBe(true)
    expect(new Set(db.rate_cards.map((r) => r.sort_order)).size).toBe(db.rate_cards.length)
    expect(db.rate_cards.every((r) => r.deliverables.length > 0 && r.name && r.description)).toBe(true)
  })

  it("covers every idea status and source, with scored ideas", () => {
    expect(new Set(db.content_ideas.map((i) => i.status))).toEqual(new Set(IDEA_STATUSES.map((s) => s.id)))
    expect(new Set(db.content_ideas.map((i) => i.source))).toEqual(new Set(IDEA_SOURCES.map((s) => s.id)))
    expect(db.content_ideas.length).toBeGreaterThanOrEqual(80)
    expect(db.content_ideas.filter((i) => i.score !== null).length).toBeGreaterThan(40)
    for (const idea of db.content_ideas.filter((i) => i.status === "converted")) {
      const item = items.get(idea.converted_item_id!)
      expect(item?.idea_id).toBe(idea.id)
      expect(Date.parse(idea.created_at)).toBeLessThanOrEqual(Date.parse(item!.created_at))
      expect(idea.platforms).toContain(item!.platform)
    }
  })

  it("keeps the Question Bank in sync with ideas and content", () => {
    const ideas = new Map(db.content_ideas.map((i) => [i.id, i]))
    for (const q of db.audience_questions) {
      if (q.status === "idea_created") expect(ideas.get(q.idea_id!)?.source_ref_id, q.question).toBe(q.id)
      if (q.status === "answered") expect(items.has(q.content_item_id!), q.question).toBe(true)
      if (q.status === "new") expect([q.idea_id, q.content_item_id], q.question).toEqual([null, null])
    }
    for (const idea of db.content_ideas.filter((i) => i.source === "question_bank" && i.source_ref_id)) {
      const q = db.audience_questions.find((row) => row.id === idea.source_ref_id)
      expect(q, idea.title).toBeDefined()
      if (q!.status === "answered") expect(q!.content_item_id, idea.title).toBe(idea.converted_item_id)
      else expect([q!.status, q!.idea_id], idea.title).toEqual(["idea_created", idea.id])
    }
    expect(db.audience_questions.filter((q) => q.status === "new").length).toBeGreaterThanOrEqual(3)
  })

  it("links repurposed items, suggestions and their sources", () => {
    for (const r of db.content_repurposing) {
      const source = items.get(r.source_item_id)!
      expect(PUBLISHED_STAGES, r.title).toContain(source.stage)
      const platform = REPURPOSE_TYPES[r.type].platform
      if (platform) expect(r.platform, r.title).toBe(platform)
      if (r.status === "created") {
        const target = items.get(r.target_item_id!)!
        expect([target.parent_id, target.repurpose_type, target.platform], r.title).toEqual([r.source_item_id, r.type, r.platform])
      } else {
        expect(r.target_item_id).toBeNull()
      }
    }
    for (const child of db.content_items.filter((i) => i.parent_id)) {
      const parent = items.get(child.parent_id!)!
      expect(db.content_repurposing.some((r) => r.target_item_id === child.id && r.source_item_id === parent.id), child.title).toBe(true)
      // Nobody repurposes a post before it has gone live.
      expect(Date.parse(child.created_at), child.title).toBeGreaterThan(Date.parse(parent.published_at!))
    }
    expect(db.content_repurposing.filter((r) => r.status === "created").length).toBeGreaterThanOrEqual(8)
    expect(db.content_repurposing.some((r) => r.status === "suggested")).toBe(true)
  })

  it("backs experiments with in-window posts, and completed results agree with the data", () => {
    const latest = latestMetrics(db)
    for (const e of db.content_experiments) {
      const ids = [...e.variant_a_item_ids, ...e.variant_b_item_ids]
      if (e.status === "planned") {
        expect(ids, e.name).toEqual([])
        continue
      }
      for (const id of ids) {
        const item = items.get(id)!
        if (!item.published_at) {
          expect(e.status, `${e.name}: ${item.title} unpublished`).toBe("running")
          continue
        }
        const day = dayOf(item.published_at)
        expect(day >= e.start_date! && day <= e.end_date!, `${e.name}: ${item.title} on ${day}`).toBe(true)
      }
      if (e.status !== "completed") continue
      const mean = (list: string[]) => list.reduce((acc, id) => acc + metricOf(latest.get(id)!, e.metric), 0) / list.length
      const [a, b] = [mean(e.variant_a_item_ids), mean(e.variant_b_item_ids)]
      expect(e.winner === "a" ? a > b : b > a, `${e.name}: A ${a.toFixed(1)} vs B ${b.toFixed(1)}`).toBe(true)
    }
  })

  it("has one brief per item, one current script in the item's format, and plausible metrics", () => {
    expect(db.content_items.length).toBeGreaterThanOrEqual(140)
    expect(new Set(db.content_briefs.map((b) => b.content_item_id)).size).toBe(db.content_items.length)
    expect(db.content_briefs).toHaveLength(db.content_items.length)
    // Default brief copy varies; no objective is pasted onto a large share of items.
    const objectiveCounts = new Map<string, number>()
    for (const b of db.content_briefs) objectiveCounts.set(b.objective, (objectiveCounts.get(b.objective) ?? 0) + 1)
    expect(Math.max(...objectiveCounts.values())).toBeLessThanOrEqual(Math.ceil(db.content_briefs.length * 0.12))

    const formats = new Map(db.content_formats.map((f) => [f.id, f]))
    const current = new Map<string, number>()
    for (const s of db.content_scripts) {
      const item = items.get(s.content_item_id)!
      expect(s.format, item.title).toBe(formats.get(item.format_id!)!.script_format)
      expect(s.sections.map((x) => x.key), item.title).toEqual(SCRIPT_FORMATS[s.format].sections.map((x) => x.key))
      if (s.is_current) current.set(s.content_item_id, (current.get(s.content_item_id) ?? 0) + 1)
    }
    expect(current.size).toBeGreaterThanOrEqual(40)
    expect([...current.values()].every((n) => n === 1)).toBe(true)

    const published = db.content_items.filter((i) => PUBLISHED_STAGES.includes(i.stage))
    const measured = new Set(db.content_metrics.map((m) => m.content_item_id))
    expect(published.every((i) => measured.has(i.id))).toBe(true)
    const today = toISODate(NOW)
    for (const m of db.content_metrics) {
      const item = items.get(m.content_item_id)!
      expect(m.platform).toBe(item.platform)
      expect(m.recorded_at >= dayOf(item.published_at!) && m.recorded_at <= today, item.title).toBe(true)
      expect(m.reach).toBeLessThanOrEqual(m.views)
      for (const [key, value] of Object.entries(m)) {
        if (typeof value === "number") expect(Number.isInteger(value), key).toBe(true)
      }
    }
    for (const item of db.content_items) {
      const at = item.published_at ?? item.scheduled_at
      if (at) expect(Date.parse(item.created_at), item.title).toBeLessThanOrEqual(Date.parse(at))
    }
  })

  it("is fast and small enough for localStorage", () => {
    createDemoDatabase(USER, NOW)
    const start = performance.now()
    const fresh = createDemoDatabase(USER, NOW)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(300)
    expect(JSON.stringify(fresh).length).toBeLessThan(1.5 * 1024 * 1024)
  })
})
