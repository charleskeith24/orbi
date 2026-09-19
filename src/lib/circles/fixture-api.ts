/**
 * An in-memory `CirclesApi` that follows the same rules as the database (members-only reads, own-row
 * writes, contacts only after an accepted interest, 8 members, owner hand-over). Two uses:
 * - tests (`createCirclesFake`: empty, or seeded);
 * - the DEV-ONLY fixture (`createCirclesFixture`: clearly-labelled sample circles), loaded only through
 *   `features/circles/api/dev-fixture.ts`, which never runs in production. Creating either in a
 *   production build throws.
 *
 * Nothing here is real: every person is "(sample)" and contacts are sample handles or example.com.
 */
import { addDays, subDays } from "date-fns"
import { startOfWeek, toISODate } from "@/lib/dates"
import type { CollabType, ID, ISODate } from "@/lib/types"
import { dayNumber } from "./streak"
import { isInviteCode } from "./invite"
import {
  CIRCLE_LIMITS,
  CircleApiError,
  type Circle,
  type CircleAsk,
  type CircleAskInterest,
  type CircleCheckin,
  type CircleMember,
  type CirclesApi,
  type CircleSnapshot,
  type CirclesOverview,
  type InvitePreview,
} from "./types"

export const FIXTURE_SELF_ID = "sample-you"
/** A circle you're not in yet, so the join page can be screenshotted: `/circles/join/<this>`. */
export const FIXTURE_JOIN_CODE = "SampleInviteCodeForTheDevFixtureOnly0000000"

interface State {
  circles: (Circle & { code: string })[]
  members: CircleMember[]
  contacts: { circle_id: ID; user_id: ID; contact: string }[]
  checkins: CircleCheckin[]
  asks: CircleAsk[]
  interests: CircleAskInterest[]
  nextId: number
}

export interface FakeOptions {
  /** The signed-in user. */
  self?: ID
  now?: () => Date
  /** Simulated latency (ms), so pending states show up in screenshots. */
  latencyMs?: number
  /** A shared state, so several "users" can act on the same circles in a test. */
  state?: State
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

function randomCode(): string {
  const bytes = new Uint8Array(43)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b & 63]).join("")
}

export function emptyCirclesState(): State {
  return { circles: [], members: [], contacts: [], checkins: [], asks: [], interests: [], nextId: 1 }
}

/** A circle as members read it: never the invite code. */
function publicCircle(circle: State["circles"][number]): Circle {
  return { id: circle.id, name: circle.name, created_by: circle.created_by, created_at: circle.created_at }
}

function assertDevelopment(what: string) {
  if (process.env.NODE_ENV === "production") throw new Error(`The ${what} is development-only.`)
}

