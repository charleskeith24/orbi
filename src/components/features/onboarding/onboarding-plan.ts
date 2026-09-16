/**
 * Finish setup as data: every row the wizard writes, planned against the current workspace without
 * touching the store. `apply-onboarding.ts` executes a plan through the store; tests assert on it.
 *
 * Re-running setup updates instead of duplicating: goals match by name, then category; pillars and the
 * primary persona by name; problems by text; platform strategies by platform; posting slots by day;
 * ideas by title. Pillars and slots left out of the new answers are deactivated — never deleted.
 * `planNicheUpdate` writes only what Niche Discovery owns (niche, positioning, goals, persona, story and,
 * when the creator confirms it, pillars).
 */
import { CATEGORICAL_COLORS, GOAL_CATEGORIES, PLATFORM_IDS } from "@/lib/constants"
import { createStarterDatabase } from "@/lib/data/starter"
import { GOALS } from "@/lib/data/seed/starter-data"
import type { UiLang } from "@/lib/i18n/core"
import type { BrandLanguage, Database, GoalCategory, ID, InsertRow, Row, TableName, UpdateRow } from "@/lib/types"
import { uid } from "@/lib/utils"
import type { OnboardingLang } from "./copy"
import { goalForIdea, matchProblem, type IdeaDraft } from "./onboarding-ideas"
import {
  chosenGoals,
  finalSchedule,
  goalTargetFor,
  norm,
  personaNameOf,
  pillarColors,
  pillarForLabel,
  platformSplit,
  platformsInOrder,
  problemCategoryFor,
  selectedPillars,
  weekOrder,
  weeklyTotal,
  type OnboardingAnswers,
} from "./onboarding-model"

export type PlanInserts = { [T in TableName]?: InsertRow<T>[] }
export type PlanUpdates = { [T in TableName]?: { id: ID; patch: UpdateRow<T> }[] }

export interface PlanSummary {
  /** Starter Kit library rows added because the workspace was missing them. */
  libraryRows: number
  pillars: number
  pillarsArchived: number
  personaName: string
  problems: number
  goals: number
  platforms: number
  slots: number
  weeklyTarget: number
  ideas: number
  /** Selected ideas skipped because an idea with the same title already exists. */
  ideasSkipped: number
  story: boolean
  niche: string
}

export interface OnboardingPlan {
  inserts: PlanInserts
  updates: PlanUpdates
  settings: UpdateRow<"app_settings">
  brand: UpdateRow<"brand_profiles">
  summary: PlanSummary
}

export interface PlannedIdea {
  idea: IdeaDraft
  /** Final (possibly edited) title. */
  title: string
  /** Name of the selected pillar the idea belongs to, or null. */
  pillar: string | null
}

export interface OnboardingInput {
  answers: OnboardingAnswers
  /** The ideas the creator kept, in order. */
  ideas: PlannedIdea[]
  /**
   * The onboarding UI language; finishing setup makes it the app language (`app_settings.ui_language`).
   * Without it, the brand's writing language decides (the wizard pre-selects that from the UI language).
   */
  lang?: OnboardingLang
  now?: Date
  newId?: () => ID
}

export interface NicheUpdateInput {
  answers: OnboardingAnswers
  /** The creator confirmed replacing the active pillars with the niche's selection. */
  replacePillars: boolean
  now?: Date
  newId?: () => ID
}

/* --------------------------------- Builder -------------------------------- */

type LooseRow = Record<string, unknown> & { id?: ID }

