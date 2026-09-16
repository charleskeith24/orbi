import type { Metadata } from "next"
import { Suspense } from "react"
import { MoneyOverviewView } from "@/components/features/money/money-overview-view"

export const metadata: Metadata = { title: "Money" }

export default function Page() {
  return (
    <Suspense>
      <MoneyOverviewView />
    </Suspense>
  )
}
