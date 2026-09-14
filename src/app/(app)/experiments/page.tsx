import type { Metadata } from "next"
import { Suspense } from "react"
import { ExperimentsView } from "@/components/features/experiments/experiments-view"

export const metadata: Metadata = { title: "Experiments" }

export default function Page() {
  return (
    <Suspense>
      <ExperimentsView />
    </Suspense>
  )
}
