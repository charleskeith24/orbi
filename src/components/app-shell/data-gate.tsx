"use client"

import { CircleAlert, RotateCcw } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"
import { firstRunDestination } from "@/components/app-shell/first-run-destination"
import { useAdminCheck } from "@/components/features/admin/use-is-admin"
import { dataGateMessages } from "@/components/features/settings/data-messages"
import { MoveLocalPrompt } from "@/components/features/settings/data-move-local"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n"
import { useBrand, useDataStatus, useDataStore } from "@/lib/store"

/** Settings → Data stays reachable before onboarding, so a new account can restore a backup instead of setting up again. */
const RESTORE_TAB = "data"
const noopSubscribe = () => () => {}
const readSettingsTab = () => new URLSearchParams(window.location.search).get("tab")
/** Read when the redirect runs, after navigation has updated the URL. */
const readFrom = () => new URLSearchParams(window.location.search).get("from")

/**
 * Renders children once the workspace is loaded.
 * `app` mode also sends first-time users (no completed onboarding) to /onboarding — except to
 * Settings → Data, where a backup can be restored — and admins to /admin (`firstRunDestination`).
 * Online version: offers once to move this browser's local workspace into an empty account.
 */
export function DataGate({ children, mode = "app" }: { children: React.ReactNode; mode?: "app" | "onboarding" }) {
  const t = useT(dataGateMessages)
  const { status, error, mode: dataMode } = useDataStatus()
  const brand = useBrand()
  const pathname = usePathname()
  const router = useRouter()
  // Read during render without useSearchParams (which would need a Suspense boundary around the whole shell).
  const settingsTab = useSyncExternalStore(noopSubscribe, readSettingsTab, () => null)
  const restoring = pathname === "/settings" && settingsTab === RESTORE_TAB
  const needsOnboarding = mode === "app" && status === "ready" && !brand.onboarding_completed && !restoring
  const isAdmin = useAdminCheck()

  useEffect(() => {
    const destination = firstRunDestination({ needsOnboarding, isAdmin, from: readFrom() })
    if (destination && !pathname.startsWith(destination)) router.replace(destination)
  }, [needsOnboarding, isAdmin, pathname, router])

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <CircleAlert className="mx-auto mb-3 size-6 text-critical-fg" aria-hidden />
          <h2 className="text-base font-semibold">{t("load_failed")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error ?? t("unknown_error")}</p>
          <Button className="mt-4" variant="outline" onClick={() => void useDataStore.getState().reload()}>
            <RotateCcw /> {t("retry")}
          </Button>
        </div>
      </div>
    )
  }

  if (status !== "ready" || needsOnboarding) return <WorkspaceSkeleton />
  return (
    <>
      {children}
      {dataMode === "supabase" ? <MoveLocalPrompt /> : null}
    </>
  )
}

export function WorkspaceSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6" aria-busy="true" aria-label="Loading workspace">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-lg lg:col-span-2" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  )
}
