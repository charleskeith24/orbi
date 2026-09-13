import type { Metadata } from "next"
import { Suspense } from "react"
import { GoalsView } from "@/components/features/strategy/goals-view"

export const metadata: Metadata = { title: "Brand Goals" }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GoalsView />
    </Suspense>
  )
}
