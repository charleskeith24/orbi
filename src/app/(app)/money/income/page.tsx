import type { Metadata } from "next"
import { Suspense } from "react"
import { IncomeView } from "@/components/features/money/income-view"

export const metadata: Metadata = { title: "Income" }

export default function Page() {
  return (
    <Suspense>
      <IncomeView />
    </Suspense>
  )
}
