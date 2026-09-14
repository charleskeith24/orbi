import type { Metadata } from "next"
import { Suspense } from "react"
import { ResearchLibraryView } from "@/components/features/research/research-library-view"

export const metadata: Metadata = { title: "Research Library" }

export default function Page() {
  return (
    <Suspense>
      <ResearchLibraryView />
    </Suspense>
  )
}
