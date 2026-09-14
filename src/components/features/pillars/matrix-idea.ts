/** Content Matrix combination → Idea Bank row, and → Idea Generator deep link. */
import { FUNNEL_STAGES } from "@/lib/constants"
import type { Database, ID, InsertRow, PlatformId } from "@/lib/types"
import type { MatrixCombo } from "./matrix-engine"

/** Active platforms whose strategy prefers the format (max 3); otherwise the brand's first main platform. */
export function platformsForFormat(db: Database, formatId: ID): PlatformId[] {
  const preferred = db.content_platforms
    .filter((p) => p.is_active && p.preferred_format_ids.includes(formatId))
    .map((p) => p.platform)
  if (preferred.length) return preferred.slice(0, 3)
  return (db.brand_profiles[0]?.main_platforms ?? []).slice(0, 1)
}

/** Every dimension of the combination prefilled; source `matrix`, straight into the Inbox. */
export function matrixIdeaValues(combo: MatrixCombo, db: Database): InsertRow<"content_ideas"> {
  const stage = FUNNEL_STAGES[combo.stage.id]
  return {
    title: combo.title,
    core_topic: combo.problem.text,
    description: `From the Content Matrix — ${combo.pillar.name} × ${combo.format.name} × ${combo.goal.name} × ${stage.label} (${stage.name}). Audience problem: “${combo.problem.text}”.`,
    why_it_matters: combo.reasons.length
      ? `${combo.reasons.join(". ")}.`
      : `Answers a severity ${combo.problem.severity}/5 audience problem.`,
    pillar_id: combo.pillar.id,
    format_id: combo.format.id,
    problem_id: combo.problem.id,
    persona_id: combo.problem.personaId,
    goal_id: combo.goal.id,
    funnel_stage: combo.stage.id,
    platforms: platformsForFormat(db, combo.format.id),
    source: "matrix",
    status: "inbox",
    priority: combo.pillar.need > 0.1 && combo.problem.severity >= 4 ? "high" : "medium",
  }
}

/** `/ideas/generator?pillar=&format=&problem=&goal=&funnel=&count=3&run=1` (+ `persona` when the problem has one). */
export function generatorHref(combo: MatrixCombo): string {
  const params = new URLSearchParams({
    pillar: combo.pillar.id,
    format: combo.format.id,
    problem: combo.problem.id,
    goal: combo.goal.id,
    funnel: combo.stage.id,
    count: "3",
    run: "1",
  })
  if (combo.problem.personaId) params.set("persona", combo.problem.personaId)
  return `/ideas/generator?${params.toString()}`
}
