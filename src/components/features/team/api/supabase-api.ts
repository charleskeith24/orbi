/**
 * `TeamApi` over the browser Supabase client: reads through row-level security (your own membership row,
 * your own workspace's invites) and writes through the team functions, which check `auth.uid()` themselves.
 * No API routes and no secret key — the database enforces every rule
 * (supabase/migrations/20260921000000_team.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { toTeamError, type InviteInput, type TeamApi } from "@/lib/team/types"
import type { TeamOverview, WorkspaceInviteForMe, WorkspaceMember, WorkspaceMembership } from "@/lib/team/workspace"
import type { ID } from "@/lib/types"

/** Listed, never `select *`: the tables may grow columns a member has no grant for. */
export const MEMBER_COLUMNS = "user_id, role, money_access, joined_at"
export const INVITE_COLUMNS = "id, email, role, money_access, created_at"

interface Result<T> {
  data: T | null
  error: unknown
}

async function run<T>(request: PromiseLike<Result<T>>): Promise<T> {
  let result: Result<T>
  try {
    result = await request
  } catch (error) {
    throw toTeamError(error)
  }
  if (result.error) throw toTeamError(result.error)
  return result.data as T
}

export function createSupabaseTeamApi(supabase: SupabaseClient, self: ID): TeamApi {
  return {
    self,

    async team(): Promise<TeamOverview> {
      const [members, invites] = await Promise.all([
        run<WorkspaceMember[]>(
          supabase.from("workspace_members").select(MEMBER_COLUMNS).eq("owner_id", self).order("joined_at", { ascending: true })
        ),
        run<TeamOverview["invites"]>(
          supabase.from("workspace_invites").select(INVITE_COLUMNS).eq("owner_id", self).order("email", { ascending: true })
        ),
      ])
      return { members: members ?? [], invites: invites ?? [] }
    },

    async workspaces(): Promise<WorkspaceMembership[]> {
      return (await run<WorkspaceMembership[]>(supabase.rpc("my_workspaces"))) ?? []
    },

    async invites(): Promise<WorkspaceInviteForMe[]> {
      return (await run<WorkspaceInviteForMe[]>(supabase.rpc("my_workspace_invites"))) ?? []
    },

    async invite({ email, role, moneyAccess }: InviteInput) {
      await run(supabase.rpc("invite_to_workspace", { p_email: email, p_role: role, p_money_access: moneyAccess }))
    },

    async cancelInvite(inviteId: ID) {
      await run(supabase.from("workspace_invites").delete().eq("id", inviteId).eq("owner_id", self))
    },

    async setMember(userId: ID, { role, moneyAccess }) {
      await run(supabase.rpc("set_workspace_member", { p_user: userId, p_role: role, p_money_access: moneyAccess }))
    },

    async removeMember(userId: ID) {
      await run(supabase.rpc("remove_workspace_member", { p_user: userId }))
    },

    async leave(ownerId: ID) {
      await run(supabase.rpc("leave_workspace", { p_owner: ownerId }))
    },

    async respond(ownerId: ID, accept: boolean) {
      const answer = await run<string>(supabase.rpc("respond_to_invite", { p_owner: ownerId, p_accept: accept }))
      return answer === "accepted" ? "accepted" : "declined"
    },
  }
}
