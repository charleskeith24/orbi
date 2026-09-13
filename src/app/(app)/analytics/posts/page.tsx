import type { Metadata } from "next"
import { Suspense } from "react"
import { PostPerformanceView } from "@/components/features/analytics/post-performance-view"

export const metadata: Metadata = { title: "Post Performance" }

export default function Page() {
  return (
    <Suspense>
      <PostPerformanceView />
    </Suspense>
  )
}