/** A fake API over `state` (fresh and empty by default). Throws in production builds. */
export function createCirclesFake(options: FakeOptions = {}): CirclesApi & { state: State } {
  assertDevelopment("circles fake")
  const self = options.self ?? FIXTURE_SELF_ID
  const now = options.now ?? (() => new Date())
  const latency = options.latencyMs ?? 0
  const state = options.state ?? emptyCirclesState()

  const wait = <T>(fn: () => T): Promise<T> =>
    new Promise((resolve, reject) => {
      const run = () => {
        try {
          resolve(fn())
        } catch (error) {
          reject(error)
        }
      }
      if (latency > 0) setTimeout(run, latency)
      else queueMicrotask(run)
    })

  const fail = (code: ConstructorParameters<typeof CircleApiError>[0]): never => {
    throw new CircleApiError(code)
  }
  const stamp = () => now().toISOString()
  const nextId = (prefix: string) => `${prefix}-${state.nextId++}`
  const memberOf = (circleId: ID, userId: ID = self) => state.members.find((m) => m.circle_id === circleId && m.user_id === userId) ?? null
  const isOwner = (circleId: ID) => memberOf(circleId)?.role === "owner"
  const membersIn = (circleId: ID) => state.members.filter((m) => m.circle_id === circleId)
  const clean = (value: string) => value.trim()
  const copy = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r }))
  const historyStart = () => dayNumber(toISODate(subDays(now(), 53 * 7)))

  /** Membership removal: everything the member wrote goes; the owner hands over; an empty circle goes. */
  function removeMembership(circleId: ID, userId: ID) {
    const leaving = memberOf(circleId, userId)
    if (!leaving) return
    const theirAsks = new Set(state.asks.filter((a) => a.circle_id === circleId && a.user_id === userId).map((a) => a.id))
    state.members = state.members.filter((m) => m !== leaving)
    state.contacts = state.contacts.filter((c) => !(c.circle_id === circleId && c.user_id === userId))
    state.checkins = state.checkins.filter((c) => !(c.circle_id === circleId && c.user_id === userId))
    state.asks = state.asks.filter((a) => !theirAsks.has(a.id))
    state.interests = state.interests.filter((i) => !theirAsks.has(i.ask_id) && !(i.circle_id === circleId && i.user_id === userId))
    const rest = membersIn(circleId)
    if (!rest.length) {
      state.circles = state.circles.filter((c) => c.id !== circleId)
      return
    }
    if (leaving.role === "owner" && !rest.some((m) => m.role === "owner")) {
      // Longest-standing member; ties (same timestamp) go to whoever joined first.
      const heir = rest.reduce((a, b) => (b.joined_at < a.joined_at ? b : a))
      heir.role = "owner"
    }
  }

  function validDisplayName(value: string): string {
    const name = clean(value)
    if (!name || name.length > CIRCLE_LIMITS.displayName) fail("invalid_display_name")
    return name
  }

  const api: CirclesApi & { state: State } = {
    self,
    state,

    listCircles: () =>
      wait((): CirclesOverview => {
        const ids = new Set(state.members.filter((m) => m.user_id === self).map((m) => m.circle_id))
        const since = historyStart()
        return {
          circles: state.circles.filter((c) => ids.has(c.id)).map(publicCircle),
          members: copy(state.members.filter((m) => ids.has(m.circle_id))),
          checkins: copy(state.checkins.filter((c) => ids.has(c.circle_id) && dayNumber(c.week_start) >= since)),
        }
      }),

    getCircle: (circleId) =>
      wait((): CircleSnapshot | null => {
        const circle = state.circles.find((c) => c.id === circleId)
        if (!circle || !memberOf(circleId)) return null
        const since = historyStart()
        return {
          circle: publicCircle(circle),
          members: copy(membersIn(circleId)),
          checkins: copy(state.checkins.filter((c) => c.circle_id === circleId && dayNumber(c.week_start) >= since)),
          asks: copy(state.asks.filter((a) => a.circle_id === circleId)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
          interests: copy(state.interests.filter((i) => i.circle_id === circleId)),
        }
      }),

    createCircle: ({ name, displayName }) =>
      wait(() => {
        const circleName = clean(name)
        if (!circleName || circleName.length > CIRCLE_LIMITS.name) fail("invalid_name")
        const display = validDisplayName(displayName)
        if (state.members.filter((m) => m.user_id === self).length >= CIRCLE_LIMITS.circlesPerPerson) fail("too_many_circles")
        const id = nextId("circle")
        const code = randomCode()
        state.circles.push({ id, name: circleName, created_by: self, created_at: stamp(), code })
        state.members.push({ circle_id: id, user_id: self, display_name: display, role: "owner", joined_at: stamp() })
        return { circleId: id, inviteCode: code }
      }),

    previewInvite: (code) =>
      wait((): InvitePreview | null => {
        if (!isInviteCode(code)) return null
        const circle = state.circles.find((c) => c.code === code)
        if (!circle) return null
        const members = membersIn(circle.id).length
        return { circle_id: circle.id, name: circle.name, members, is_member: Boolean(memberOf(circle.id)), is_full: members >= CIRCLE_LIMITS.members }
      }),

    joinCircle: ({ code, displayName }) =>
      wait(() => {
        if (!isInviteCode(code)) fail("invalid_code")
        const circle = state.circles.find((c) => c.code === code) ?? fail("invalid_code")
        if (memberOf(circle.id)) return { circleId: circle.id, joined: false }
        const display = validDisplayName(displayName)
        if (membersIn(circle.id).length >= CIRCLE_LIMITS.members) fail("circle_full")
        if (state.members.filter((m) => m.user_id === self).length >= CIRCLE_LIMITS.circlesPerPerson) fail("too_many_circles")
        state.members.push({ circle_id: circle.id, user_id: self, display_name: display, role: "member", joined_at: stamp() })
        return { circleId: circle.id, joined: true }
      }),

    rotateInvite: (circleId) =>
      wait(() => {
        if (!isOwner(circleId)) fail("not_owner")
        const circle = state.circles.find((c) => c.id === circleId) ?? fail("not_owner")
        circle.code = randomCode()
        return circle.code
      }),

    removeMember: (circleId, userId) =>
      wait(() => {
        if (!isOwner(circleId)) fail("not_owner")
        const target = memberOf(circleId, userId) ?? fail("not_member")
        if (target.role === "owner") fail("last_owner")
        removeMembership(circleId, userId)
      }),

    leaveCircle: (circleId) =>
      wait(() => {
        if (!memberOf(circleId)) fail("not_member")
        removeMembership(circleId, self)
        return state.circles.some((c) => c.id === circleId) ? ("left" as const) : ("deleted" as const)
      }),

    renameSelf: (circleId, displayName) =>
      wait(() => {
        const member = memberOf(circleId) ?? fail("not_member")
        member.display_name = validDisplayName(displayName)
      }),

    checkIn: ({ circleId, weekStart, posts, note }) =>
      wait(() => {
        if (!memberOf(circleId)) fail("not_member")
        const today = dayNumber(toISODate(now()))
        const start = dayNumber(weekStart)
        const weekday = new Date(`${weekStart}T12:00:00Z`).getUTCDay()
        if (!Number.isFinite(start) || start < today - 13 || start > today + 1 || (weekday !== 0 && weekday !== 1)) fail("invalid")
        if (!Number.isInteger(posts) || posts < 0 || posts > CIRCLE_LIMITS.posts || note.length > CIRCLE_LIMITS.note) fail("invalid")
        const existing = state.checkins.find((c) => c.circle_id === circleId && c.user_id === self && c.week_start === weekStart)
        if (existing) {
          Object.assign(existing, { posts, note, updated_at: stamp() })
          return { ...existing }
        }
        const row: CircleCheckin = { id: nextId("checkin"), circle_id: circleId, user_id: self, week_start: weekStart, posts, note, created_at: stamp(), updated_at: stamp() }
        state.checkins.push(row)
        return { ...row }
      }),

    postAsk: ({ circleId, type, text }) =>
      wait(() => {
        if (!memberOf(circleId)) fail("not_member")
        const body = clean(text)
        if (!body || body.length > CIRCLE_LIMITS.askText) fail("invalid")
        const row: CircleAsk = { id: nextId("ask"), circle_id: circleId, user_id: self, type, text: body, status: "open", created_at: stamp() }
        state.asks.push(row)
        return { ...row }
      }),

    closeAsk: (askId) =>
      wait(() => {
        const ask = state.asks.find((a) => a.id === askId && a.user_id === self) ?? fail("not_author")
        ask.status = "closed"
      }),

    showInterest: (circleId, askId) =>
      wait(() => {
        const ask = state.asks.find((a) => a.id === askId && a.circle_id === circleId)
        if (!memberOf(circleId) || !ask || ask.status !== "open" || ask.user_id === self) fail("invalid")
        if (state.interests.some((i) => i.ask_id === askId && i.user_id === self)) fail("invalid")
        state.interests.push({ ask_id: askId, circle_id: circleId, user_id: self, status: "pending", created_at: stamp() })
      }),

    withdrawInterest: (askId) =>
      wait(() => {
        state.interests = state.interests.filter((i) => !(i.ask_id === askId && i.user_id === self && i.status === "pending"))
      }),

    acceptInterest: (askId, userId) =>
      wait(() => {
        if (!state.asks.some((a) => a.id === askId && a.user_id === self)) fail("not_author")
        const interest = state.interests.find((i) => i.ask_id === askId && i.user_id === userId) ?? fail("not_found")
        interest.status = "accepted"
      }),

    contactOf: (circleId, userId) =>
      wait((): string | null => {
        if (!memberOf(circleId)) return null
        const linked =
          userId === self ||
          state.interests.some((i) => {
            if (i.circle_id !== circleId || i.status !== "accepted") return false
            const ask = state.asks.find((a) => a.id === i.ask_id)
            return Boolean(ask) && ((ask!.user_id === self && i.user_id === userId) || (ask!.user_id === userId && i.user_id === self))
          })
        if (!linked) return null
        return state.contacts.find((c) => c.circle_id === circleId && c.user_id === userId)?.contact ?? null
      }),

    setMyContact: (circleId, contact) =>
      wait(() => {
        if (!memberOf(circleId)) fail("not_member")
        const value = clean(contact)
        if (value.length > CIRCLE_LIMITS.contact) fail("invalid_contact")
        state.contacts = state.contacts.filter((c) => !(c.circle_id === circleId && c.user_id === self))
        if (value) state.contacts.push({ circle_id: circleId, user_id: self, contact: value })
      }),
  }
  return api
}

