/**
 * An in-memory `TeamApi` with the same rules as the database: used by tests and by the dev-only fixture
 * (`localStorage["pbos:dev-team"]`, the scripts' `--team` flag) so team workspaces can be seen and
 * screenshotted on a local dev server, which has no accounts.
 *
 * Production guard (the Circles pattern): `createTeamFixture` throws if it is ever created in a
 * production build, and the only caller sits behind a `process.env.NODE_ENV` check the bundler drops.
 */
import type { ID } from "@/lib/types"
import type { MemberRole } from "./permissions"
import { TeamApiError, type InviteInput, type TeamApi } from "./types"
import type { TeamOverview, WorkspaceInviteForMe, WorkspaceMembership, WorkspaceTarget } from "./workspace"

export const TEAM_FIXTURE_MODES = ["fixture", "editor", "editor-money", "viewer"] as const
export type TeamFixtureMode = (typeof TEAM_FIXTURE_MODES)[number]

export const isTeamFixtureMode = (value: string | null): value is TeamFixtureMode =>
  (TEAM_FIXTURE_MODES as readonly string[]).includes(value ?? "")

/** Sample people; the ids match `src/lib/profiles/fixture-api.ts`, so they get sample photos too. */
export const SAMPLE_MIKA = "sample-mika"
export const SAMPLE_JUN = "sample-jun"
export const SAMPLE_RIA = "sample-ria"
export const SAMPLE_WORKSPACE = "Kapihan Roasters (sample)"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SEATS = 5

interface MemberRow {
  owner_id: ID
  user_id: ID
  role: MemberRole
  money_access: boolean
  joined_at: string
}

interface InviteRow {
  id: ID
  owner_id: ID
  email: string
  role: MemberRole
  money_access: boolean
  created_at: string
}

export interface TeamFakeState {
  members: MemberRow[]
  invites: InviteRow[]
  /** Workspace labels by owner id (what `workspace_label()` returns). */
  labels: Record<ID, string>
  /** The signed-in person's account email, for matching invites. */
  myEmail: string
}

export interface TeamFakeOptions {
  self: ID
  state: TeamFakeState
  now?: () => Date
  latencyMs?: number
}

