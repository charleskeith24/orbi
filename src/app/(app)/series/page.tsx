import type { Metadata } from "next"
import { Suspense } from "react"
import { SeriesView } from "@/components/features/series/series-view"

export const metadata: Metadata = { title: "Series" }

export default function Page() {
  return (
    <Suspense>
      <SeriesView />
    </Suspense>
  )
}
