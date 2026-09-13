import type { Metadata } from "next"
import { Suspense } from "react"
import { CalendarView } from "@/components/features/calendar/calendar-view"

export const metadata: Metadata = { title: "Calendar" }

export default function Page() {
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  )
}
