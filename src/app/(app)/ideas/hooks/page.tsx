import type { Metadata } from "next"
import { Suspense } from "react"
import { HookLibraryView } from "@/components/features/ideas-lab/hook-library-view"

export const metadata: Metadata = { title: "Hook Library" }

export default function Page() {
  return (
    <Suspense>
      <HookLibraryView />
    </Suspense>
  )
}
