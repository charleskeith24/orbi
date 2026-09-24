"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"
import { createLocalAdapter } from "@/lib/data/local-adapter"
import { createSupabaseAdapter } from "@/lib/data/supabase-adapter"
import { translate } from "@/lib/i18n/core"
import { getUiLang } from "@/lib/i18n/ui-lang"
import { useDataStore } from "@/lib/store/data-store"
import { teamMessages } from "@/lib/team/messages"
import {
  readActiveWorkspace,
  resolveActiveWorkspace,
  STALE_AFTER_MS,
  writeActiveWorkspace,
  type WorkspaceMembership,
  type WorkspaceTarget,
} from "@/lib/team/workspace"
import { createSupabaseTeamApi } from "@/components/features/team/api/supabase-api"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

let started = false

/** Loads the signed-in account's workspace, or a workspace they're a member of. */
async function initSupabase(target: WorkspaceTarget | undefined, selfId: string) {
  const supabase = getSupabaseBrowserClient()
  await useDataStore.getState().init(createSupabaseAdapter(supabase, selfId, target))
}

/**
 * Switches the open workspace (the account menu's switcher). `null` goes back to your own. The choice is
 * remembered per device; the store is reloaded from the new workspace, so nothing of the old one is left
 * in memory.
 */
export async function switchWorkspace(membership: WorkspaceMembership | null): Promise<void> {
  writeActiveWorkspace(membership?.owner_id ?? null)
  const target: WorkspaceTarget | undefined = membership
    ? { ownerId: membership.owner_id, access: { role: membership.role, moneyAccess: membership.money_access } }
    : undefined

  if (!isSupabaseConfigured) {
    // Local mode has no accounts; only the dev fixture can put you in another workspace.
    if (process.env.NODE_ENV !== "production") {
      const { userId } = useDataStore.getState()
      useDataStore.setState({ ownerId: target?.ownerId ?? userId, access: target?.access ?? { role: "owner", moneyAccess: true } })
    }
    return
  }
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  await initSupabase(target, data.user.id)
}

/** Loads the workspace once per browser session and wires page-hide flushing. */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (!started && useDataStore.getState().status === "idle") {
      started = true
      void (async () => {
        const store = useDataStore.getState()
        if (isSupabaseConfigured) {
          const supabase = getSupabaseBrowserClient()
          const { data } = await supabase.auth.getUser()
          if (!data.user) {
            started = false
            const next = window.location.pathname + window.location.search
            router.replace(next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login")
            return
          }
          const self = data.user.id
          // The workspace this device last had open. Asking for the memberships first costs one request
          // and only happens when that isn't your own workspace.
          const remembered = readActiveWorkspace()
          let target: WorkspaceTarget | undefined
          let dropped = false
          if (remembered && remembered !== self) {
            const memberships = await createSupabaseTeamApi(supabase, self)
              .workspaces()
              .catch(() => [] as WorkspaceMembership[])
            const resolved = resolveActiveWorkspace(self, remembered, memberships)
            dropped = resolved.changed
            if (dropped) writeActiveWorkspace(null)
            if (resolved.target.ownerId !== self) target = resolved.target
          }
          await initSupabase(target, self)
          if (dropped) toast.info(translate(teamMessages, getUiLang(), "no_longer_member"), { id: "team-dropped" })
        } else {
          await store.init(
            createLocalAdapter({
              onPersistError: () =>
                toast.error("Couldn't save to this browser", {
                  description: "Browser storage may be full. Export your workspace from Settings → Data.",
                  id: "local-persist-error",
                }),
            })
          )
        }
      })()
    }

    const flush = () => useDataStore.getState().adapter?.flush?.()
    let hiddenAt: number | null = null
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now()
        flush()
        return
      }
      // Team workspaces: two people can edit the same row, and the last write wins. Coming back after a
      // while, reload rather than keep showing a stale copy (ARCHITECTURE §17).
      const away = hiddenAt ? Date.now() - hiddenAt : 0
      hiddenAt = null
      // Only the online version can have a second person editing at all; local mode is one device.
      const { status, reload } = useDataStore.getState()
      if (away >= STALE_AFTER_MS && status === "ready" && isSupabaseConfigured) void reload()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [router])

  return <>{children}</>
}
