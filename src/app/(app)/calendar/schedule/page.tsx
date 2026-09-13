import type { Metadata } from "next"
import { Suspense } from "react"
import { ScheduleView } from "@/components/features/calendar/schedule-view"

export const metadata: Metadata = { title: "Posting Schedule" }

export default function Page() {
  return (
    <Suspense>
      <ScheduleView />
    </Suspense>
  )
}