function createBuilder() {
  const inserts: Partial<Record<TableName, LooseRow[]>> = {}
  const updates: Partial<Record<TableName, { id: ID; patch: Record<string, unknown> }[]>> = {}
  return {
    inserts,
    updates,
    insert<T extends TableName>(table: T, row: InsertRow<T>) {
      const list: LooseRow[] = inserts[table] ?? []
      inserts[table] = list
      list.push(row as LooseRow)
    },
    /** Patch a workspace row, or fold the patch into a row this plan inserts. */
    patch<T extends TableName>(table: T, id: ID, patch: UpdateRow<T>) {
      if (!Object.keys(patch).length) return
      const pending = inserts[table]?.find((r) => r.id === id)
      if (pending) {
        Object.assign(pending, patch)
        return
      }
      const list: { id: ID; patch: Record<string, unknown> }[] = updates[table] ?? []
      updates[table] = list
      const existing = list.find((u) => u.id === id)
      if (existing) Object.assign(existing.patch, patch)
      else list.push({ id, patch: { ...(patch as Record<string, unknown>) } })
    },
    /** Workspace rows plus the rows this plan inserts (for lookups). */
    rows<T extends TableName>(db: Database, table: T): Row<T>[] {
      return [...(db[table] as Row<T>[]), ...((inserts[table] ?? []) as unknown as Row<T>[])]
    },
  }
}

type Builder = ReturnType<typeof createBuilder>

function stripMeta<T extends TableName>(row: Row<T>): LooseRow {
  const copy: LooseRow = { ...(row as unknown as LooseRow) }
  delete copy.user_id
  delete copy.created_at
  delete copy.updated_at
  return copy
}

/** Trimmed, non-empty, unique (case-insensitive) strings in their original order. */
export function cleanList(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const v = value.trim()
    if (!v || seen.has(norm(v))) continue
    seen.add(norm(v))
    out.push(v)
  }
  return out
}

/* ------------------------------ Starter library --------------------------- */

type LibraryTable = "content_goals" | "content_formats" | "angles" | "hooks" | "tags" | "content_platforms"

/** Parents first: platform strategies point at goals and formats. */
const LIBRARY_TABLES: { table: LibraryTable; key: (row: LooseRow) => string }[] = [
  { table: "content_goals", key: (r) => String(r.category ?? "") },
  { table: "content_formats", key: (r) => norm(String(r.name ?? "")) },
  { table: "angles", key: (r) => norm(String(r.name ?? "")) },
  { table: "hooks", key: (r) => norm(String(r.text ?? "")) },
  { table: "tags", key: (r) => norm(String(r.name ?? "")) },
  { table: "content_platforms", key: (r) => String(r.platform ?? "") },
]

function planLibrary(db: Database, b: Builder, now: Date, newId: () => ID): number {
  const starter = createStarterDatabase(db.brand_profiles[0]?.user_id || "onboarding", now)
  // Starter ids are deterministic per user and day — fresh ids avoid colliding with renamed rows.
  const idMap = new Map<ID, ID>()
  let added = 0
  for (const { table, key } of LIBRARY_TABLES) {
    const have = new Map<string, ID>()
    for (const row of db[table] as unknown as LooseRow[]) {
      const k = key(row)
      if (k && row.id && !have.has(k)) have.set(k, row.id)
    }
    for (const row of starter[table] as Row<LibraryTable>[]) {
      const values = stripMeta(row)
      const k = key(values)
      const existing = have.get(k)
      if (existing) {
        idMap.set(row.id, existing)
        continue
      }
      const id = newId()
      idMap.set(row.id, id)
      have.set(k, id)
      values.id = id
      if (table === "content_platforms") {
        const goalId = values.primary_goal_id as ID | null
        values.primary_goal_id = goalId ? (idMap.get(goalId) ?? null) : null
        values.preferred_format_ids = ((values.preferred_format_ids as ID[] | undefined) ?? [])
          .map((f) => idMap.get(f))
          .filter((f): f is ID => Boolean(f))
        values.preferred_pillar_ids = []
      }
      b.insert(table, values as InsertRow<LibraryTable>)
      added++
    }
  }
  return added
}

/** Starter Kit library rows (formats, angles, hook templates, goals, platform strategies, tags) the workspace lacks. */
export function planStarterLibrary(db: Database, options: { now?: Date; newId?: () => ID } = {}): { inserts: PlanInserts; count: number } {
  const b = createBuilder()
  const count = planLibrary(db, b, options.now ?? new Date(), options.newId ?? uid)
  return { inserts: b.inserts as PlanInserts, count }
}

/* --------------------------------- Helpers -------------------------------- */

