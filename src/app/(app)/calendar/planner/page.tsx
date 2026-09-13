import type { Metadata } from "next"
import { Suspense } from "react"
import { PlannerView } from "@/components/features/calendar/planner-view"

export const metadata: Metadata = { title: "Weekly Planner" }

export default function Page() {
  return (
    <Suspense>
      <PlannerView />
    </Suspense>
  )
}
