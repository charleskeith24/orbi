import type { Metadata } from "next"
import { Suspense } from "react"
import { MatrixView } from "@/components/features/pillars/matrix-view"

export const metadata: Metadata = { title: "Content Matrix" }

export default function Page() {
  return (
    <Suspense>
      <MatrixView />
    </Suspense>
  )
}