/** The app language after setup: the onboarding UI language, else the brand's writing language (Tagalog → Taglish). */
export function appLanguage(lang: OnboardingLang | undefined, brandLanguage: BrandLanguage): UiLang {
  const chosen = lang ?? (brandLanguage === "english" ? "english" : "taglish")
  return chosen === "english" ? "en" : "tl"
}

/** "In 2022 we almost closed our café because sales dropped." → "In 2022 we almost closed our café". */
export function storyTitle(story: string): string {
  const first = story.trim().split(/(?<=[.!?])\s+/)[0] ?? story
  const clause = first.split(/\s(?:because|when|after|since|so that)\s/i)[0]
  const words = clause.replace(/[.!?,;:…]+$/, "").split(/\s+/).filter(Boolean)
  return words.length > 12 ? `${words.slice(0, 12).join(" ")}…` : words.join(" ")
}

/** A plain, factual "Who am I" line from the identity answers (used only when Brand HQ has none). */
export function whoAmI(a: OnboardingAnswers): string {
  const name = a.name.trim()
  const role = a.role.trim()
  const brandName = a.brand_name.trim()
  const industry = a.industry.trim()
  const location = a.location.trim()
  const at = brandName && norm(brandName) !== norm(name) && !norm(role).includes(norm(brandName)) ? ` at ${brandName}` : ""
  const first = `I'm ${name}${role ? ` — ${role}${at}` : at}.`
  const years = a.years_experience !== null && a.years_experience > 0 ? `${Math.round(a.years_experience)} years in ${industry}` : industry ? `I work in ${industry}` : ""
  const second = years ? `${years}${location ? `, based in ${location}` : ""}.` : location ? `Based in ${location}.` : ""
  return [first, second].filter(Boolean).join(" ")
}

/* ------------------------------ Plan sections ----------------------------- */

function planGoals(b: Builder, db: Database, a: OnboardingAnswers, newId: () => ID): Partial<Record<GoalCategory, ID>> {
  const goalIds: Partial<Record<GoalCategory, ID>> = {}
  for (const category of chosenGoals(a)) {
    const target = goalTargetFor(a, category)
    const values: UpdateRow<"content_goals"> = {
      target_metric: GOAL_CATEGORIES[category].metric,
      target_value: target.value === null ? null : Math.max(1, Math.round(target.value)),
      period: target.period,
      is_active: true,
    }
    const rows = b.rows(db, "content_goals")
    const match =
      rows.find((g) => norm(g.name) === norm(GOALS[category].name)) ??
      rows.filter((g) => g.category === category).sort((x, y) => Number(y.is_active) - Number(x.is_active))[0]
    if (match) {
      b.patch("content_goals", match.id, values)
      goalIds[category] = match.id
    } else {
      const id = newId()
      b.insert("content_goals", {
        id,
        category,
        name: GOALS[category].name,
        description: GOALS[category].description,
        kpis: [...GOAL_CATEGORIES[category].kpis],
        ...values,
      })
      goalIds[category] = id
    }
  }
  return goalIds
}

interface PillarPlan {
  idFor: (name: string | null) => ID | null
  names: string[]
  count: number
  archived: number
}

function planPillars(b: Builder, db: Database, a: OnboardingAnswers, newId: () => ID): PillarPlan {
  const selected = selectedPillars(a)
  const colors = pillarColors(a.pillars, db.content_pillars)
  const ids = new Map<string, ID>()
  selected.forEach((p, index) => {
    const name = p.name.trim()
    const values: UpdateRow<"content_pillars"> = {
      description: p.description.trim(),
      target_percentage: Math.round(p.target),
      examples: cleanList(p.examples),
      sort_order: index,
      is_active: true,
    }
    const match = db.content_pillars.find((row) => norm(row.name) === norm(name))
    if (match) {
      b.patch("content_pillars", match.id, values)
      ids.set(norm(name), match.id)
    } else {
      const id = newId()
      b.insert("content_pillars", { id, name, color: colors.get(p.key) ?? CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length], icon: p.icon || "Layers", ...values })
      ids.set(norm(name), id)
    }
  })
  const keep = new Set(selected.map((p) => norm(p.name)))
  let archived = 0
  for (const row of db.content_pillars) {
    if (row.is_active && !keep.has(norm(row.name))) {
      b.patch("content_pillars", row.id, { is_active: false })
      archived++
    }
  }
  return { idFor: (name) => (name ? (ids.get(norm(name)) ?? null) : null), names: selected.map((p) => p.name.trim()), count: selected.length, archived }
}

