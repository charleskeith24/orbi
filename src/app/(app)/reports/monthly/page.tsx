import type { Metadata } from "next"
import { Suspense } from "react"
import { MonthlyReviewView } from "@/components/features/reports/monthly-review-view"

export const metadata: Metadata = { title: "Monthly Review" }

export default function Page() {
  return (
    <Suspense>
      <MonthlyReviewView />
    </Suspense>
  )
}
