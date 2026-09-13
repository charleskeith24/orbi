import type { Metadata } from "next"
import { Suspense } from "react"
import { StrategistView } from "@/components/features/strategist/strategist-view"

export const metadata: Metadata = { title: "Content Strategist" }

export default function Page() {
  return (
    <Suspense>
      <StrategistView />
    </Suspense>
  )
}