/** The workspace's active pillars, untouched (Niche Discovery without replacing pillars). */
function currentPillars(db: Database): PillarPlan {
  const active = db.content_pillars.filter((p) => p.is_active)
  const ids = new Map(active.map((p) => [norm(p.name), p.id]))
  return { idFor: (name) => (name ? (ids.get(norm(name)) ?? null) : null), names: active.map((p) => p.name), count: 0, archived: 0 }
}

interface PersonaPlan {
  id: ID
  name: string
  problems: string[]
  problemIds: ID[]
}

/** The primary persona from "Kanino", with its problems in the Problem Bank. */
function planPersona(b: Builder, db: Database, a: OnboardingAnswers, newId: () => ID): PersonaPlan {
  const name = personaNameOf(a)
  const problems = cleanList(a.persona_problems)
  const values: UpdateRow<"audience_personas"> = {
    profession: a.persona_profession.trim(),
    experience_level: a.persona_experience.trim(),
    goals: cleanList([a.audience_goal, ...a.persona_goals]),
    problems,
    platforms: platformsInOrder(a.persona_platforms),
    is_primary: true,
  }
  const match = db.audience_personas.find((p) => norm(p.name) === norm(name))
  let id: ID
  if (match) {
    id = match.id
    b.patch("audience_personas", id, values)
  } else {
    id = newId()
    const used = new Set(db.audience_personas.map((p) => p.color))
    b.insert("audience_personas", { id, name, color: CATEGORICAL_COLORS.find((c) => !used.has(c)) ?? "blue", ...values })
  }
  for (const p of db.audience_personas) if (p.is_primary && p.id !== id) b.patch("audience_personas", p.id, { is_primary: false })

  const category = problemCategoryFor(a.persona_experience)
  const problemIds: ID[] = problems.map((text, index) => {
    const existing = db.audience_problems.find((r) => norm(r.problem) === norm(text) && (r.persona_id === id || r.persona_id === null))
    if (existing) {
      if (existing.persona_id !== id) b.patch("audience_problems", existing.id, { persona_id: id })
      return existing.id
    }
    const problemId = newId()
    b.insert("audience_problems", { id: problemId, persona_id: id, problem: text, category, severity: index === 0 ? 5 : index < 3 ? 4 : 3 })
    return problemId
  })
  return { id, name, problems, problemIds }
}

/** Story Vault — the proof story from "Galing", once. */
function planStory(b: Builder, db: Database, a: OnboardingAnswers, pillars: PillarPlan, newId: () => ID): boolean {
  const story = a.story.trim().slice(0, 2000)
  if (!story) return false
  const title = storyTitle(story)
  if (db.stories.some((s) => norm(s.situation) === norm(story) || (title && norm(s.title) === norm(title)))) return false
  b.insert("stories", {
    id: newId(),
    type: "experience",
    title: title || "My story",
    situation: story,
    keywords: cleanList([...a.expertise_areas, ...a.interests]).slice(0, 3).map((x) => x.toLowerCase()),
    pillar_id: pillars.idFor(pillarForLabel("Story / Journey", pillars.names)),
    is_favorite: true,
  })
  return true
}

