/**
 * Collab Circles — weeks, streaks and the "this week" roll-up. Pure: pass `today` (the viewer's local
 * ISO date) in, like every analytics function (ARCHITECTURE §3 Time).
 *
 * Members can start their week on Monday or Sunday (their own `week_starts_on`), so a check-in's week is
 * "the 7 days from its week_start". The comparisons work on calendar-day numbers, never on timestamps.
 */
import type { ID, ISODate } from "@/lib/types"
import type { CircleCheckin, CircleMember, CircleRole } from "./types"

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Days since 1970-01-01 for an ISO date (calendar arithmetic, no time zones). NaN when malformed. */
export function dayNumber(date: ISODate): number {
  const m = ISO.exec(date)
  if (!m) return Number.NaN
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000)
}

/** The check-in's week contains `today` (week_start ≤ today ≤ week_start + 6). */
export function isCurrentWeek(weekStart: ISODate, today: ISODate): boolean {
  const diff = dayNumber(today) - dayNumber(weekStart)
  return diff >= 0 && diff <= 6
}

/**
 * The streak: consecutive weeks, ending with the current or the previous week, in which the member checked
 * in with at least one post.
 * - A current week without a qualifying check-in yet doesn't break it (the week isn't over).
 * - A check-in with 0 posts doesn't count, and a week with none breaks the run.
 * - Weeks 6–8 days apart count as consecutive, so switching between Monday and Sunday weeks keeps it.
 * - Check-ins dated in the future are ignored.
 */
export function circleStreak(checkins: readonly Pick<CircleCheckin, "week_start" | "posts">[], today: ISODate): number {
  const todayN = dayNumber(today)
  const weeks = [...new Set(checkins.filter((c) => c.posts >= 1).map((c) => dayNumber(c.week_start)))]
    .filter((n) => Number.isFinite(n) && n <= todayN)
    .sort((a, b) => b - a)
  if (!weeks.length || todayN - weeks[0] > 13) return 0
  let streak = 1
  let previous = weeks[0]
  for (const week of weeks.slice(1)) {
    const gap = previous - week
    if (gap < 6) continue // Overlapping week after a Monday/Sunday switch: same week.
    if (gap > 8) break
    streak++
    previous = week
  }
  return streak
}

/** The member's check-in for the week containing `today` (the latest one if there are two). */
export function currentCheckin<T extends Pick<CircleCheckin, "week_start" | "updated_at">>(checkins: readonly T[], today: ISODate): T | null {
  let best: T | null = null
  for (const c of checkins) {
    if (!isCurrentWeek(c.week_start, today)) continue
    if (!best || c.week_start > best.week_start || (c.week_start === best.week_start && c.updated_at > best.updated_at)) best = c
  }
  return best
}

/** Names in a stable, human order (never by score). */
export function compareMembers(a: Pick<CircleMember, "display_name" | "user_id">, b: Pick<CircleMember, "display_name" | "user_id">): number {
  return a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }) || a.user_id.localeCompare(b.user_id)
}

export interface MemberWeek {
  member: CircleMember
  isSelf: boolean
  /** This week's check-in, or null. */
  checkin: CircleCheckin | null
  streak: number
}

export interface CircleWeek {
  /** Every member, sorted by name. */
  rows: MemberWeek[]
  /** Members who checked in this week. */
  checkedIn: number
  total: number
  self: MemberWeek | null
  selfRole: CircleRole | null
}

/** This week in one circle: who checked in, and everyone's streak. */
export function circleWeek(
  data: { members: readonly CircleMember[]; checkins: readonly CircleCheckin[] },
  circleId: ID,
  selfId: ID,
  today: ISODate
): CircleWeek {
  const byUser = new Map<ID, CircleCheckin[]>()
  for (const c of data.checkins) {
    if (c.circle_id !== circleId) continue
    const list = byUser.get(c.user_id) ?? []
    list.push(c)
    byUser.set(c.user_id, list)
  }
  const rows = data.members
    .filter((m) => m.circle_id === circleId)
    .sort(compareMembers)
    .map((member): MemberWeek => {
      const own = byUser.get(member.user_id) ?? []
      return { member, isSelf: member.user_id === selfId, checkin: currentCheckin(own, today), streak: circleStreak(own, today) }
    })
  const self = rows.find((r) => r.isSelf) ?? null
  return {
    rows,
    checkedIn: rows.filter((r) => r.checkin).length,
    total: rows.length,
    self,
    selfRole: self?.member.role ?? null,
  }
}