/* ------------------------------ Dev fixture ------------------------------ */

function weekStartOffset(now: Date, weeks: number, weekStartsOn: 0 | 1): ISODate {
  return toISODate(addDays(startOfWeek(now, weekStartsOn), weeks * 7))
}

/**
 * The dev fixture's sample circles, relative to `now`:
 * - "Manila money creators (sample)": you own it with five sample members; four checked in this week
 *   (you haven't yet), and asks in every state — yours with an accepted and a pending interest, one you're
 *   interested in, one nobody answered yet, and a closed one;
 * - "Beta cohort (sample)": just you, so the "share the invite link" state shows;
 * - a circle you're not in, reachable at `/circles/join/FIXTURE_JOIN_CODE`.
 */
export function seedFixtureState(now: Date, weekStartsOn: 0 | 1 = 1): State {
  const state = emptyCirclesState()
  const at = (daysAgo: number, hour = 10) => {
    const d = subDays(now, daysAgo)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  const week = (offset: number) => weekStartOffset(now, offset, weekStartsOn)

  const money = "sample-circle-money"
  const beta = "sample-circle-beta"
  const food = "sample-circle-food"
  state.circles.push(
    { id: money, name: "Manila money creators (sample)", created_by: FIXTURE_SELF_ID, created_at: at(70), code: randomCode() },
    { id: beta, name: "Beta cohort (sample)", created_by: FIXTURE_SELF_ID, created_at: at(3), code: randomCode() },
    { id: food, name: "QC food creators (sample)", created_by: "sample-lara", created_at: at(40), code: FIXTURE_JOIN_CODE }
  )

  const people: [ID, string, number][] = [
    [FIXTURE_SELF_ID, "Ana (sample)", 70],
    ["sample-mika", "Mika (sample)", 68],
    ["sample-jun", "Jun (sample)", 60],
    ["sample-ria", "Ria (sample)", 52],
    ["sample-bea", "Bea (sample)", 45],
    ["sample-tonio", "Tonio (sample)", 20],
  ]
  for (const [user_id, display_name, joined] of people) {
    state.members.push({ circle_id: money, user_id, display_name, role: user_id === FIXTURE_SELF_ID ? "owner" : "member", joined_at: at(joined) })
  }
  state.members.push({ circle_id: beta, user_id: FIXTURE_SELF_ID, display_name: "Ana (sample)", role: "owner", joined_at: at(3) })
  for (const [user_id, display_name, joined] of [
    ["sample-lara", "Lara (sample)", 40],
    ["sample-paolo", "Paolo (sample)", 30],
    ["sample-kim", "Kim (sample)", 12],
  ] as const) {
    state.members.push({ circle_id: food, user_id, display_name, role: user_id === "sample-lara" ? "owner" : "member", joined_at: at(joined) })
  }

  state.contacts.push(
    { circle_id: money, user_id: FIXTURE_SELF_ID, contact: "@ana.sample on IG" },
    { circle_id: money, user_id: "sample-mika", contact: "@mika.sample" },
    { circle_id: money, user_id: "sample-jun", contact: "jun.sample@example.com" },
    { circle_id: money, user_id: "sample-ria", contact: "@ria.sample on TikTok" },
    { circle_id: money, user_id: "sample-tonio", contact: "@tonio.sample" }
  )

  // [member, weeks ago, posts, note]
  const history: [ID, number, number, string][] = [
    ["sample-mika", 0, 4, "Two Reels and a carousel on ipon challenges (sample)"],
    ["sample-jun", 0, 2, ""],
    ["sample-ria", 0, 0, "Sick week — babawi next week (sample)"],
    ["sample-bea", 0, 3, "Tried a 3-part series (sample)"],
  ]
  for (let w = 1; w <= 4; w++) history.push(["sample-mika", w, 3 + (w % 2), ""])
  for (let w = 1; w <= 7; w++) history.push(["sample-bea", w, 2, ""])
  history.push(["sample-jun", 1, 1, ""], ["sample-jun", 3, 2, ""])
  for (let w = 1; w <= 3; w++) history.push(["sample-ria", w, 2, ""])
  for (let w = 1; w <= 3; w++) history.push([FIXTURE_SELF_ID, w, 3, ""])
  history.push(["sample-tonio", 2, 1, ""])
  for (const [user_id, weeksAgo, posts, note] of history) {
    const stampAt = at(weeksAgo * 7, 18)
    state.checkins.push({
      id: `sample-checkin-${state.nextId++}`,
      circle_id: money,
      user_id,
      week_start: week(-weeksAgo),
      posts,
      note,
      created_at: stampAt,
      updated_at: stampAt,
    })
  }

  const ask = (id: ID, user_id: ID, type: CollabType, text: string, daysAgo: number, status: CircleAsk["status"] = "open"): CircleAsk => ({
    id,
    circle_id: money,
    user_id,
    type,
    text,
    status,
    created_at: at(daysAgo, 9),
  })
  state.asks.push(
    ask(
      "sample-ask-live",
      FIXTURE_SELF_ID,
      "joint_live",
      "Looking for a co-host for a Live on ipon for freelancers — I bring the budget templates, you bring your audience's questions. (sample)",
      3
    ),
    ask("sample-ask-stitch", "sample-mika", "duet_stitch", "Stitch chain: \"my first ₱10k saved\" stories. Sino'ng game? I'll start on Friday. (sample)", 2),
    ask("sample-ask-guest", "sample-bea", "guesting", "Need a guest for my podcast episode on side hustles for nurses — 30 minutes, recorded online. (sample)", 1),
    ask("sample-ask-giveaway", "sample-jun", "giveaway", "Group giveaway for our 5k milestones. (sample)", 20, "closed")
  )
  const interest = (ask_id: ID, user_id: ID, status: CircleAskInterest["status"], daysAgo: number): CircleAskInterest => ({
    ask_id,
    circle_id: money,
    user_id,
    status,
    created_at: at(daysAgo, 12),
  })
  state.interests.push(
    interest("sample-ask-live", "sample-ria", "accepted", 2),
    interest("sample-ask-live", "sample-jun", "pending", 1),
    interest("sample-ask-stitch", FIXTURE_SELF_ID, "pending", 1),
    interest("sample-ask-stitch", "sample-bea", "pending", 1),
    interest("sample-ask-giveaway", "sample-mika", "accepted", 18)
  )
  return state
}

export interface CirclesFixtureOptions {
  now?: () => Date
  latencyMs?: number
  weekStartsOn?: 0 | 1
}

/** The dev-only fixture: sample circles with ~120 ms latency. Throws in production builds. */
export function createCirclesFixture(options: CirclesFixtureOptions = {}): CirclesApi {
  assertDevelopment("circles fixture")
  const now = options.now ?? (() => new Date())
  return createCirclesFake({ self: FIXTURE_SELF_ID, now, latencyMs: options.latencyMs ?? 120, state: seedFixtureState(now(), options.weekStartsOn ?? 1) })
}
