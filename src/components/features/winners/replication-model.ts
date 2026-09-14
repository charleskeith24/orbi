/**
 * "Create more content like this" (winner_replication): AI output → editable drafts → Idea Bank rows
 * (source "winner", source_ref_id = the winning post).
 */
import type { AiTaskOutput } from "@/lib/ai"
import { HOOK_CATEGORIES, HOOK_CATEGORY_IDS } from "@/lib/constants"
import type { AiProviderId, ContentIdea, ContentItem, Database, HookCategory, ID, InsertRow } from "@/lib/types"

export type ReplicationOutput = AiTaskOutput<"winner_replication">

export type ReplicationGroup =
  | "variations"
  | "follow_ups"
  | "hooks"
  | "part_2"
  | "contrarian_version"
  | "advanced_version"
  | "beginner_version"
  | "story_version"

export const REPLICATION_GROUPS: { key: ReplicationGroup; label: string; description: string }[] = [
  { key: "variations", label: "Variations", description: "New angles on the same core idea" },
  { key: "follow_ups", label: "Follow-ups", description: "Continue the conversation it started" },
  { key: "hooks", label: "Different hooks", description: "The same idea with a new opening line" },
  { key: "part_2", label: "Part 2", description: "Pick up where the original left off" },
  { key: "contrarian_version", label: "Contrarian version", description: "Argue the other side" },
  { key: "advanced_version", label: "Advanced version", description: "For people past the basics" },
  { key: "beginner_version", label: "Beginner version", description: "For people just starting out" },
  { key: "story_version", label: "Story version", description: "Tell it through a real experience" },
]

const GROUP_LABELS = Object.fromEntries(REPLICATION_GROUPS.map((g) => [g.key, g.label])) as Record<ReplicationGroup, string>

export interface ReplicationDraft {
  key: string
  group: ReplicationGroup
  title: string
  hook: string
  angle: string
}

export function draftsFromOutput(output: ReplicationOutput): ReplicationDraft[] {
  const drafts: ReplicationDraft[] = []
  for (const { key: group } of REPLICATION_GROUPS) {
    const value = output[group]
    const list = Array.isArray(value) ? value : [value]
    list.forEach((idea, index) => {
      drafts.push({ key: `${group}-${index}`, group, title: idea.title.trim(), hook: idea.hook.trim(), angle: idea.angle.trim() })
    })
  }
  return drafts
}

const norm = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase()

/** Title + hook identity — recognises drafts already saved as ideas (the "Different hooks" drafts share a title). */
export function ideaSignature(value: { title: string; hook: string }): string {
  return `${norm(value.title)}\n${norm(value.hook)}`
}

/** "Contrarian" → contrarian; angle labels that aren't hook styles ("Framework") → null. */
export function hookCategoryForAngle(angle: string): HookCategory | null {
  const key = norm(angle)
  return key ? (HOOK_CATEGORY_IDS.find((id) => HOOK_CATEGORIES[id].label.toLowerCase() === key) ?? null) : null
}

/** A draft as an Idea Bank row that inherits the winner's strategy (pillar, persona, problem, goal, platform, format, funnel, CTA). */
export function replicationIdeaValues(
  db: Database,
  item: ContentItem,
  draft: ReplicationDraft,
  ratio: number | null
): InsertRow<"content_ideas"> {
  const angleKey = norm(draft.angle)
  const angle = angleKey ? db.angles.find((a) => norm(a.name) === angleKey) : undefined
  const idea = item.idea_id ? db.content_ideas.find((i) => i.id === item.idea_id) : undefined
  const brief = db.content_briefs.find((b) => b.content_item_id === item.id)
  const hook = draft.hook.trim()
  const source = item.title.trim() || "Untitled content"
  return {
    title: draft.title.trim(),
    core_topic: idea?.core_topic ?? "",
    description: `${GROUP_LABELS[draft.group]} of the winner “${source}”.`,
    hook,
    hook_category: hook ? hookCategoryForAngle(draft.angle) : null,
    angle_id: angle?.id ?? null,
    pillar_id: item.pillar_id,
    persona_id: item.persona_id,
    problem_id: item.problem_id,
    goal_id: item.goal_id,
    platforms: [item.platform],
    format_id: item.format_id,
    funnel_stage: item.funnel_stage,
    inspiration: `Winner Replication · “${source}”${ratio !== null ? ` (${ratio.toFixed(1)}× baseline)` : ""}`,
    source: "winner",
    source_ref_id: item.id,
    status: "inbox",
    cta: brief?.cta.trim() ?? "",
  }
}

/** Ideas saved from one winner, newest first. */
export function ideasFromWinner(ideas: ContentIdea[], itemId: ID): ContentIdea[] {
  return ideas
    .filter((i) => i.source === "winner" && i.source_ref_id === itemId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export interface ReplicationSession {
  drafts: ReplicationDraft[]
  provider: AiProviderId
  model: string
  /** Draft key → idea id created from it. */
  saved: Record<string, ID>
}

// Generated drafts survive closing and reopening the sheet for the rest of the browser session.
const sessions = new Map<ID, ReplicationSession>()

export function getReplicationSession(itemId: ID): ReplicationSession | null {
  return sessions.get(itemId) ?? null
}

export function setReplicationSession(itemId: ID, session: ReplicationSession) {
  sessions.set(itemId, session)
}
