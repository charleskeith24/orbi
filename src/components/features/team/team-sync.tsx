"use client"

/**
 * Picks the session's team client once the workspace is loaded (mounted once, in the app shell):
 * - online version: the signed-in user's Supabase client (row-level security and the team functions);
 * - local mode: nothing — there are no accounts, so Settings → Team shows an honest notice. In
 *   development with `localStorage["pbos:dev-team"]` set, the sample team instead.
 *
 * The fixture may also open a sample workspace as an Editor or a Viewer, so those screens can be seen
 * locally. That, and only that, writes the store's `ownerId` / `access` directly; it is guarded by
 * `NODE_ENV` like every other dev fixture.
 */
import { useEffect, useSyncExternalStore } from "react"
import { useDataStore } from "@/lib/store/data-store"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { loadTeamFixture, readTeamFixtureMode } from "./api/dev-fixture"
import { createSupabaseTeamApi } from "./api/supabase-api"
import { teamActions } from "./team-store"

const subscribeStorage = (listener: () => void) => {
  window.addEventListener("storage", listener)
  return () => window.removeEventListener("storage", listener)
}
const readMode = () => readTeamFixtureMode()
const serverMode = () => null

export function TeamSync() {
  const userId = useDataStore((s) => s.userId)
  const status = useDataStore((s) => s.status)
  const mode = useSyncExternalStore(subscribeStorage, readMode, serverMode)

  useEffect(() => {
    if (status !== "ready" || !userId) return
    if (isSupabaseConfigured) {
      teamActions.connect(`live:${userId}`, createSupabaseTeamApi(getSupabaseBrowserClient(), userId), "live")
      return
    }
    if (!mode) {
      teamActions.setLocal()
      return
    }
    let active = true
    void loadTeamFixture(userId, mode)?.then((fixture) => {
      if (!active) return
      teamActions.connect(`fixture:${userId}:${mode}`, fixture.api, "fixture")
      if (fixture.target) useDataStore.setState({ ownerId: fixture.target.ownerId, access: fixture.target.access })
      else useDataStore.setState({ ownerId: userId, access: { role: "owner", moneyAccess: true } })
    })
    return () => {
      active = false
    }
  }, [status, userId, mode])

  return null
}
