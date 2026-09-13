import type { Metadata } from "next"
import { Suspense } from "react"
import { AnalyticsView } from "@/components/features/analytics/analytics-view"

export const metadata: Metadata = { title: "Analytics" }

export default function Page() {
  return (
    <Suspense>
      <AnalyticsView />
    </Suspense>
  )
}
