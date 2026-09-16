import type { Metadata } from "next"
import { Suspense } from "react"
import { DealsView } from "@/components/features/money/deals-view"

export const metadata: Metadata = { title: "Brand Deals" }

export default function Page() {
  return (
    <Suspense>
      <DealsView />
    </Suspense>
  )
}