/** The fake, with every rule the SQL functions enforce. */
export function createTeamFake(options: TeamFakeOptions): TeamApi & { state: TeamFakeState } {
  const { self, state } = options
  const now = options.now ?? (() => new Date())
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, options.latencyMs ?? 0))
  const label = (ownerId: ID) => state.labels[ownerId] ?? "Orbi workspace"
  const myMembers = () => state.members.filter((m) => m.owner_id === self)
  const myInvites = () => state.invites.filter((i) => i.owner_id === self)

  return {
    state,
    self,

    async team(): Promise<TeamOverview> {
      await wait()
      return {
        members: myMembers()
          .map(({ user_id, role, money_access, joined_at }) => ({ user_id, role, money_access, joined_at }))
          .sort((a, b) => a.joined_at.localeCompare(b.joined_at)),
        invites: myInvites()
          .map(({ id, email, role, money_access, created_at }) => ({ id, email, role, money_access, created_at }))
          .sort((a, b) => a.email.localeCompare(b.email)),
      }
    },

    async workspaces(): Promise<WorkspaceMembership[]> {
      await wait()
      return state.members
        .filter((m) => m.user_id === self)
        .map((m) => ({ owner_id: m.owner_id, workspace_name: label(m.owner_id), role: m.role, money_access: m.money_access, joined_at: m.joined_at }))
        .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
    },

    async invites(): Promise<WorkspaceInviteForMe[]> {
      await wait()
      const email = state.myEmail.trim().toLowerCase()
      return state.invites
        .filter((i) => i.email === email && !state.members.some((m) => m.owner_id === i.owner_id && m.user_id === self))
        .map((i) => ({ owner_id: i.owner_id, workspace_name: label(i.owner_id), role: i.role, money_access: i.money_access, created_at: i.created_at }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    },

    async invite({ email, role, moneyAccess }: InviteInput) {
      await wait()
      const clean = email.trim().toLowerCase()
      if (!EMAIL_RE.test(clean) || clean.length > 320) throw new TeamApiError("invalid_email")
      if (role !== "editor" && role !== "viewer") throw new TeamApiError("invalid_role")
      if (clean === state.myEmail.trim().toLowerCase()) throw new TeamApiError("self_invite")
      const existing = myInvites().find((i) => i.email === clean)
      if (!existing && myMembers().length + myInvites().length >= SEATS) throw new TeamApiError("workspace_full")
      if (existing) {
        existing.role = role
        existing.money_access = moneyAccess
        return
      }
      state.invites.push({
        id: `invite-${state.invites.length + 1}-${clean}`,
        owner_id: self,
        email: clean,
        role,
        money_access: moneyAccess,
        created_at: now().toISOString(),
      })
    },

    async cancelInvite(inviteId: ID) {
      await wait()
      const index = state.invites.findIndex((i) => i.id === inviteId && i.owner_id === self)
      if (index < 0) throw new TeamApiError("not_found")
      state.invites.splice(index, 1)
    },

    async setMember(userId: ID, { role, moneyAccess }) {
      await wait()
      if (role !== "editor" && role !== "viewer") throw new TeamApiError("invalid_role")
      const member = state.members.find((m) => m.owner_id === self && m.user_id === userId)
      if (!member) throw new TeamApiError("not_member")
      member.role = role
      member.money_access = moneyAccess
    },

    async removeMember(userId: ID) {
      await wait()
      const index = state.members.findIndex((m) => m.owner_id === self && m.user_id === userId)
      if (index < 0) throw new TeamApiError("not_member")
      state.members.splice(index, 1)
    },

    async leave(ownerId: ID) {
      await wait()
      const index = state.members.findIndex((m) => m.owner_id === ownerId && m.user_id === self)
      if (index < 0) throw new TeamApiError("not_member")
      state.members.splice(index, 1)
    },

    async respond(ownerId: ID, accept: boolean) {
      await wait()
      const email = state.myEmail.trim().toLowerCase()
      const index = state.invites.findIndex((i) => i.owner_id === ownerId && i.email === email)
      if (index < 0) throw new TeamApiError("not_found")
      const [invite] = state.invites.splice(index, 1)
      if (!accept) return "declined"
      if (state.members.some((m) => m.owner_id === ownerId && m.user_id === self)) return "accepted"
      if (state.members.filter((m) => m.owner_id === ownerId).length >= SEATS) throw new TeamApiError("workspace_full")
      if (state.members.filter((m) => m.user_id === self).length >= 10) throw new TeamApiError("too_many_workspaces")
      state.members.push({ owner_id: ownerId, user_id: self, role: invite.role, money_access: invite.money_access, joined_at: now().toISOString() })
      return "accepted"
    },
  }
}

export interface TeamFixture {
  api: TeamApi
  /** The workspace the dev fixture forces the store into, or null to stay in your own. */
  target: WorkspaceTarget | null
  /** The label of `target`, for the "You're in …" strip. */
  targetName: string | null
}

export interface TeamFixtureOptions {
  self: ID
  mode: TeamFixtureMode
  myEmail?: string
  now?: () => Date
  latencyMs?: number
}

/**
 * The sample team: two members and a pending invite in your own workspace, one workspace you're a member
 * of, and one invite waiting for you. `mode` other than "fixture" also opens that other workspace with
 * the role in its name, so an Editor's and a Viewer's screens can be seen in local mode.
 */
export function createTeamFixture(options: TeamFixtureOptions): TeamFixture {
  if (process.env.NODE_ENV === "production") throw new Error("The team fixture is a development-only tool.")
  const { self, mode } = options
  const now = options.now ?? (() => new Date())
  const at = (daysAgo: number) => new Date(now().getTime() - daysAgo * 86_400_000).toISOString()
  const myEmail = options.myEmail || "you@example.com"

  const state: TeamFakeState = {
    myEmail,
    labels: {
      [self]: "My workspace",
      [SAMPLE_MIKA]: SAMPLE_WORKSPACE,
      [SAMPLE_RIA]: "OFW money (sample)",
    },
    members: [
      { owner_id: self, user_id: SAMPLE_JUN, role: "editor", money_access: false, joined_at: at(21) },
      { owner_id: self, user_id: SAMPLE_RIA, role: "viewer", money_access: true, joined_at: at(6) },
      { owner_id: SAMPLE_MIKA, user_id: self, role: mode === "viewer" ? "viewer" : "editor", money_access: mode === "editor-money", joined_at: at(12) },
    ],
    invites: [
      { id: "invite-sample-bea", owner_id: self, email: "bea@example.com", role: "editor", money_access: false, created_at: at(2) },
      { id: "invite-for-me", owner_id: SAMPLE_RIA, email: myEmail, role: "viewer", money_access: false, created_at: at(1) },
    ],
  }

  const api = createTeamFake({ self, state, now, latencyMs: options.latencyMs ?? 120 })
  if (mode === "fixture") return { api, target: null, targetName: null }
  return {
    api,
    target: {
      ownerId: SAMPLE_MIKA,
      access: { role: mode === "viewer" ? "viewer" : "editor", moneyAccess: mode === "editor-money" },
    },
    targetName: SAMPLE_WORKSPACE,
  }
}
