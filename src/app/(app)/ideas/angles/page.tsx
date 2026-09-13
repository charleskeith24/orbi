import type { Metadata } from "next"
import { Suspense } from "react"
import { AngleLibraryView } from "@/components/features/ideas-lab/angle-library-view"

export const metadata: Metadata = { title: "Angle Library" }

export default function Page() {
  return (
    <Suspense>
      <AngleLibraryView />
    </Suspense>
  )
}
