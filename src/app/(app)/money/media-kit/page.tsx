import type { Metadata } from "next"
import { Suspense } from "react"
import { MediaKitView } from "@/components/features/money/media-kit-view"

export const metadata: Metadata = { title: "Media Kit" }

export default function Page() {
  return (
    <Suspense>
      <MediaKitView />
    </Suspense>
  )
}
