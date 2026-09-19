/**
 * `CirclesApi` over the browser Supabase client: reads through row-level security, writes through the
 * policies (check-ins, asks, interests, your display name) or the circle functions (everything that needs
 * more than "your own row"). No API routes and no secret key — the database enforces every rule
 * (supabase/migrations/20260919000000_circles.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { subDays } from "date-fns"
import { toISODate } from "@/lib/dates"
import {
  CHECKIN_HISTORY_WEEKS,
  CircleApiError,
  toCircleError,
  type Circle,
  type CircleAsk,
  type CircleAskInterest,
  type CircleCheckin,
  type CircleMember,
  type CirclesApi,
  type InvitePreview,
} from "@/lib/circles/types"
import type { ID } from "@/lib/types"

/** Every readable column, listed: `circles.invite_code_hash` is not readable, so never `select *`. */
export const CIRCLE_COLUMNS = "id, name, created_by, created_at"
export const MEMBER_COLUMNS = "circle_id, user_id, display_name, role, joined_at"
export const CHECKIN_COLUMNS = "id, circle_id, user_id, week_start, posts, note, created_at, updated_at"
export const ASK_COLUMNS = "id, circle_id, user_id, type, text, status, created_at"
export const INTEREST_COLUMNS = "ask_id, circle_id, user_id, status, created_at"

interface Result<T> {
  data: T | null
  error: unknown
}

async function run<T>(request: PromiseLike<Result<T>>): Promise<T> {
  let result: Result<T>
  try {
    result = await request
  } catch (error) {
    throw toCircleError(error)
  }
  if (result.error) throw toCircleError(result.error)
  return result.data as T
}

const first = <T>(rows: T[] | T | null): T | null => (Array.isArray(rows) ? (rows[0] ?? null) : rows)

export function createSupabaseCirclesApi(supabase: SupabaseClient, self: ID, options: { now?: () => Date } = {}): CirclesApi {
  const now = options.now ?? (() => new Date())
  const historyStart = () => toISODate(subDays(now(), CHECKIN_HISTORY_WEEKS * 7))

  return {
    self,

    async listCircles() {
      const circles = await run<Circle[]>(supabase.from("circles").select(CIRCLE_COLUMNS).order("created_at", { ascending: true }))
      if (!circles.length) return { circles: [], members: [], checkins: [] }
      const ids = circles.map((c) => c.id)
      const [members, checkins] = await Promise.all([
        run<CircleMember[]>(supabase.from("circle_members").select(MEMBER_COLUMNS).in("circle_id", ids)),
        run<CircleCheckin[]>(supabase.from("circle_checkins").select(CHECKIN_COLUMNS).in("circle_id", ids).gte("week_start", historyStart())),
      ])
      return { circles, members, checkins }
    },

    async getCircle(circleId) {
      const circle = first(await run<Circle[]>(supabase.from("circles").select(CIRCLE_COLUMNS).eq("id", circleId)))
      if (!circle) return null
      const [members, checkins, asks, interests] = await Promise.all([
        run<CircleMember[]>(supabase.from("circle_members").select(MEMBER_COLUMNS).eq("circle_id", circleId)),
        run<CircleCheckin[]>(supabase.from("circle_checkins").select(CHECKIN_COLUMNS).eq("circle_id", circleId).gte("week_start", historyStart())),
        run<CircleAsk[]>(supabase.from("circle_asks").select(ASK_COLUMNS).eq("circle_id", circleId).order("created_at", { ascending: false })),
        run<CircleAskInterest[]>(supabase.from("circle_ask_interests").select(INTEREST_COLUMNS).eq("circle_id", circleId)),
      ])
      return { circle, members, checkins, asks, interests }
    },

    async createCircle({ name, displayName }) {
      const row = first(await run<{ circle_id: ID; invite_code: string }[]>(supabase.rpc("create_circle", { p_name: name, p_display_name: displayName })))
      if (!row) throw new CircleApiError("unknown", "create_circle returned nothing")
      return { circleId: row.circle_id, inviteCode: row.invite_code }
    },

    async previewInvite(code) {
      return first(await run<InvitePreview[]>(supabase.rpc("preview_invite", { p_code: code })))
    },

    async joinCircle({ code, displayName }) {
      const row = first(await run<{ circle_id: ID; joined: boolean }[]>(supabase.rpc("join_circle", { p_code: code, p_display_name: displayName })))
      if (!row) throw new CircleApiError("invalid_code")
      return { circleId: row.circle_id, joined: row.joined }
    },

    async rotateInvite(circleId) {
      return run<string>(supabase.rpc("rotate_invite", { p_circle_id: circleId }))
    },

    async removeMember(circleId, userId) {
      await run(supabase.rpc("remove_member", { p_circle_id: circleId, p_user_id: userId }))
    },

    async leaveCircle(circleId) {
      const result = await run<string>(supabase.rpc("leave_circle", { p_circle_id: circleId }))
      return result === "deleted" ? "deleted" : "left"
    },

    async renameSelf(circleId, displayName) {
      const rows = await run<{ user_id: ID }[]>(
        supabase.from("circle_members").update({ display_name: displayName.trim() }).eq("circle_id", circleId).eq("user_id", self).select("user_id")
      )
      if (!rows.length) throw new CircleApiError("not_member")
    },

    async checkIn({ circleId, weekStart, posts, note }) {
      const rows = await run<CircleCheckin[]>(
        supabase
          .from("circle_checkins")
          .upsert({ circle_id: circleId, user_id: self, week_start: weekStart, posts, note: note.trim() }, { onConflict: "circle_id,user_id,week_start" })
          .select(CHECKIN_COLUMNS)
      )
      const row = first(rows)
      if (!row) throw new CircleApiError("unknown", "check-in returned nothing")
      return row
    },

    async postAsk({ circleId, type, text }) {
      const row = first(
        await run<CircleAsk[]>(supabase.from("circle_asks").insert({ circle_id: circleId, user_id: self, type, text: text.trim() }).select(ASK_COLUMNS))
      )
      if (!row) throw new CircleApiError("unknown", "ask returned nothing")
      return row
    },

    async closeAsk(askId) {
      const rows = await run<{ id: ID }[]>(supabase.from("circle_asks").update({ status: "closed" }).eq("id", askId).eq("user_id", self).select("id"))
      if (!rows.length) throw new CircleApiError("not_author")
    },

    async showInterest(circleId, askId) {
      await run(supabase.from("circle_ask_interests").insert({ ask_id: askId, circle_id: circleId, user_id: self }))
    },

    async withdrawInterest(askId) {
      await run(supabase.from("circle_ask_interests").delete().eq("ask_id", askId).eq("user_id", self))
    },

    async acceptInterest(askId, userId) {
      await run(supabase.rpc("accept_interest", { p_ask_id: askId, p_user_id: userId }))
    },

    async contactOf(circleId, userId) {
      const value = await run<string | null>(supabase.rpc("circle_contact", { p_circle_id: circleId, p_other_user_id: userId }))
      return typeof value === "string" && value ? value : null
    },

    async setMyContact(circleId, contact) {
      await run(supabase.rpc("set_circle_contact", { p_circle_id: circleId, p_contact: contact }))
    },
  }
}
