/**
 * Short references for context entities (P1 = first pillar, A2 = second persona …).
 * Prompts show refs instead of UUIDs (cheaper, and the model can't invent an id);
 * outputs are mapped back to real ids with `resolveRef` after parsing.
 */
import type { BrandContext } from "./context"

export type RefKind = "pillar" | "persona" | "problem" | "question" | "format" | "angle" | "story" | "goal"

const PREFIX: Record<RefKind, string> = {
  pillar: "P",
  persona: "A",
  problem: "R",
  question: "Q",
  format: "F",
  angle: "N",
  story: "S",
  goal: "G",
}

type Named = { id: string; name?: string; title?: string; problem?: string; question?: string }

function rowsFor(ctx: BrandContext, kind: RefKind): readonly Named[] {
  switch (kind) {
    case "pillar":
      return ctx.pillars
    case "persona":
      return ctx.personas
    case "problem":
      return ctx.problems
    case "question":
      return ctx.questions
    case "format":
      return ctx.formats
    case "angle":
      return ctx.angles
    case "story":
      return ctx.stories
    case "goal":
      return ctx.goals
  }
}

/** "P2" for the second pillar; "" when the id isn't in the context. */
export function refOf(ctx: BrandContext, kind: RefKind, id: string | null | undefined): string {
  if (!id) return ""
  const index = rowsFor(ctx, kind).findIndex((r) => r.id === id)
  return index >= 0 ? `${PREFIX[kind]}${index + 1}` : ""
}

/** "P2 Education" — ref plus a readable label. */
export function labelOf(ctx: BrandContext, kind: RefKind, id: string | null | undefined): string {
  if (!id) return ""
  const row = rowsFor(ctx, kind).find((r) => r.id === id)
  if (!row) return ""
  const name = row.name ?? row.title ?? row.problem ?? row.question ?? ""
  return `${refOf(ctx, kind, id)} ${name}`.trim()
}

/**
 * Map a model-supplied value back to a real id: accepts a ref ("P2", "p2", "P2 Education"),
 * the exact id, or the exact name. Anything else → null (ids are never invented).
 */
export function resolveRef(ctx: BrandContext, kind: RefKind, value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  const rows = rowsFor(ctx, kind)
  if (rows.some((r) => r.id === v)) return v
  const match = new RegExp(`^${PREFIX[kind]}(\\d+)\\b`, "i").exec(v)
  if (match) return rows[Number(match[1]) - 1]?.id ?? null
  const lower = v.toLowerCase()
  const byName = rows.find((r) => (r.name ?? r.title ?? "").toLowerCase() === lower)
  return byName?.id ?? null
}

export function refPrefix(kind: RefKind): string {
  return PREFIX[kind]
}
