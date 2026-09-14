import type { Metadata } from "next"
import { Suspense } from "react"
import { PillarsView } from "@/components/features/pillars/pillars-view"

export const metadata: Metadata = { title: "Content Pillars" }

export default function Page() {
  return (
    <Suspense>
      <PillarsView />
    </Suspense>
  )
}
