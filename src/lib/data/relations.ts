/**
 * Referential rules mirrored from the Postgres foreign keys.
 * The client store applies them in memory so local mode behaves exactly like
 * Supabase (ON DELETE CASCADE / SET NULL), including array references and the
 * polymorphic `content_tags` join which Postgres cannot enforce.
 */
import type { Database, ID, TableName, TaggableEntity } from "@/lib/types"

export type OnDelete = "cascade" | "set_null" | "array_remove"

export interface Reference {
  table: TableName
  column: string
  onDelete: OnDelete
}

/** For each parent table: which child columns point at it. */
export const REFERENCES: Partial<Record<TableName, Reference[]>> = {
  content_goals: [
    { table: "brand_profiles", column: "primary_goal_id", onDelete: "set_null" },
    { table: "brand_profiles", column: "secondary_goal_id", onDelete: "set_null" },
    { table: "content_platforms", column: "primary_goal_id", onDelete: "set_null" },
    { table: "content_ideas", column: "goal_id", onDelete: "set_null" },
    { table: "content_items", column: "goal_id", onDelete: "set_null" },
    { table: "content_campaigns", column: "goal_id", onDelete: "set_null" },
  ],
  audience_personas: [
    { table: "audience_problems", column: "persona_id", onDelete: "set_null" },
    { table: "audience_questions", column: "persona_id", onDelete: "set_null" },
    { table: "content_ideas", column: "persona_id", onDelete: "set_null" },
    { table: "content_items", column: "persona_id", onDelete: "set_null" },
    { table: "content_campaigns", column: "persona_id", onDelete: "set_null" },
  ],
  audience_problems: [
    { table: "content_ideas", column: "problem_id", onDelete: "set_null" },
    { table: "content_items", column: "problem_id", onDelete: "set_null" },
  ],
  content_pillars: [
    { table: "audience_problems", column: "pillar_id", onDelete: "set_null" },
    { table: "audience_questions", column: "pillar_id", onDelete: "set_null" },
    { table: "hooks", column: "pillar_id", onDelete: "set_null" },
    { table: "content_ideas", column: "pillar_id", onDelete: "set_null" },
    { table: "content_items", column: "pillar_id", onDelete: "set_null" },
    { table: "content_calendar", column: "pillar_id", onDelete: "set_null" },
    { table: "content_campaigns", column: "pillar_id", onDelete: "set_null" },
    { table: "content_series", column: "pillar_id", onDelete: "set_null" },
    { table: "stories", column: "pillar_id", onDelete: "set_null" },
    { table: "research_items", column: "pillar_id", onDelete: "set_null" },
    { table: "content_platforms", column: "preferred_pillar_ids", onDelete: "array_remove" },
  ],
  content_formats: [
    { table: "content_ideas", column: "format_id", onDelete: "set_null" },
    { table: "content_items", column: "format_id", onDelete: "set_null" },
    { table: "content_calendar", column: "format_id", onDelete: "set_null" },
    { table: "content_series", column: "format_id", onDelete: "set_null" },
    { table: "content_platforms", column: "preferred_format_ids", onDelete: "array_remove" },
  ],
  angles: [
    { table: "content_ideas", column: "angle_id", onDelete: "set_null" },
    { table: "content_items", column: "angle_id", onDelete: "set_null" },
  ],
  hooks: [{ table: "content_items", column: "hook_id", onDelete: "set_null" }],
  tags: [{ table: "content_tags", column: "tag_id", onDelete: "cascade" }],
  content_ideas: [
    { table: "content_items", column: "idea_id", onDelete: "set_null" },
    { table: "audience_questions", column: "idea_id", onDelete: "set_null" },
  ],
  content_campaigns: [
    { table: "content_ideas", column: "campaign_id", onDelete: "set_null" },
    { table: "content_items", column: "campaign_id", onDelete: "set_null" },
    { table: "brand_deals", column: "campaign_id", onDelete: "set_null" },
  ],
  content_series: [
    { table: "content_ideas", column: "series_id", onDelete: "set_null" },
    { table: "content_items", column: "series_id", onDelete: "set_null" },
  ],
  content_items: [
    { table: "content_briefs", column: "content_item_id", onDelete: "cascade" },
    { table: "content_scripts", column: "content_item_id", onDelete: "cascade" },
    { table: "content_metrics", column: "content_item_id", onDelete: "cascade" },
    { table: "content_repurposing", column: "source_item_id", onDelete: "cascade" },
    { table: "content_repurposing", column: "target_item_id", onDelete: "set_null" },
    { table: "content_items", column: "parent_id", onDelete: "set_null" },
    { table: "content_ideas", column: "converted_item_id", onDelete: "set_null" },
    { table: "audience_questions", column: "content_item_id", onDelete: "set_null" },
    { table: "content_experiments", column: "variant_a_item_ids", onDelete: "array_remove" },
    { table: "content_experiments", column: "variant_b_item_ids", onDelete: "array_remove" },
    { table: "weekly_reviews", column: "planned_item_ids", onDelete: "array_remove" },
    { table: "brand_deals", column: "content_item_ids", onDelete: "array_remove" },
    { table: "income_entries", column: "content_item_id", onDelete: "set_null" },
  ],
  brand_deals: [{ table: "income_entries", column: "brand_deal_id", onDelete: "set_null" }],
}

