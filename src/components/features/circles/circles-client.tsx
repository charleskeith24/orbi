"use client"

import { ArrowRight, FlaskConical, HardDrive, LogIn } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { PageContainer, StatusPill } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { CirclesApi } from "@/lib/circles/types"
import { useT } from "@/lib/i18n"
import { useSettings } from "@/lib/store"
import { useDataStore } from "@/lib/store/data-store"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { isCirclesFixtureEnabled, loadCirclesFixture } from "./api/dev-fixture"
import { useDescribeError } from "./circle-errors"
import { createSupabaseCirclesApi } from "./api/supabase-api"
import { circlesMessages } from "./messages"

/** live = Supabase (RLS + RPCs) · fixture = the dev-only sample circles. */
export type CirclesSource = "live" | "fixture"

export interface CirclesContextValue {
  api: CirclesApi
  source: CirclesSource
}

export type CirclesClientState = { status: "local" } | { status: "signed_out" } | { status: "pending" } | ({ status: "ready" } & CirclesContextValue)

type FixtureSwitch = "on" | "off" | "pending"

const subscribeStorage = (listener: () => void) => {
  window.addEventListener("storage", listener)
  return () => window.removeEventListener("storage", listener)
}
const readSwitch = (): FixtureSwitch => (isCirclesFixtureEnabled() ? "on" : "off")
// Production never has the fixture, so it renders the notice straight away; development waits a tick for localStorage.
const serverSwitch = (): FixtureSwitch => (process.env.NODE_ENV === "production" ? "off" : "pending")

/**
 * Which Circles client this page gets:
 * - online version (Supabase env vars): the signed-in user's browser client — or `signed_out`;
 * - local mode: the honest "online version" notice — or, in development with
 *   `localStorage["pbos:dev-circles"] = "fixture"`, the sample circles.
 */
export function useCirclesClient(): CirclesClientState {
  const userId = useDataStore((s) => s.userId)
  const weekStartsOn = useSettings().week_starts_on
  const fixtureSwitch = useSyncExternalStore(subscribeStorage, readSwitch, serverSwitch)
  const [fixture, setFixture] = useState<CirclesApi | null>(null)

  useEffect(() => {
    if (isSupabaseConfigured || fixtureSwitch !== "on") return
    let active = true
    void loadCirclesFixture(weekStartsOn)?.then((loaded) => {
      if (active) setFixture(loaded)
    })
    return () => {
      active = false
    }
  }, [fixtureSwitch, weekStartsOn])

  const live = useMemo(() => (isSupabaseConfigured && userId ? createSupabaseCirclesApi(getSupabaseBrowserClient(), userId) : null), [userId])

  if (isSupabaseConfigured) return live ? { status: "ready", api: live, source: "live" } : { status: "signed_out" }
  if (fixtureSwitch === "off") return { status: "local" }
  if (fixtureSwitch === "pending" || !fixture) return { status: "pending" }
  return { status: "ready", api: fixture, source: "fixture" }
}

const CirclesContext = createContext<CirclesContextValue | null>(null)

/** The Circles client for this page. Only inside `<CirclesFrame>`. */
export function useCircles(): CirclesContextValue {
  const value = useContext(CirclesContext)
  if (!value) throw new Error("useCircles() must be used inside <CirclesFrame>.")
  return value
}

/** Renders the local-mode notice, the signed-out state or a loading frame — or the page with its client. */
export function CirclesFrame({ children }: { children: React.ReactNode }) {
  const state = useCirclesClient()
  const value = useMemo<CirclesContextValue | null>(() => (state.status === "ready" ? { api: state.api, source: state.source } : null), [state])
  if (state.status === "local") return <CirclesLocalNotice />
  if (state.status === "signed_out") return <CirclesSignedOut />
  if (!value) return <CirclesLoading />
  return <CirclesContext.Provider value={value}>{children}</CirclesContext.Provider>
}

/** The "sample data" pill + banner, shown only with the dev fixture. */
export function SampleDataNote() {
  const t = useT(circlesMessages)
  const { source } = useCircles()
  if (source !== "fixture") return null
  return (
    <p role="note" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <StatusPill tone="warning" icon={FlaskConical}>
        {t("sample_badge")}
      </StatusPill>
      {t("sample_banner")}
    </p>
  )
}

export function CirclesLoading() {
  const t = useT(circlesMessages)
  return (
    <PageContainer>
      <div role="status" aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    </PageContainer>
  )
}

/** Local mode (no Supabase): an honest notice instead of a feature that can't work — the `/admin` pattern. */
export function CirclesLocalNotice() {
  const t = useT(circlesMessages)
  return (
    <PageContainer width="narrow">
      <section className="mx-auto mt-4 w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground shadow-xs sm:mt-10 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <HardDrive className="size-4.5 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-base font-semibold">{t("local_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("local_body")}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t("local_deploy")}</p>
        <p className="mt-1.5 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">docs/DEPLOY.md</p>
        <Button asChild size="lg" className="mt-5 w-full">
          <Link href="/collabs">
            {t("local_collabs")}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>
    </PageContainer>
  )
}

function CirclesSignedOut() {
  const t = useT(circlesMessages)
  const pathname = usePathname()
  return (
    <PageContainer width="narrow">
      <section className="mx-auto mt-4 w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground shadow-xs sm:mt-10 sm:p-6">
        <h1 className="text-base font-semibold">{t("signed_out_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("signed_out_body")}</p>
        <Button asChild size="lg" className="mt-5 w-full">
          <Link href={`/login?next=${encodeURIComponent(pathname || "/circles")}`}>
            <LogIn aria-hidden />
            {t("sign_in")}
          </Link>
        </Button>
      </section>
    </PageContainer>
  )
}

/** A failed load: the reason and "Try again". */
export function CirclesLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useT(circlesMessages)
  const describe = useDescribeError()
  return (
    <div role="alert" className="rounded-lg border bg-card p-4 text-sm">
      <p className="font-medium">{t("load_failed")}</p>
      <p className="mt-0.5 text-muted-foreground">{describe(error)}</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  )
}
