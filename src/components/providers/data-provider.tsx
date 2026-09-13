"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"
import { createLocalAdapter } from "@/lib/data/local-adapter"
import { createSupabaseAdapter } from "@/lib/data/supabase-adapter"
import { useDataStore } from "@/lib/store/data-store"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

let started = false

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
          await store.init(createSupabaseAdapter(supabase, data.user.id))
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
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
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