export const TAGGABLE_TABLES: TaggableEntity[] = [
  "content_ideas",
  "content_items",
  "stories",
  "hooks",
  "research_items",
  "content_campaigns",
]

export interface DeletePlan {
  /** Rows to delete, per table (includes the originally requested rows). */
  deletes: Map<TableName, Set<ID>>
  /** Field patches to apply to surviving rows (set-null / array-remove). */
  patches: Map<TableName, Map<ID, Record<string, unknown>>>
}

/** Compute every effect of deleting `ids` from `table`, following cascades recursively. */
export function planDelete(db: Database, table: TableName, ids: ID[]): DeletePlan {
  const plan: DeletePlan = { deletes: new Map(), patches: new Map() }
  const queue: [TableName, ID[]][] = [[table, ids]]

  const markDeleted = (t: TableName, id: ID) => {
    const set = plan.deletes.get(t) ?? new Set<ID>()
    const isNew = !set.has(id)
    set.add(id)
    plan.deletes.set(t, set)
    return isNew
  }
  const isDeleted = (t: TableName, id: ID) => plan.deletes.get(t)?.has(id) ?? false
  const patch = (t: TableName, id: ID, field: string, value: unknown) => {
    const tableMap = plan.patches.get(t) ?? new Map<ID, Record<string, unknown>>()
    const rowPatch = tableMap.get(id) ?? {}
    rowPatch[field] = value
    tableMap.set(id, rowPatch)
    plan.patches.set(t, tableMap)
  }

  while (queue.length) {
    const [parentTable, parentIds] = queue.shift()!
    const fresh = parentIds.filter((id) => markDeleted(parentTable, id))
    if (!fresh.length) continue
    const freshSet = new Set(fresh)

    for (const ref of REFERENCES[parentTable] ?? []) {
      const rows = db[ref.table] as unknown as Record<string, unknown>[]
      const cascadeIds: ID[] = []
      for (const row of rows) {
        const rowId = row.id as ID
        const value = row[ref.column]
        if (ref.onDelete === "array_remove") {
          if (Array.isArray(value) && value.some((v) => freshSet.has(v as ID))) {
            const current = (plan.patches.get(ref.table)?.get(rowId)?.[ref.column] as ID[] | undefined) ?? (value as ID[])
            patch(ref.table, rowId, ref.column, current.filter((v) => !freshSet.has(v)))
          }
        } else if (typeof value === "string" && freshSet.has(value)) {
          if (ref.onDelete === "cascade") cascadeIds.push(rowId)
          else patch(ref.table, rowId, ref.column, null)
        }
      }
      if (cascadeIds.length) queue.push([ref.table, cascadeIds])
    }

    // Polymorphic tag links.
    if ((TAGGABLE_TABLES as TableName[]).includes(parentTable)) {
      const linkIds = db.content_tags
        .filter((l) => l.entity_type === parentTable && freshSet.has(l.entity_id))
        .map((l) => l.id)
      if (linkIds.length) queue.push(["content_tags", linkIds])
    }
  }

  // Drop patches aimed at rows that are themselves being deleted.
  for (const [t, map] of plan.patches) {
    for (const id of [...map.keys()]) if (isDeleted(t, id)) map.delete(id)
    if (!map.size) plan.patches.delete(t)
  }
  return plan
}
