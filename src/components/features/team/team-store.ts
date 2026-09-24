"use client"

/**
 * Team workspaces in the browser: one client per session (online, or the dev-only fixture — `<TeamSync />`
 * in the app shell picks it), the workspaces you're a member of, the invites waiting for you, and your own
 * workspace's team.
 *
 * Every mutation goes through `teamActions.run`, which reloads afterwards, so the UI always shows what the
 * database says rather than what it hoped for. Nothing here decides permissions: that is row-level
 * security, mirrored for the UI by `src/lib/team/permissions.ts`.
 *
 * Rule: selectors return stored references only (zustand 5: no new objects from a selector).
 */
import { create } from "zustand"
import type { TeamApi } from "@/lib/team/types"
import type { TeamOverview, WorkspaceInviteForMe, WorkspaceMembership } from "@/lib/team/workspace"

export type TeamSource = "live" | "fixture"
export type TeamStatus = "idle" | "local" | "loading" | "ready" | "error"

export interface TeamState {
  api: TeamApi | null
  /** Identifies the connected client, so a late response from an old one is dropped. */
  apiKey: string
  source: TeamSource | null
  status: TeamStatus
  /** The workspaces you're a member of (your own is not one). */
  memberships: WorkspaceMembership[]
  /** Invites addressed to your account's email. */
  invites: WorkspaceInviteForMe[]
  /** Your own workspace's members and pending invites; null until loaded. */
  team: TeamOverview | null
  error: unknown
  /** A mutation is in flight. */
  busy: boolean
}

const EMPTY_MEMBERSHIPS: WorkspaceMembership[] = []
const EMPTY_INVITES: WorkspaceInviteForMe[] = []

const INITIAL: TeamState = {
  api: null,
  apiKey: "",
  source: null,
  status: "idle",
  memberships: EMPTY_MEMBERSHIPS,
  invites: EMPTY_INVITES,
  team: null,
  error: null,
  busy: false,
}

export const useTeamStore = create<TeamState>(() => ({ ...INITIAL }))

async function load(apiKey: string): Promise<void> {
  const { api } = useTeamStore.getState()
  if (!api) return
  useTeamStore.setState({ status: "loading", error: null })
  try {
    const [memberships, invites, team] = await Promise.all([api.workspaces(), api.invites(), api.team()])
    if (useTeamStore.getState().apiKey !== apiKey) return
    useTeamStore.setState({ memberships, invites, team, status: "ready", error: null })
  } catch (error) {
    if (useTeamStore.getState().apiKey !== apiKey) return
    useTeamStore.setState({ status: "error", error })
  }
}

export const teamActions = {
  /** Connects the session's client and loads it. Called once by `<TeamSync />`. */
  connect(apiKey: string, api: TeamApi, source: TeamSource) {
    if (useTeamStore.getState().apiKey === apiKey) return
    useTeamStore.setState({ ...INITIAL, api, apiKey, source })
    void load(apiKey)
  },

  /** Local mode without the fixture: there are no accounts, so there is no team. */
  setLocal() {
    if (useTeamStore.getState().status === "local") return
    useTeamStore.setState({ ...INITIAL, status: "local" })
  },

  /** Settings → Team's manual "Refresh", and after every change. */
  async refresh(): Promise<void> {
    await load(useTeamStore.getState().apiKey)
  },

  /** Runs one change and reloads. Errors are thrown for the caller to show. */
  async run<T>(op: (api: TeamApi) => Promise<T>): Promise<T> {
    const { api, apiKey } = useTeamStore.getState()
    if (!api) throw new Error("Team is not available in this workspace")
    useTeamStore.setState({ busy: true })
    try {
      return await op(api)
    } finally {
      useTeamStore.setState({ busy: false })
      if (useTeamStore.getState().apiKey === apiKey) await load(apiKey)
    }
  },
}

export const useTeamStatus = (): TeamStatus => useTeamStore((s) => s.status)
export const useTeamSource = (): TeamSource | null => useTeamStore((s) => s.source)
export const useTeamBusy = (): boolean => useTeamStore((s) => s.busy)
export const useTeamError = (): unknown => useTeamStore((s) => s.error)
export const useMyWorkspaces = (): WorkspaceMembership[] => useTeamStore((s) => s.memberships)
export const useMyInvites = (): WorkspaceInviteForMe[] => useTeamStore((s) => s.invites)
export const useMyTeam = (): TeamOverview | null => useTeamStore((s) => s.team)
