import type { Metadata } from "next"
import { Suspense } from "react"
import { WeeklyReportView } from "@/components/features/reports/weekly-report-view"

export const metadata: Metadata = { title: "Weekly Report" }

export default function Page() {
  return (
    <Suspense>
      <WeeklyReportView />
    </Suspense>
  )
}