/** The Brand HQ fields Niche Discovery owns (a full setup writes them too). */
function nicheBrand(a: OnboardingAnswers): UpdateRow<"brand_profiles"> {
  return {
    niche: a.niche.trim(),
    interests: cleanList(a.interests),
    niche_fit: a.niche_fit.trim(),
    positioning_audience: a.audience.trim(),
    positioning_result: a.result.trim(),
    positioning_method: a.method.trim(),
    known_for: a.known_for.trim() || a.niche.trim(),
    problems_solved: a.problems_solved.trim() || cleanList(a.persona_problems).join("; "),
    why_listen: a.why_listen.trim() || a.proof.trim(),
    expertise_areas: cleanList(a.expertise_areas),
    expertise_summary: a.expertise_summary.trim() || a.help_requests.trim(),
    years_experience: a.years_experience,
  }
}

const goalRef = (goalIds: Partial<Record<GoalCategory, ID>>, a: OnboardingAnswers): UpdateRow<"brand_profiles"> => ({
  primary_goal_id: a.primary_goal ? (goalIds[a.primary_goal] ?? null) : null,
  secondary_goal_id: a.secondary_goal && a.secondary_goal !== a.primary_goal ? (goalIds[a.secondary_goal] ?? null) : null,
})

/* ---------------------------------- Plans --------------------------------- */

