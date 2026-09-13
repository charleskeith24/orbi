import type { Metadata } from "next"
import { Suspense } from "react"
import { PipelineView } from "@/components/features/pipeline/pipeline-view"

export const metadata: Metadata = { title: "Pipeline" }

export default function Page() {
  return (
    <Suspense>
      <PipelineView />
    </Suspense>
  )
}
