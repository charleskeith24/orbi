"use client"

import { CircleAlert, RotateCcw } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useBrand, useDataStatus, useDataStore } from "@/lib/store"

/**
 * Renders children once the workspace is loaded.
 * `app` mode also sends first-time users (no completed onboarding) to /onboarding.
 */
export function DataGate({ children, mode = "app" }: { children: React.ReactNode; mode?: "app" | "onboarding" }) {
  const { status, error } = useDataStatus()
  const brand = useBrand()
  const pathname = usePathname()
  const router = useRouter()
  const needsOnboarding = mode === "app" && status === "ready" && !brand.onboarding_completed

  useEffect(() => {
    if (needsOnboarding && !pathname.startsWith("/onboarding")) router.replace("/onboarding")
  }, [needsOnboarding, pathname, router])

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <CircleAlert className="mx-auto mb-3 size-6 text-critical-fg" aria-hidden />
          <h2 className="text-base font-semibold">Couldn&apos;t load your workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error ?? "Unknown error"}</p>
          <Button className="mt-4" variant="outline" onClick={() => void useDataStore.getState().reload()}>
            <RotateCcw /> Try again
          </Button>
        </div>
      </div>
    )
  }

  if (status !== "ready" || needsOnboarding) return <WorkspaceSkeleton />
  return <>{children}</>
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