export function planOnboarding(db: Database, input: OnboardingInput): OnboardingPlan {
  const a = input.answers
  const now = input.now ?? new Date()
  const newId = input.newId ?? uid
  const b = createBuilder()
  const libraryRows = planLibrary(db, b, now, newId)
  const goals = chosenGoals(a)
  const goalIds = planGoals(b, db, a, newId)
  const pillars = planPillars(b, db, a, newId)
  const persona = planPersona(b, db, a, newId)

  /* Platform strategies */
  const split = platformSplit(a)
  const main = new Set(platformsInOrder(a.platforms))
  for (const platform of PLATFORM_IDS) {
    const active = main.has(platform)
    const row = b.rows(db, "content_platforms").find((r) => r.platform === platform)
    if (!row) {
      if (active) {
        b.insert("content_platforms", {
          id: newId(),
          platform,
          is_active: true,
          posting_frequency: split[platform],
          primary_goal_id: a.primary_goal ? (goalIds[a.primary_goal] ?? null) : null,
        })
      }
      continue
    }
    const patch: UpdateRow<"content_platforms"> = {}
    if (row.is_active !== active) patch.is_active = active
    if (active && row.posting_frequency !== split[platform]) patch.posting_frequency = split[platform]
    b.patch("content_platforms", row.id, patch)
  }

  /* Posting schedule (content_calendar), one slot per day */
  const formatId = (name: string) => (name.trim() ? (b.rows(db, "content_formats").find((f) => norm(f.name) === norm(name))?.id ?? null) : null)
  const days = new Map(finalSchedule(a).map((d) => [d.day, d]))
  const weekStartsOn = db.app_settings[0]?.week_starts_on ?? 1
  let slots = 0
  weekOrder(weekStartsOn).forEach((day, index) => {
    const existing = db.content_calendar
      .filter((s) => s.day_of_week === day)
      .sort((x, y) => Number(y.is_active) - Number(x.is_active) || x.sort_order - y.sort_order)
    const plan = days.get(day)
    if (!plan) {
      for (const s of existing) if (s.is_active) b.patch("content_calendar", s.id, { is_active: false })
      return
    }
    const values: UpdateRow<"content_calendar"> = {
      label: plan.label.trim() || plan.format.trim() || "Posting slot",
      platforms: platformsInOrder(plan.platforms),
      time: plan.time,
      format_id: formatId(plan.format),
      pillar_id: pillars.idFor(pillarForLabel(plan.label, pillars.names)),
      sort_order: index,
      is_active: true,
    }
    const [first, ...rest] = existing
    if (first) b.patch("content_calendar", first.id, values)
    else b.insert("content_calendar", { id: newId(), day_of_week: day, ...values })
    for (const s of rest) if (s.is_active) b.patch("content_calendar", s.id, { is_active: false })
    slots++
  })

  /* Ideas */
  const seen = new Set(db.content_ideas.map((i) => norm(i.title)))
  const angles = b.rows(db, "angles")
  let ideas = 0
  let ideasSkipped = 0
  for (const { idea, title, pillar } of input.ideas) {
    const finalTitle = title.trim() || idea.title.trim()
    if (!finalTitle || seen.has(norm(finalTitle))) {
      ideasSkipped++
      continue
    }
    seen.add(norm(finalTitle))
    const problemIndex = matchProblem(idea, persona.problems)
    const goal = goalForIdea(idea.funnel_stage, goals)
    b.insert("content_ideas", {
      id: newId(),
      title: finalTitle,
      description: idea.core_idea.trim(),
      hook: idea.hook.trim(),
      hook_category: idea.hook_category,
      angle_id: angles.find((x) => norm(x.name) === norm(idea.angle))?.id ?? null,
      pillar_id: pillars.idFor(pillar),
      persona_id: persona.id,
      problem_id: problemIndex >= 0 ? (persona.problemIds[problemIndex] ?? null) : null,
      goal_id: goal ? (goalIds[goal] ?? null) : null,
      platforms: [idea.platform],
      format_id: formatId(idea.format),
      funnel_stage: idea.funnel_stage,
      inspiration: "Onboarding · initial strategy",
      source: "onboarding",
      status: "inbox",
      why_it_matters: idea.why_it_matters.trim(),
      talking_points: cleanList(idea.talking_points),
      cta: idea.cta.trim(),
    })
    ideas++
  }

  const story = planStory(b, db, a, pillars, newId)

  /* Settings + Brand HQ (the brand patch flips onboarding_completed, so it is applied last) */
  const weeklyTarget = weeklyTotal(a)
  const brandRow = db.brand_profiles[0]
  const brand: UpdateRow<"brand_profiles"> = {
    name: a.name.trim(),
    brand_name: a.brand_name.trim(),
    role: a.role.trim(),
    industry: a.industry.trim(),
    location: a.location.trim(),
    ...nicheBrand(a),
    point_of_view: a.point_of_view.trim(),
    personality_traits: [...a.personality],
    language: a.language,
    tones: [...a.tones],
    cta_style: a.cta_style.trim(),
    always_do: a.always_do.trim(),
    never_do: a.never_do.trim(),
    main_platforms: platformsInOrder(a.platforms),
    ...goalRef(goalIds, a),
    onboarding_completed: true,
  }
  if (!brandRow?.who_am_i.trim()) brand.who_am_i = whoAmI(a)

  return {
    inserts: b.inserts as PlanInserts,
    updates: b.updates as PlanUpdates,
    settings: { weekly_post_target: Math.round(weeklyTarget), ui_language: appLanguage(input.lang, a.language) },
    brand,
    summary: {
      libraryRows,
      pillars: pillars.count,
      pillarsArchived: pillars.archived,
      personaName: persona.name,
      problems: persona.problems.length,
      goals: goals.length,
      platforms: main.size,
      slots,
      weeklyTarget,
      ideas,
      ideasSkipped,
      story,
      niche: a.niche.trim(),
    },
  }
}

/** Re-run Niche Discovery on a finished workspace: niche fields, positioning, goals, persona, story — pillars only when confirmed. */
export function planNicheUpdate(db: Database, input: NicheUpdateInput): OnboardingPlan {
  const a = input.answers
  const newId = input.newId ?? uid
  const b = createBuilder()
  const goalIds = planGoals(b, db, a, newId)
  const pillars = input.replacePillars ? planPillars(b, db, a, newId) : currentPillars(db)
  const persona = planPersona(b, db, a, newId)
  const story = planStory(b, db, a, pillars, newId)
  return {
    inserts: b.inserts as PlanInserts,
    updates: b.updates as PlanUpdates,
    settings: {},
    brand: { ...nicheBrand(a), ...goalRef(goalIds, a) },
    summary: {
      libraryRows: 0,
      pillars: pillars.count,
      pillarsArchived: pillars.archived,
      personaName: persona.name,
      problems: persona.problems.length,
      goals: chosenGoals(a).length,
      platforms: 0,
      slots: 0,
      weeklyTarget: 0,
      ideas: 0,
      ideasSkipped: 0,
      story,
      niche: a.niche.trim(),
    },
  }
}
