"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isAdminFixtureEnabled, loadAdminFixture } from "./api/dev-fixture"
import type { AdminFixture } from "./api/fixture-api"
import { createHttpAdminApi } from "./api/http-client"
import { createSupabaseMfaClient } from "./api/mfa-client"
import { AdminProvider, type AdminContextValue, type AdminIdentity } from "./admin-context"
import { AdminLoadingFrame, AdminLocalNotice, AdminShell, type AdminTab } from "./admin-shell"

interface AreaProps {
  tab: AdminTab
  /** Hide the tabs (2-step verification still pending). */
  restricted?: boolean
  children: React.ReactNode
}

/**
 * Client side of the admin gate. The server page has already decided:
 * - `live` (gate ok / needs_mfa): the real API over HTTP and Supabase MFA;
 * - `local` (no Supabase): the local-mode notice — or, in development with
 *   `localStorage["pbos:dev-admin"] = "fixture"`, the same screens on sample data.
 */
export function AdminArea(props: AreaProps & { source: "live"; self: AdminIdentity }): React.ReactElement
export function AdminArea(props: AreaProps & { source: "local" }): React.ReactElement
export function AdminArea(props: AreaProps & { source: "live" | "local"; self?: AdminIdentity }) {
  if (props.source === "live" && props.self) return <LiveArea {...props} self={props.self} />
  return <LocalArea {...props} />
}

function LiveArea({ tab, restricted, self, children }: AreaProps & { self: AdminIdentity }) {
  const { id, email } = self
  const value = useMemo<AdminContextValue>(
    () => ({
      api: createHttpAdminApi(),
      mfa: createSupabaseMfaClient(getSupabaseBrowserClient),
      source: "live",
      self: { id, email },
    }),
    [id, email]
  )
  return (
    <AdminProvider value={value}>
      <AdminShell tab={tab} restricted={restricted}>
        {children}
      </AdminShell>
    </AdminProvider>
  )
}

type FixtureSwitch = "on" | "off" | "pending"

const subscribeStorage = (listener: () => void) => {
  window.addEventListener("storage", listener)
  return () => window.removeEventListener("storage", listener)
}
const readSwitch = (): FixtureSwitch => (isAdminFixtureEnabled() ? "on" : "off")
// Production never has the fixture, so it renders the notice straight away; development waits a tick for localStorage.
const serverSwitch = (): FixtureSwitch => (process.env.NODE_ENV === "production" ? "off" : "pending")

function LocalArea({ tab, children }: AreaProps) {
  const fixtureSwitch = useSyncExternalStore(subscribeStorage, readSwitch, serverSwitch)
  const [fixture, setFixture] = useState<AdminFixture | null>(null)

  useEffect(() => {
    if (fixtureSwitch !== "on") return
    let active = true
    void loadAdminFixture()?.then((loaded) => {
      if (active) setFixture(loaded)
    })
    return () => {
      active = false
    }
  }, [fixtureSwitch])

  const value = useMemo<AdminContextValue | null>(
    () => (fixture ? { api: fixture.api, mfa: fixture.mfa, source: "fixture", self: fixture.self } : null),
    [fixture]
  )

  if (fixtureSwitch === "off") return <AdminLocalNotice />
  if (!value) return <AdminLoadingFrame />
  return (
    <AdminProvider value={value}>
      <AdminShell tab={tab}>{children}</AdminShell>
    </AdminProvider>
  )
}
